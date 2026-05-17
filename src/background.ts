/**
 * background.ts
 *
 * Manifest V3 background service worker entry point.
 * Instantiates the TrackingEngine and wires lifecycle events.
 * Handles clean shutdown to avoid phantom sessions on suspension.
 * Integrates the staging Drain Engine with debounced flushing strategy.
 */

import { TrackingEngine } from "./analytics/tracking-engine";
import { drainStaging } from "./storage/drain-engine";
import { logger } from "./utils/logger";

export {};

const engine = new TrackingEngine();

// ─── Debounced Drain ──────────────────────────────────────────────────────────

/**
 * Debounced drain wrapper.
 *
 * WHY DEBOUNCED:
 * Rapid tab switches produce many session-ended events within seconds.
 * Draining on every single event would thrash IndexedDB unnecessarily.
 * We batch these into a single drain run after 5s of inactivity.
 *
 * IMPORTANT MV3 NOTE:
 * The debounce timer can be lost if the service worker is suspended before
 * it fires. This is acceptable — the startup drain (below) will always
 * catch any un-drained records when the worker wakes up again.
 */
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
