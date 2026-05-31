import { PomodoroState, PomodoroSettings } from "../types/tracking";
import { logger } from "../utils/logger";

const POMODORO_STATE_KEY = "pomodoro_state";
const POMODORO_SETTINGS_KEY = "pomodoro_settings";
const ALARM_NAME = "pomodoro_alarm";

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusDurationMs: 25 * 60 * 1000,
  breakDurationMs: 5 * 60 * 1000,
  longBreakDurationMs: 15 * 60 * 1000,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
  soundId: 'beep',
  notificationEnabled: true,
  customFocusMessage: "",
  customBreakMessage: ""
};

export class PomodoroEngine {
  private currentState: PomodoroState = {
    status: "idle",
    startTime: 0,
    durationMs: 0
  };

  private currentSettings: PomodoroSettings = DEFAULT_POMODORO_SETTINGS;

  public async initialize(): Promise<void> {
    const data = await chrome.storage.local.get([POMODORO_STATE_KEY, POMODORO_SETTINGS_KEY]);
    if (data[POMODORO_SETTINGS_KEY]) {
      this.currentSettings = { ...DEFAULT_POMODORO_SETTINGS, ...data[POMODORO_SETTINGS_KEY] };
    }
    if (data[POMODORO_STATE_KEY]) {
      this.currentState = data[POMODORO_STATE_KEY];
      // If we wake up and there's an active timer, check if it expired while worker was dead
      if (this.currentState.status !== "idle" && !this.currentState.pausedTimeRemaining) {
        const elapsed = Date.now() - this.currentState.startTime;
        if (elapsed >= this.currentState.durationMs) {
          // Timer expired while worker was suspended.
          await this.handleTimerComplete();
        }
      }
    }
    
    // Listen for alarms
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === ALARM_NAME) {
        await this.handleTimerComplete();
      }
    });
  }

  public async getSettings(): Promise<PomodoroSettings> {
    return this.currentSettings;
  }

  public async saveSettings(settings: PomodoroSettings): Promise<void> {
    this.currentSettings = settings;
    await chrome.storage.local.set({ [POMODORO_SETTINGS_KEY]: settings });
  }

  public async getState(): Promise<PomodoroState> {
    // Return a fresh calculation if active
    if (this.currentState.status !== "idle" && !this.currentState.pausedTimeRemaining) {
      const elapsed = Date.now() - this.currentState.startTime;
      if (elapsed >= this.currentState.durationMs) {
        // Just in case we query exactly when it's done before alarm fires
        await this.handleTimerComplete();
      }
    }
    return this.currentState;
  }

  public async startTimer(phase: "focus" | "break"): Promise<PomodoroState> {
    let duration = phase === "focus" ? this.currentSettings.focusDurationMs : this.currentSettings.breakDurationMs;
    duration = Math.max(1000, duration || 60000);
    
    this.currentState = {
      status: phase,
      startTime: Date.now(),
      durationMs: duration
    };
    await this.persistState();
    
    await chrome.alarms.create(ALARM_NAME, { when: Date.now() + duration });
    logger.info(`[Pomodoro] Started timer for phase: ${phase} with duration: ${duration}ms`);
    return this.currentState;
  }

  public async pauseTimer(): Promise<PomodoroState> {
    if (this.currentState.status === "idle" || this.currentState.pausedTimeRemaining) {
      return this.currentState;
    }
    
    const elapsed = Date.now() - this.currentState.startTime;
    const remaining = Math.max(0, this.currentState.durationMs - elapsed);
    
    this.currentState.pausedTimeRemaining = remaining;
    await this.persistState();
    
    // Clear alarm
    await chrome.alarms.clear(ALARM_NAME);
    logger.info(`[Pomodoro] Paused timer. ${remaining}ms remaining.`);
    return this.currentState;
  }

  public async resumeTimer(): Promise<PomodoroState> {
    if (this.currentState.status === "idle" || !this.currentState.pausedTimeRemaining) {
      return this.currentState;
    }
    
    const remaining = this.currentState.pausedTimeRemaining;
    this.currentState.startTime = Date.now() - (this.currentState.durationMs - remaining);
    delete this.currentState.pausedTimeRemaining;
    
    await this.persistState();
    
    await chrome.alarms.create(ALARM_NAME, { when: Date.now() + remaining });
    logger.info(`[Pomodoro] Resumed timer. ${remaining}ms remaining.`);
    return this.currentState;
  }

  public async stopTimer(): Promise<PomodoroState> {
    this.currentState = {
      status: "idle",
      startTime: 0,
      durationMs: 0
    };
    await this.persistState();
    await chrome.alarms.clear(ALARM_NAME);
    logger.info(`[Pomodoro] Stopped timer.`);
    return this.currentState;
  }

  private async persistState(): Promise<void> {
    await chrome.storage.local.set({ [POMODORO_STATE_KEY]: this.currentState });
  }

  private async handleTimerComplete(): Promise<void> {
    if (this.currentState.status === "idle") return;
    
    // SAFEGUARD: Prevent double-execution race conditions.
    // If handleTimerComplete is called within 2 seconds of the phase starting, it's a ghost-fire.
    const elapsed = Date.now() - this.currentState.startTime;
    if (elapsed < 2000) { 
      logger.info(`[Pomodoro] Safely ignored duplicate timer completion event. (elapsed: ${elapsed}ms)`);
      return;
    }
    
    const completedPhase = this.currentState.status;
    logger.info(`[Pomodoro] Timer complete for phase: ${completedPhase}`);
    
    // Auto-advance logic
    const nextPhase = completedPhase === "focus" ? "break" : "focus";
    let nextDuration = nextPhase === "focus" ? this.currentSettings.focusDurationMs : this.currentSettings.breakDurationMs;
    
    // Fallback safeguard if user somehow saved a 0 duration previously
    nextDuration = Math.max(1000, nextDuration || 60000);
    
    this.currentState = {
      status: nextPhase,
      startTime: Date.now(),
      durationMs: nextDuration
    };
    await this.persistState();
    
    await chrome.alarms.create(ALARM_NAME, { when: Date.now() + nextDuration });
    logger.info(`[Pomodoro] Auto-started next phase: ${nextPhase} for ${nextDuration}ms`);
    
    await this.triggerNotification(completedPhase);
  }

  private async triggerNotification(phase: string): Promise<void> {
    const defaultFocusMessage = "Great job! Time for a short break.";
    const defaultBreakMessage = "Time to get back to focus.";
    
    // Forcefully sync from storage right before firing to absolutely guarantee no memory desync
    const data = await chrome.storage.local.get(POMODORO_SETTINGS_KEY);
    const freshSettings = data[POMODORO_SETTINGS_KEY] 
      ? { ...this.currentSettings, ...data[POMODORO_SETTINGS_KEY] }
      : this.currentSettings;
      
    this.currentSettings = freshSettings;
    
    logger.info(`[Pomodoro] triggerNotification called for phase: ${phase}. currentSettings =`, JSON.stringify(this.currentSettings));
    
    const title = phase === "focus" ? "Focus Session Complete!" : "Break Time Over!";
    const message = phase === "focus" 
      ? (freshSettings.customFocusMessage || defaultFocusMessage)
      : (freshSettings.customBreakMessage || defaultBreakMessage);
      
    logger.info(`[Pomodoro] Final notification message resolved to: ${message}`);
    
    if (freshSettings.notificationEnabled) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, {
              type: "SHOW_POMODORO_NOTIFICATION",
              version: 1,
              phase,
              title,
              message
            }).catch(err => {
              logger.error("[Pomodoro] Could not send SHOW_POMODORO_NOTIFICATION to tab", tab.id, err);
            });
          }
        }
      });
    }

    if (freshSettings.soundEnabled) {
      try {
        // In MV3 service workers, we cannot play audio directly using HTMLAudioElement.
        // We must use offscreen document.
        const hasOffscreen = await chrome.offscreen.hasDocument();
        if (!hasOffscreen) {
          await chrome.offscreen.createDocument({
            url: "tabs/offscreen.html",
            reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
            justification: "Play Pomodoro timer completion sound"
          });
        }
        
        chrome.runtime.sendMessage({
          type: "PLAY_SOUND",
          version: 1,
          target: "offscreen",
          soundId: freshSettings.soundId || 'beep'
        }).catch(err => {
            logger.error("[Pomodoro] Could not send PLAY_SOUND to offscreen", err);
        });
      } catch (err) {
        logger.error("[Pomodoro] Failed to create offscreen document for audio", err);
      }
    }
  }
}

export const pomodoroEngine = new PomodoroEngine();
