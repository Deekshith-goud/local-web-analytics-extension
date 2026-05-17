/**
 * background.ts
 *
 * Manifest V3 background service worker entry point.
 * Instantiates the TrackingEngine and wires lifecycle events.
 * Handles clean shutdown to avoid phantom sessions on suspension.
 */

import { TrackingEngine } from "./analytics/tracking-engine";
import { logger } from "./utils/logger";

export {};

const engine = new TrackingEngine();

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  logger.info("Extension installed. Initializing tracking engine...");
  await engine.initialize();
});

// Re-initialize on browser startup
chrome.runtime.onStartup.addListener(async () => {
  logger.info("Browser started. Initializing tracking engine...");
  await engine.initialize();
});

// Initialize immediately when the service worker starts (MV3 quirk:
// onInstalled/onStartup may not fire on worker wake-ups after suspension)
(async () => {
  logger.info("Service worker awoke. Initializing tracking engine...");
  await engine.initialize();
})();

// Finalize active session gracefully when the worker is about to be suspended
chrome.runtime.onSuspend.addListener(() => {
  logger.info("Service worker suspending. Finalizing active session...");
  // Call the internal shutdown finalizer (exposed for this purpose)
  engine.handleShutdown();
});

