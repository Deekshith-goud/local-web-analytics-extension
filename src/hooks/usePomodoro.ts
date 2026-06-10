import { useState, useEffect } from "react";
import type { PomodoroState, PomodoroSettings } from "../types/tracking";

export function usePomodoro(activeTab: string) {
  const [pomodoroState, setPomodoroState] = useState<PomodoroState | null>(null);
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettings | null>(null);
  const [focusInput, setFocusInput] = useState<string>("");
  const [breakInput, setBreakInput] = useState<string>("");
  const [isFocusActive, setIsFocusActive] = useState<boolean>(false);
  const [isBreakActive, setIsBreakActive] = useState<boolean>(false);
  const [, setPomodoroTick] = useState(0);

  useEffect(() => {
    if (pomodoroSettings) {
      if (!isFocusActive) {
        setFocusInput(String(Math.floor(pomodoroSettings.focusDurationMs / 60000)));
      }
      if (!isBreakActive) {
        setBreakInput(String(Math.floor(pomodoroSettings.breakDurationMs / 60000)));
      }
    }
  }, [pomodoroSettings, isFocusActive, isBreakActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === "rules" || activeTab === "pomodoro") {
      const fetchPomodoro = () => {
        chrome.runtime.sendMessage({ type: "GET_POMODORO_STATE", version: 1 }, (res) => {
          setPomodoroState(res);
        });
        chrome.runtime.sendMessage({ type: "GET_POMODORO_SETTINGS", version: 1 }, (res) => {
          setPomodoroSettings(res);
        });
      };
      fetchPomodoro();
      interval = setInterval(() => {
        fetchPomodoro();
        setPomodoroTick(t => t + 1);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [activeTab]);

  const handlePomodoroAction = (action: "START_POMODORO" | "PAUSE_POMODORO" | "RESUME_POMODORO" | "STOP_POMODORO", phase?: "focus" | "break") => {
    chrome.runtime.sendMessage({ type: action, version: 1, phase }, (res) => {
      setPomodoroState(res);
    });
  };

  const handlePomodoroSettingToggle = (key: keyof PomodoroSettings) => {
    if (!pomodoroSettings) return;
    const newSettings = { ...pomodoroSettings, [key]: !pomodoroSettings[key] };
    setPomodoroSettings(newSettings);
    chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
  };

  const handlePomodoroDurationChange = (key: 'focusDurationMs' | 'breakDurationMs', minutes: number) => {
    if (!pomodoroSettings || isNaN(minutes) || minutes < 1) return;
    const newSettings = { ...pomodoroSettings, [key]: minutes * 60 * 1000 };
    setPomodoroSettings(newSettings);
    chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
  };

  const handlePomodoroMessageChange = (key: 'customFocusMessage' | 'customBreakMessage', message: string) => {
    if (!pomodoroSettings) return;
    const newSettings = { ...pomodoroSettings, [key]: message };
    setPomodoroSettings(newSettings);
    chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
  };

  const updateSettings = (newSettings: PomodoroSettings) => {
    setPomodoroSettings(newSettings);
    chrome.runtime.sendMessage({ type: "SAVE_POMODORO_SETTINGS", version: 1, settings: newSettings });
  };

  return {
    pomodoroState,
    pomodoroSettings,
    focusInput,
    setFocusInput,
    breakInput,
    setBreakInput,
    isFocusActive,
    setIsFocusActive,
    isBreakActive,
    setIsBreakActive,
    handlePomodoroAction,
    handlePomodoroSettingToggle,
    handlePomodoroDurationChange,
    handlePomodoroMessageChange,
    updateSettings
  };
}
