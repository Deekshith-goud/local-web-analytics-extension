/**
 * background.ts
 *
 * Manifest V3 background service worker entry point.
 * Instantiates the TrackingEngine and wires lifecycle events.
 * Handles clean shutdown to avoid phantom sessions on suspension.
 * Integrates the staging Drain Engine with debounced flushing strategy.
 * Handles secure, versioned messaging from Content Script UIs.
 */

import { TrackingEngine } from "./analytics/tracking-engine";
import { drainStaging } from "./storage/drain-engine";
import { getActivityRecordsInRange } from "./storage/repository";
import type {
  RuntimeMessage,
  ActiveSessionResponse,
  TodayStatsResponse
} from "./types/tracking";
import { logger } from "./utils/logger";

export {};

const engine = new TrackingEngine();

// ─── Debounced Drain ──────────────────────────────────────────────────────────

const DRAIN_DEBOUNCE_MS = 5_000;
let drainTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDrain(): void {
  if (drainTimer !== null) {
    clearTimeout(drainTimer);
  }
  drainTimer = setTimeout(() => {
    drainTimer = null;
    drainStaging().catch((e) => logger.error("Scheduled drain failed:", e));
  }, DRAIN_DEBOUNCE_MS);
}

// ─── Engine + Drain Lifecycle ─────────────────────────────────────────────────

async function initializeAndDrain(): Promise<void> {
  await engine.initialize();
  // Immediate drain on wakeup catches records staged before last suspension
  await drainStaging();
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  logger.info("Extension installed. Initializing tracking engine...");
  await initializeAndDrain();
});

// Re-initialize on browser startup
chrome.runtime.onStartup.addListener(async () => {
  logger.info("Browser started. Initializing tracking engine...");
  await initializeAndDrain();
});

// Initialize immediately when the service worker starts (MV3 quirk:
// onInstalled/onStartup may not fire on worker wake-ups after suspension)
(async () => {
  logger.info("Service worker awoke. Initializing tracking engine...");
  await initializeAndDrain();
})();

// Schedule a debounced drain whenever a session ends
engine.events.on("session-ended", () => {
  scheduleDrain();
});

// Finalize active session gracefully when the worker is about to be suspended
chrome.runtime.onSuspend.addListener(() => {
  logger.info("Service worker suspending. Finalizing active session...");
  // Clear the debounce timer — suspension cancels any pending scheduled drain
  if (drainTimer !== null) {
    clearTimeout(drainTimer);
    drainTimer = null;
  }
  engine.handleShutdown();
});

// ─── Live Aggregate Aggregation ───────────────────────────────────────────────

/**
 * Calculates live daily aggregates by merging persisted database records
 * with the in-memory active session from the tracking engine.
 *
 * RATIONALE:
 * Doing this in the background ensures the content script has zero direct
 * DB read access (least privilege) and stays extremely lightweight.
 */
async function getLiveTodayStats(): Promise<TodayStatsResponse> {
  const now = Date.now();
  const today = new Date();
  // Local midnight today
  const startOfDayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // 1. Fetch all completed records for today from DB
  const records = await getActivityRecordsInRange(startOfDayMs, now);

  // 2. Query in-memory live tracking state
  const active = engine.getActiveSession();
  const activeSessionPayload = active
    ? { domain: active.domain, startTime: active.startTime }
    : null;

  // 3. Build aggregated structures
  let totalDurationMs = 0;
  const domainDurations: Record<string, number> = {};
  const uniqueDomains = new Set<string>();

  // Add DB records
  for (const r of records) {
    totalDurationMs += r.durationMs;
    uniqueDomains.add(r.domain);
    domainDurations[r.domain] = (domainDurations[r.domain] ?? 0) + r.durationMs;
  }

  // Add live active tracking session duration
  if (active) {
    const elapsed = Math.max(0, now - active.startTime);
    totalDurationMs += elapsed;
    uniqueDomains.add(active.domain);
    domainDurations[active.domain] = (domainDurations[active.domain] ?? 0) + elapsed;
  }

  // Map to list, sort descending by duration
  const topDomains = Object.entries(domainDurations)
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5); // Limit to top 5 for the floating blob UI

  return {
    activeSession: activeSessionPayload,
    totalDurationMs,
    uniqueDomainsCount: uniqueDomains.size,
    topDomains
  };
}

// ─── Secure Runtime Message Passing ───────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Security Check: Reject untyped or loose payloads
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const msg = message as Partial<RuntimeMessage>;

  // 2. Version Check: enforce strict compatibility
  if (msg.version !== 1) {
    logger.warn(`[Background] Rejected message with invalid protocol version: ${msg.version}`);
    return false;
  }

  // 3. Command Route
  if (msg.type === "GET_ACTIVE_SESSION") {
    const active = engine.getActiveSession();
    const response: ActiveSessionResponse = {
      activeSession: active ? { domain: active.domain, startTime: active.startTime } : null
    };
    sendResponse(response);
    return false; // Synchronous response
  }

  if (msg.type === "GET_TODAY_STATS") {
    // Aggregation uses async DB call — return true to signal asynchronous response
    getLiveTodayStats()
      .then((stats) => {
        sendResponse(stats);
      })
      .catch((err) => {
        logger.error("[Background] Failed to aggregate live today stats", err);
        // Fail-safe empty stats payload
        sendResponse({
          activeSession: null,
          totalDurationMs: 0,
          uniqueDomainsCount: 0,
          topDomains: []
        } as TodayStatsResponse);
      });
    return true; // Asynchronous reply
  }

  return false;
});
