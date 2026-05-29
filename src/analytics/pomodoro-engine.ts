import { PomodoroState, PomodoroSettings } from "../types/tracking";
import { logger } from "../utils/logger";

const POMODORO_STATE_KEY = "pomodoro_state";
const POMODORO_SETTINGS_KEY = "pomodoro_settings";
const ALARM_NAME = "pomodoro_alarm";

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusDurationMs: 25 * 60 * 1000,
  breakDurationMs: 5 * 60 * 1000,
  soundEnabled: true,
  notificationEnabled: true
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
    const duration = phase === "focus" ? this.currentSettings.focusDurationMs : this.currentSettings.breakDurationMs;
    this.currentState = {
      status: phase,
      startTime: Date.now(),
      durationMs: duration
    };
    await this.persistState();
    
    // Set alarm
    await chrome.alarms.create(ALARM_NAME, { when: this.currentState.startTime + duration });
    logger.info(`[Pomodoro] Started ${phase} timer for ${duration}ms`);
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
    
    const completedPhase = this.currentState.status;
    logger.info(`[Pomodoro] Timer complete for phase: ${completedPhase}`);
    
    this.currentState = {
      status: "idle",
      startTime: 0,
      durationMs: 0
    };
    await this.persistState();
    
    await this.triggerNotification(completedPhase);
  }

  private async triggerNotification(phase: string): Promise<void> {
    const title = phase === "focus" ? "Focus Session Complete!" : "Break Time Over!";
    const message = phase === "focus" ? "Great job! Time for a short break." : "Time to get back to focus.";
    
    if (this.currentSettings.notificationEnabled) {
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

    if (this.currentSettings.soundEnabled) {
      try {
        // In MV3 service workers, we cannot play audio directly using HTMLAudioElement.
        // We must use offscreen document.
        const offscreenUrl = "offscreen.html"; // We will create this
        const exists = await chrome.offscreen.hasDocument();
        if (!exists) {
          await chrome.offscreen.createDocument({
            url: offscreenUrl,
            reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
            justification: "Play Pomodoro timer completion sound"
          });
        }
        
        chrome.runtime.sendMessage({
          type: "PLAY_SOUND",
          target: "offscreen"
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
