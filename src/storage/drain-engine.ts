/**
 * drain-engine.ts
 *
 * Staging Drain Engine — flushes chrome.storage.local staging records to IndexedDB.
 *
 * ARCHITECTURE (Write-Ahead Log pattern):
 * 1. TrackingEngine writes each finalized ActivityRecord to a staging key
 *    `staging:<timestamp>:<sessionId>` in chrome.storage.local.
 * 2. It also appends that key to a `staging_index` array (via StorageCoordinator
 *    to prevent race conditions).
 * 3. DrainEngine reads ONLY the keys in staging_index (no full scans).
 * 4. Records pass through the centralized validator before DB insertion.
 * 5. Valid records are bulk-inserted via Dexie's idempotent bulkPut().
 * 6. Successfully written keys are deleted from storage and removed from staging_index.
 * 7. Failed records increment their retryCount. After MAX_DRAIN_RETRY_COUNT failures,
 *    they are quarantined under `quarantine:<sessionId>` and removed from the
 *    active pipeline to prevent infinite loops.
 *
 * IDEMPOTENCY:
 * If the worker is suspended after bulkPut but before key deletion, the next
 * drain run will re-attempt those records. Since sessionId is a unique primary
 * key (&sessionId), the second bulkPut is a silent upsert — no duplicates.
 *
 * CONCURRENCY SAFETY:
 * All reads/writes to staging_index are serialized through StorageCoordinator.
 *
 * PERFORMANCE:
 * - Drain only reads explicitly indexed keys (no get(null) scans).
 * - Records are inserted in a single bulk transaction.
 * - A drain guard flag prevents overlapping drain runs.
 */

import { saveActivityRecords } from "./repository";
import { storageCoordinator } from "./storage-coordinator";
import { isValidActivityRecord, MAX_DRAIN_RETRY_COUNT } from "../security/validators";
import { logger } from "../utils/logger";
import type { ActivityRecord } from "../types/tracking";

// ─── Storage Key Constants ─────────────────────────────────────────────────────

/** Index of pending staging keys. Managed exclusively by StorageCoordinator. */
export const STAGING_INDEX_KEY = "staging_index" as const;

/** Prefix for all staging record keys. */
const STAGING_KEY_PREFIX = "staging:" as const;

/** Prefix for quarantined (poison-pill) records. */
const QUARANTINE_KEY_PREFIX = "quarantine:" as const;

// ─── State ────────────────────────────────────────────────────────────────────

/** Guards against concurrent drain runs if MV3 triggers wakeup + session-end simultaneously. */
let isDraining = false;

// ─── Public: Stage a Record ───────────────────────────────────────────────────

/**
 * Atomically stage a finalized ActivityRecord.
 * Writes the record and appends its key to staging_index via the coordinator.
 * Called by TrackingEngine.finalizeCurrentSession().
 */
export async function stageRecord(record: ActivityRecord): Promise<void> {
  const stagingKey = `${STAGING_KEY_PREFIX}${record.endTime}:${record.sessionId}`;

  await storageCoordinator.enqueue(async () => {
    // Read current index
    const data = await chrome.storage.local.get(STAGING_INDEX_KEY);
    const index: string[] = (data[STAGING_INDEX_KEY] as string[]) ?? [];

    // Write record + updated index atomically
    await chrome.storage.local.set({
      [stagingKey]: record,
      [STAGING_INDEX_KEY]: [...index, stagingKey]
    });
  });

  logger.debug(`[DrainEngine] Staged record: ${stagingKey}`);
}

// ─── Public: Drain Staging to IndexedDB ──────────────────────────────────────

/**
 * Drains all pending staging records into IndexedDB.
 * Safe to call on startup, on session-end, and after wakeup.
 * Reentrancy-guarded: concurrent calls are silently skipped.
 */
export async function drainStaging(): Promise<void> {
  if (isDraining) {
    logger.debug("[DrainEngine] Drain already in progress. Skipping.");
    return;
  }

  isDraining = true;
  try {
    await _runDrainCycle();
  } finally {
    isDraining = false;
  }
}

// ─── Internal Drain Logic ─────────────────────────────────────────────────────

async function _runDrainCycle(): Promise<void> {
  // Fetch the index under the coordinator lock so we get a consistent snapshot
  const stagingKeys = await storageCoordinator.enqueue(async () => {
    const data = await chrome.storage.local.get(STAGING_INDEX_KEY);
    return (data[STAGING_INDEX_KEY] as string[]) ?? [];
  });

  if (stagingKeys.length === 0) {
    logger.debug("[DrainEngine] No staged records to drain.");
    return;
  }

  logger.info(`[DrainEngine] Draining ${stagingKeys.length} staged records.`);

  // Fetch only the exactly indexed keys — no global scan
  const rawData = await chrome.storage.local.get(stagingKeys);

  const valid: ActivityRecord[] = [];
  const keysToDelete: string[] = [];
  const retryUpdates: Record<string, ActivityRecord> = {};
  const quarantineWrites: Record<string, ActivityRecord> = {};
  const keysToQuarantine: string[] = [];

  const now = Date.now();

  for (const key of stagingKeys) {
    const raw = rawData[key];

    // Key missing from storage (already deleted or never written)
    if (raw === undefined) {
      keysToDelete.push(key);
      continue;
    }

    if (!isValidActivityRecord(raw)) {
      logger.warn(`[DrainEngine] Invalid record at key: ${key}`, raw);
      // Treat invalid-format records as immediately quarantine-eligible
      keysToQuarantine.push(key);
      quarantineWrites[`${QUARANTINE_KEY_PREFIX}${(raw as Record<string, unknown>)["sessionId"] ?? key}`] = raw as ActivityRecord;
      continue;
    }

    // Check retry count for poison-pill detection
    const retryCount = raw.retryCount ?? 0;
    if (retryCount >= MAX_DRAIN_RETRY_COUNT) {
      logger.warn(`[DrainEngine] Record exceeded retry limit. Quarantining: ${key}`);
      keysToQuarantine.push(key);
      quarantineWrites[`${QUARANTINE_KEY_PREFIX}${raw.sessionId}`] = raw;
      continue;
    }

    // Mark as pending valid write
    valid.push(raw);
    keysToDelete.push(key);

    // Update retry metadata to track this attempt
    retryUpdates[key] = { ...raw, retryCount: retryCount + 1, lastAttempt: now };
  }

  // If we have valid records, attempt the bulk DB write
  if (valid.length > 0) {
    try {
      await saveActivityRecords(valid);
      logger.info(`[DrainEngine] Committed ${valid.length} records to IndexedDB.`);
    } catch (error) {
      logger.error("[DrainEngine] Bulk insert failed. Records will be retried.", error);

      // Persist incremented retry counts back to staging — don't delete these keys
      if (Object.keys(retryUpdates).length > 0) {
        await chrome.storage.local.set(retryUpdates);
      }
      // Still clean up quarantined records below
      keysToDelete.length = 0; // Cancel key deletion for valid records
    }
  }

  // Atomically update index: remove processed and quarantined keys
  const processedKeys = new Set([...keysToDelete, ...keysToQuarantine]);

  await storageCoordinator.enqueue(async () => {
    const data = await chrome.storage.local.get(STAGING_INDEX_KEY);
    const currentIndex: string[] = (data[STAGING_INDEX_KEY] as string[]) ?? [];
    const updatedIndex = currentIndex.filter((k) => !processedKeys.has(k));

    const updatePayload: Record<string, unknown> = {
      [STAGING_INDEX_KEY]: updatedIndex,
      ...quarantineWrites
    };

    await chrome.storage.local.set(updatePayload);

    if (keysToDelete.length > 0) {
      await chrome.storage.local.remove(keysToDelete);
    }
    if (keysToQuarantine.length > 0) {
      await chrome.storage.local.remove(keysToQuarantine);
    }
  });

  logger.debug(
    `[DrainEngine] Cycle complete. Written: ${valid.length}, Quarantined: ${keysToQuarantine.length}`
  );
}
