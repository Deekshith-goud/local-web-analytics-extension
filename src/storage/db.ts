/**
 * db.ts
 *
 * Dexie database definition and singleton for LocalBrowseAnalyticsDB.
 *
 * SCHEMA DESIGN:
 * - activities:        Raw session records. Primary key: &sessionId (unique, enforces idempotency).
 * - dailyDomainStats:  Pre-aggregated per-domain-per-day stats. Compound primary key: [date+domain].
 * - dailyTotals:       Pre-aggregated daily totals. Primary key: &date (unique per calendar day).
 *
 * IDEMPOTENCY:
 * The `&` prefix on sessionId/date keys makes Dexie throw on duplicate inserts.
 * We use bulkPut() (upsert semantics) to handle drain retries safely: a record
 * written twice is harmless — the second write is simply a no-op update.
 *
 * MIGRATION PLAN:
 * Dexie schema upgrades use version(N).stores(). Each version() call only needs
 * to declare the CHANGES. We reserve `schemaVersion`, `createdAt`, `updatedAt`
 * on every table row so future version bumps can migrate data safely.
 *
 * SECURITY:
 * - DB_NAME is a frozen constant — never user-controlled.
 * - No dynamic key paths — all indexed fields are compile-time known.
 * - Runs in the extension's sandboxed IndexedDB origin; inaccessible externally.
 */

import Dexie, { type Table } from "dexie";
import type {
  ActivityRecord,
  DailyDomainStat,
  DailyTotal
} from "../types/tracking";

/** The database name is a frozen constant — never derived from user input. */
const DB_NAME = "LocalBrowseAnalyticsDB" as const;

/** Current schema version — increment on each structural change. */
const SCHEMA_VERSION = 1;

export class LocalBrowseAnalyticsDB extends Dexie {
  activities!: Table<ActivityRecord, string>;
  dailyDomainStats!: Table<DailyDomainStat, [string, string]>;
  dailyTotals!: Table<DailyTotal, string>;

  constructor() {
    super(DB_NAME);

    this.version(SCHEMA_VERSION).stores({
      // & = unique primary key (idempotent bulkPut)
      activities:
        "&sessionId, domain, startTime, endTime, durationMs, terminationReason, createdAt",
      // compound primary key [date+domain] for instant range queries
      dailyDomainStats:
        "[date+domain], date, domain, durationMs, visitCount, updatedAt",
      // & = unique per calendar day
      dailyTotals:
        "&date, totalDurationMs, totalVisits, uniqueDomainsCount, updatedAt"
    });
  }
}

/** Module-level singleton — initialized once per service worker lifecycle. */
export const db = new LocalBrowseAnalyticsDB();
