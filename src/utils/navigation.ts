/**
 * navigation.ts
 *
 * Centralized extension navigation and tab routing utilities.
 */

import { logger } from "./logger";

/**
 * Opens the local analytics dashboard inside a new browser tab.
 * Uses Plasmo tab routing compiling to tabs/dashboard.html.
 */
export function openDashboard(): void {
  const targetUrl = chrome.runtime.getURL("tabs/dashboard.html");
  
  chrome.tabs.create({ url: targetUrl }, (tab) => {
    if (chrome.runtime.lastError) {
      logger.error("Failed to open dashboard tab:", chrome.runtime.lastError.message);
      return;
    }
    logger.info("Successfully opened dashboard tab with ID:", tab.id);
  });
}
