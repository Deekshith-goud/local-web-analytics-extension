/**
 * selectors/queries.ts
 *
 * IndexedDB Range Queries.
 * Provides clean read-only database range retrieval.
 * Leverages indices on date fields to prevent full table scans.
 */

import { db } from "../../storage/db";
import type { DailyTotal, DailyDomainStat } from "../../types/tracking";

/** Ensures the database is open before executing range queries. */
async function ensureDbReady(): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
}

/**
 * Retrieves daily totals within a local YYYY-MM-DD date range (inclusive).
 * Uses indexed date query.
 */
export async function getDailyTotalsRange(
  startDateStr: string,
  endDateStr: string
): Promise<DailyTotal[]> {
  await ensureDbReady();
  return db.dailyTotals
    .where("date")
    .between(startDateStr, endDateStr, true, true)
    .toArray();
}

/**
 * Retrieves daily domain statistics within a local YYYY-MM-DD date range (inclusive).
 * Uses indexed date query.
 */
export async function getDailyDomainStatsRange(
  startDateStr: string,
  endDateStr: string
): Promise<DailyDomainStat[]> {
  await ensureDbReady();
  return db.dailyDomainStats
    .where("date")
    .between(startDateStr, endDateStr, true, true)
    .toArray();
}
