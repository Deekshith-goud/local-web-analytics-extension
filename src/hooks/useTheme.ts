import { useState, useEffect } from "react";
import type { IconStyleType } from "../components/ui/ScoreIllustration";

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light" | "system">("system");
  const [iconStyle, setIconStyle] = useState<IconStyleType>("minimal");
  const [blobStyle, setBlobStyle] = useState<"glass-dark" | "glass-light" | "brutalist-dark" | "brutalist-light">("glass-dark");
  const [blobEnabled, setBlobEnabled] = useState<boolean>(true);
  const [dailyLimitHours, setDailyLimitHours] = useState<number>(4);

  useEffect(() => {
    chrome.storage.local.get(["theme", "iconStyle", "blobStyle", "blobEnabled", "dailyLimitHours"], (res) => {
      const savedTheme = res.theme || "system";
      const savedIconStyle = res.iconStyle || "minimal";
      const savedBlobStyle = res.blobStyle || "glass-dark";
      const savedBlobEnabled = res.blobEnabled !== undefined ? res.blobEnabled : true;
      const savedDailyLimit = res.dailyLimitHours || 4;
      setTheme(savedTheme);
      setIconStyle(savedIconStyle);
      setBlobStyle(savedBlobStyle);
      setBlobEnabled(savedBlobEnabled);
      setDailyLimitHours(savedDailyLimit);
      applyTheme(savedTheme);
    });
  }, []);

  const applyTheme = (targetTheme: "dark" | "light" | "system") => {
    let active: string;
    if (targetTheme === "system") {
      active = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      active = targetTheme;
    }
    document.documentElement.setAttribute("data-theme", active);
  };

  const handleThemeChange = (newTheme: "dark" | "light" | "system") => {
    setTheme(newTheme);
    chrome.storage.local.set({ theme: newTheme });
    applyTheme(newTheme);
  };

  const handleIconStyleChange = (newStyle: string) => {
    setIconStyle(newStyle as IconStyleType);
    chrome.storage.local.set({ iconStyle: newStyle });
  };

  const handleBlobStyleChange = (newStyle: string) => {
    setBlobStyle(newStyle as "glass-dark" | "glass-light" | "brutalist-dark" | "brutalist-light");
    chrome.storage.local.set({ blobStyle: newStyle });
  };

  const handleBlobEnabledChange = (enabled: boolean) => {
    setBlobEnabled(enabled);
    chrome.storage.local.set({ blobEnabled: enabled });
  };

  const handleDailyLimitChange = (hours: number) => {
    setDailyLimitHours(hours);
    chrome.storage.local.set({ dailyLimitHours: hours });
  };

  // Apply Detox Mode to the Dashboard
  useEffect(() => {
    const updateDetoxStyle = (enabled: boolean) => {
      if (enabled) {
        document.documentElement.style.setProperty('filter', 'grayscale(100%)', 'important');
        document.documentElement.style.setProperty('transition', 'filter 0.8s ease-in-out', 'important');
      } else {
        document.documentElement.style.removeProperty('filter');
        document.documentElement.style.removeProperty('transition');
      }
    };

    chrome.storage.local.get(["isDetoxModeEnabled"], (res) => {
      updateDetoxStyle(!!res.isDetoxModeEnabled);
    });

    const handleStorage = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && changes.isDetoxModeEnabled) {
        updateDetoxStyle(changes.isDetoxModeEnabled.newValue);
      }
    };
    chrome.storage.onChanged.addListener(handleStorage);
    return () => chrome.storage.onChanged.removeListener(handleStorage);
  }, []);

  // Keep theme updated if system scheme changes and setting is system
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [theme]);

  return {
    theme,
    iconStyle,
    blobStyle,
    blobEnabled,
    dailyLimitHours,
    handleThemeChange,
    handleIconStyleChange,
    handleBlobStyleChange,
    handleBlobEnabledChange,
    handleDailyLimitChange
  };
}
