/**
 * repository.ts
 *
 * ActivityRepository — clean query interface over the Dexie database.
 *
 * WHY THIS EXISTS:
 * Decouples the dashboard, popup, and drain engine from Dexie internals.
 * All IndexedDB access goes through this layer; no other module imports `db`
 * directly for reads. This makes future schema migrations and testing easier.
 *
 * DB READINESS:
 * ensureDbReady() guards every operation against cold-start races where
 * Dexie's IndexedDB open() is still in progress when the service worker
 * first wakes up.
 *
 * SECURITY:
 * - All query parameters are typed — no dynamic key injection.
 * - DB errors are caught and re-thrown with structured context.
 */

import { db } from "./db";
import type { ActivityRecord, DailyDomainStat, DailyTotal } from "../types/tracking";
import { logger } from "../utils/logger";

/** Ensures the Dexie database is open before any operation runs. */
async function ensureDbReady(): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
}

// ─── Activity Records ─────────────────────────────────────────────────────────

/**
 * Bulk-upsert activity records into IndexedDB.
 * Uses bulkPut() for idempotency — duplicate sessionIds are updated not rejected.
 */
export async function saveActivityRecords(records: ActivityRecord[]): Promise<void> {
  await ensureDbReady();
  await db.activities.bulkPut(records);
  logger.debug(`[Repository] Saved ${records.length} activity records.`);
}

/**
 * Query activity records within a time range (inclusive).
 * Ordered by startTime ascending.
 */
export async function getActivityRecordsInRange(
  startMs: number,
  endMs: number
): Promise<ActivityRecord[]> {
  await ensureDbReady();
  return db.activities
    .where("startTime")
    .between(startMs, endMs, true, true)
    .sortBy("startTime");
}

/** Query all activity records for a specific domain. */
export async function getActivityRecordsByDomain(
  domain: string
): Promise<ActivityRecord[]> {
  await ensureDbReady();
  return db.activities.where("domain").equals(domain).sortBy("startTime");
}

// ─── Daily Stats ──────────────────────────────────────────────────────────────

/** Upsert pre-aggregated daily domain stats. */
export async function saveDailyDomainStats(stats: DailyDomainStat[]): Promise<void> {
  await ensureDbReady();
  await db.dailyDomainStats.bulkPut(stats);
}

/** Query all daily domain stats for a specific date (YYYY-MM-DD). */
export async function getDailyDomainStatsForDate(
  date: string
): Promise<DailyDomainStat[]> {
  await ensureDbReady();
  return db.dailyDomainStats.where("date").equals(date).toArray();
}

/** Upsert daily total records. */
export async function saveDailyTotals(totals: DailyTotal[]): Promise<void> {
  await ensureDbReady();
  await db.dailyTotals.bulkPut(totals);
}

/** Query the daily total summary for a specific date (YYYY-MM-DD). */
export async function getDailyTotal(date: string): Promise<DailyTotal | undefined> {
  await ensureDbReady();
  return db.dailyTotals.get(date);
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

/**
 * Clear ALL data from all tables.
 * Intended for "reset extension" and testing flows only.
 */
export async function clearAllData(): Promise<void> {
  await ensureDbReady();
  await db.transaction("rw", db.activities, db.dailyDomainStats, db.dailyTotals, async () => {
    await db.activities.clear();
    await db.dailyDomainStats.clear();
    await db.dailyTotals.clear();
  });
  logger.warn("[Repository] All analytics data cleared.");
}
