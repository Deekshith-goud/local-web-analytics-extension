/**
 * storage-coordinator.ts
 *
 * Serializes all chrome.storage.local mutations through a microtask queue.
 *
 * WHY THIS EXISTS:
 * chrome.storage.local is asynchronous but NOT transactional. During rapid
 * tab switching, multiple concurrent read-modify-write cycles on staging_index
 * can race and produce a stale/corrupted index (session B overwrites session A's
 * append because it read the list before A's write completed).
 *
 * HOW IT WORKS:
 * We maintain a single Promise chain. Every operation that touches shared
 * chrome.storage state is submitted via enqueue(). Each op only starts after
 * the previous resolves. This gives us a serialized, contention-free queue
 * with zero locks and zero blocking — pure microtask chaining.
 *
 * PERFORMANCE:
 * Operations are microtask-queued, not thread-blocked. Overhead is a single
 * Promise.then() per operation — negligible in a MV3 service worker context.
 *
 * SECURITY:
 * No shared mutable state accessible from content scripts.
 * No external API exposure. The coordinator is a module-level singleton.
 */

import { logger } from "../utils/logger";

export class StorageCoordinator {
  // The tail of the promise chain — new operations attach to this.
  private queue: Promise<void> = Promise.resolve();

  /**
   * Enqueue an operation to run sequentially after all prior operations.
   * The operation is type-safe and returns its own result.
   *
   * @param operation - async function to run exclusively
   * @returns the operation's resolved value
   */
  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    // Attach this operation to the end of the chain.
    // Errors are swallowed on the *queue tail* to keep the chain alive,
    // but re-thrown to the *caller* of enqueue().
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const resultPromise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    this.queue = this.queue.then(async () => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        logger.error("[StorageCoordinator] Operation failed", error);
        reject(error);
      }
    });

    return resultPromise;
  }
}

/** Singleton — the single global serializer for all storage mutations. */
export const storageCoordinator = new StorageCoordinator();
