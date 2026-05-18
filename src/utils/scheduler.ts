/**
 * scheduler.ts
 *
 * Cooperative Yield Scheduler for Local Browse Tracker.
 *
 * WHY THIS EXISTS:
 * During heavy database compaction or aggregation tasks, locking the CPU causes browser stalls,
 * increases message latency, and impacts active window event loop execution.
 * Instead of hard timeouts, cooperativeYield tracks work time.
 * If execution has progressed continuously beyond the specified yieldIntervalMs (16ms / 1 frame),
 * it yields control back to Chrome's event loop via a zero-delay macrotask.
 */

let lastYieldTime = performance.now();

/**
 * Yields control to the main thread event loop cooperatively
 * if the execution block has run continuously longer than `yieldIntervalMs`.
 *
 * @param yieldIntervalMs Maximum time slice in milliseconds before yielding (default: 16ms / 60 FPS frame boundary)
 */
export async function cooperativeYield(yieldIntervalMs: number = 16): Promise<void> {
  const now = performance.now();
  if (now - lastYieldTime > yieldIntervalMs) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    lastYieldTime = performance.now();
  }
}
