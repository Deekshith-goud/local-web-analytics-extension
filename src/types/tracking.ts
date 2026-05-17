/**
 * tracking.ts
 *
 * Core domain types for the tracking engine and storage layer.
 * All types are immutable-first and migration-aware (schemaVersion, createdAt, updatedAt).
 */

export type SessionTerminationReason =
  | "tab-switch"
  | "url-change"
  | "idle"
  | "unfocused"
  | "shutdown"
  | "recovery-failed";

/** In-memory ephemeral tracking state for the currently active tab. */
export interface ActiveSession {
  sessionId: string;
  domain: string;
  tabId: number | undefined;
  windowId: number | undefined;
  startTime: number;
  lastUpdated: number;
}

/**
 * Permanent record written to IndexedDB once a session ends.
 * Includes audit metadata for migration safety, debugging, and future sync.
 */
export interface ActivityRecord {
  // Core identity
  sessionId: string;
  domain: string;

  // Timing
  startTime: number;
  endTime: number;
  durationMs: number;

  // Classification
  terminationReason: SessionTerminationReason;

  // Audit metadata (reserved for migrations and recovery analysis)
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;

  // Staging drain metadata (used by DrainEngine for poison-pill prevention)
  retryCount?: number;
  lastAttempt?: number;
}

/** Pre-aggregated daily stats per domain — enables fast dashboard queries. */
export interface DailyDomainStat {
  date: string;           // YYYY-MM-DD
  domain: string;
  durationMs: number;
  visitCount: number;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

/** Pre-aggregated daily totals — single-row summary per day for popup/blob. */
export interface DailyTotal {
  date: string;           // YYYY-MM-DD
  totalDurationMs: number;
  totalVisits: number;
  uniqueDomainsCount: number;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
}

export type TrackingState = "active" | "idle" | "unfocused";

export interface TrackingEvents {
  "session-started": (session: ActiveSession) => void;
  "session-ended": (record: ActivityRecord) => void;
  "idle-state-changed": (state: chrome.idle.IdleState) => void;
}
