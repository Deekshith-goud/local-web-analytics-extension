import {
  ActiveSession,
  ActivityRecord,
  SessionTerminationReason,
  TrackingEvents
} from "../types/tracking";
import { createEventBus } from "../utils/event-bus";
import { logger } from "../utils/logger";
import { extractHostname } from "../utils/url";
import { stageRecord } from "../storage/drain-engine";

const MAX_SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVE_SESSION_KEY = "active_session_state";
const IDLE_THRESHOLD_SECONDS = 30;
const CURRENT_SCHEMA_VERSION = 1;

export class TrackingEngine {
  public events = createEventBus<TrackingEvents>();
  private currentState: ActiveSession | null = null;
  private isInitialized = false;
  private isPaused = false;

  constructor() {
    this.setupListeners();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    logger.info("Initializing Tracking Engine...");
    chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
    
    // Resolve tracking paused setting
    const pauseSetting = await chrome.storage.local.get("tracking_paused");
    this.isPaused = !!pauseSetting.tracking_paused;

    if (this.isPaused) {
      logger.info("Tracking is PAUSED on initialization.");
      // Safeguard: remove any stale active session left from crash/suspend state
      await chrome.storage.local.remove(ACTIVE_SESSION_KEY);
      this.isInitialized = true;
      return;
    }

    const data = await chrome.storage.local.get(ACTIVE_SESSION_KEY);
    const recoveredSession = data[ACTIVE_SESSION_KEY] as ActiveSession | undefined;

    if (recoveredSession) {
      await this.validateRecoveredSession(recoveredSession);
    } else {
      await this.evaluateCurrentState();
    }
    
    this.isInitialized = true;
  }

  /**
   * Called synchronously from onSuspend (cannot await).
   * Fires a fire-and-forget finalize to persist any active session
   * before the worker is torn down by Chrome.
   */
  public handleShutdown(): void {
    logger.info("Engine shutdown triggered.");
    // Fire-and-forget: onSuspend is synchronous but we do our best to persist
    void this.finalizeCurrentSession("shutdown");
    this.isInitialized = false;
  }

  /**
   * Public getter for the active session.
   * Enables background handlers to query live timing state.
   */
  public getActiveSession(): ActiveSession | null {
    return this.currentState;
  }

  /**
   * Resets active session in-memory state during purges.
   */
  public clearState(): void {
    this.currentState = null;
  }

  /**
   * Public getter for the tracking paused state.
   */
  public getPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Public setter to dynamically pause/resume tracking.
   * Triggers clean session finalizations or instant tab re-evaluations.
   */
  public async setPaused(paused: boolean): Promise<void> {
    if (this.isPaused === paused) return;

    logger.info(`Setting tracking paused state: ${paused}`);
    this.isPaused = paused;
    await chrome.storage.local.set({ tracking_paused: paused });

    if (paused) {
      // Gracefully terminate active session immediately (strict boundary)
      await this.finalizeCurrentSession("unfocused");
    } else {
      // Re-evaluate current browser tab focus immediately to resume tracking
      await this.evaluateCurrentState();
    }
  }

  private setupListeners(): void {
    chrome.tabs.onActivated.addListener(this.onTabActivated.bind(this));
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this));
    chrome.windows.onFocusChanged.addListener(this.onWindowFocusChanged.bind(this));
    chrome.idle.onStateChanged.addListener(this.onIdleStateChanged.bind(this));
  }

  private async validateRecoveredSession(session: ActiveSession): Promise<void> {
    logger.debug("Validating recovered session:", session);

    let isValid = true;
    const terminationReason: SessionTerminationReason = "recovery-failed";

    // Guard: if IDs are missing the session cannot be validated
    if (session.windowId === undefined || session.tabId === undefined) {
      isValid = false;
    } else {
      try {
        const [chromeWindow, tab] = await Promise.all([
          chrome.windows.get(session.windowId),
          chrome.tabs.get(session.tabId)
        ]);

        if (!chromeWindow.focused) {
          isValid = false;
        } else if (!tab.active) {
          isValid = false;
        } else {
          const currentDomain = extractHostname(tab.url);
          if (currentDomain !== session.domain) {
            isValid = false;
          }
        }
      } catch (_error) {
        // Tab or window no longer exists — treat as invalid
        isValid = false;
      }
    }

    if (!isValid) {
      logger.info("Recovered session invalid. Finalizing...");
      await this.finalizeCurrentSession(terminationReason, session.lastUpdated);
      await this.evaluateCurrentState();
    } else {
      logger.info("Recovered session valid. Resuming.");
      this.currentState = session;
    }
  }

  private async evaluateCurrentState(): Promise<void> {
    if (this.isPaused) return;

    try {
      const window = await chrome.windows.getLastFocused();
      if (!window || !window.focused || window.id === undefined) {
        return;
      }

      const tabs = await chrome.tabs.query({ active: true, windowId: window.id });
      const firstTab = tabs[0];
      if (firstTab !== undefined) {
        await this.startTracking(firstTab, window.id);
      }
    } catch (error) {
      logger.error("Failed to evaluate current state", error);
    }
  }

  private async startTracking(tab: chrome.tabs.Tab, windowId: number): Promise<void> {
    if (this.isPaused) return;

    const domain = extractHostname(tab.url);
    if (!domain) {
      return; // Ignore invalid or untracked protocols
    }

    if (this.currentState && this.currentState.domain === domain) {
      return; // Already tracking this domain
    }

    const now = Date.now();
    this.currentState = {
      sessionId: crypto.randomUUID(),
      domain,
      tabId: tab.id,
      windowId,
      startTime: now,
      lastUpdated: now
    };

    const snapshot = this.currentState;
    await chrome.storage.local.set({ [ACTIVE_SESSION_KEY]: snapshot });
    this.events.emit("session-started", snapshot);
    logger.debug("Started tracking:", snapshot);
  }

  private async finalizeCurrentSession(
    reason: SessionTerminationReason,
    fallbackEndTime?: number
  ): Promise<void> {
    if (!this.currentState) return;

    const now = Date.now();
    // Use fallback if provided (e.g., recovery failure using last known active time)
    let endTime = fallbackEndTime ?? now;
    
    // Clamp duration to prevent sleep spikes
    if (endTime - this.currentState.startTime > MAX_SESSION_DURATION_MS) {
      logger.warn(`Session duration exceeded max threshold. Clamping.`);
      endTime = this.currentState.startTime + MAX_SESSION_DURATION_MS;
    }

    const durationMs = Math.max(0, endTime - this.currentState.startTime);

    if (durationMs > 0 && this.currentState.domain) {
      const now2 = Date.now();
      const record: ActivityRecord = {
        sessionId: this.currentState.sessionId,
        domain: this.currentState.domain,
        startTime: this.currentState.startTime,
        endTime,
        durationMs,
        terminationReason: reason,
        // Audit metadata — reserved for migration and recovery analysis
        createdAt: now2,
        updatedAt: now2,
        schemaVersion: CURRENT_SCHEMA_VERSION
      };

      // Delegate staging to DrainEngine — decouples engine from storage details
      await stageRecord(record);

      this.events.emit("session-ended", record);
      logger.debug("Finalized session:", record);
    }

    this.currentState = null;
    await chrome.storage.local.remove(ACTIVE_SESSION_KEY);
  }

  // --- Event Listeners ---

  private async onTabActivated(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {
    if (this.isPaused) return;
    logger.debug("Tab activated", activeInfo);
    
    // Ensure window is actually focused
    try {
      const window = await chrome.windows.get(activeInfo.windowId);
      if (!window.focused) return;
      
      const tab = await chrome.tabs.get(activeInfo.tabId);
      
      await this.finalizeCurrentSession("tab-switch");
      await this.startTracking(tab, activeInfo.windowId);
    } catch (e) {
      logger.error("Error in onTabActivated", e);
    }
  }

  private async onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void> {
    if (this.isPaused) return;

    // React immediately if the URL is known to prevent tracking delays.
    // We no longer wait for changeInfo.status === "complete".
    if (tab.url) {
      const newDomain = extractHostname(tab.url);

      if (this.currentState && this.currentState.tabId === tabId) {
        if (newDomain !== this.currentState.domain) {
          logger.debug("Tab URL updated", tabId, tab.url);
          await this.finalizeCurrentSession("url-change");
          await this.startTracking(tab, tab.windowId);
        }
      } else if (!this.currentState && tab.active && newDomain) {
        // Handle transitions from untracked pages (e.g., chrome://newtab)
        // to tracked pages while the tab remains active.
        try {
          const window = await chrome.windows.get(tab.windowId);
          if (window.focused) {
            logger.debug("Untracked active tab updated to trackable domain", tabId, tab.url);
            await this.startTracking(tab, tab.windowId);
          }
        } catch (e) {
          logger.error("Error retrieving window state during tab update", e);
        }
      }
    }
  }

  private async onWindowFocusChanged(windowId: number): Promise<void> {
    if (this.isPaused) return;
    logger.debug("Window focus changed", windowId);
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      await this.finalizeCurrentSession("unfocused");
    } else {
      await this.finalizeCurrentSession("unfocused"); // Finalize previous if exists
      await this.evaluateCurrentState();
    }
  }

  private async onIdleStateChanged(state: chrome.idle.IdleState): Promise<void> {
    if (this.isPaused) return;
    logger.debug("Idle state changed", state);
    if (state === "idle" || state === "locked") {
      await this.finalizeCurrentSession("idle");
    } else if (state === "active") {
      await this.evaluateCurrentState();
    }
  }
}
