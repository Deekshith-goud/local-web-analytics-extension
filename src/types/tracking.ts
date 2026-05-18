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

// ─── Phase 4 & 5 Discriminated Message Protocol ───────────────────────────────

export type RuntimeMessage =
  | { type: "GET_ACTIVE_SESSION"; version: 1 }
  | { type: "GET_TODAY_STATS"; version: 1 }
  | { type: "GET_POPUP_SNAPSHOT"; version: 1 }
  | { type: "GET_TRACKING_STATUS"; version: 1 }
  | { type: "TOGGLE_TRACKING"; version: 1; paused: boolean };

export interface ActiveSessionResponse {
  activeSession: {
    domain: string;
    startTime: number;
  } | null;
}

export interface TodayStatsResponse {
  activeSession: {
    domain: string;
    startTime: number;
  } | null;
  totalDurationMs: number;
  uniqueDomainsCount: number;
  topDomains: Array<{
    domain: string;
    durationMs: number;
  }>;
}

export interface PopupSnapshotResponse {
  trackingPaused: boolean;
  activeSession: {
    domain: string;
    startTime: number;
  } | null;
  todayTotals: {
    totalDurationMs: number;
    totalVisits: number;
    uniqueDomainsCount: number;
  };
  topDomains: Array<{
    domain: string;
    durationMs: number;
  }>;
  snapshotGeneratedAt: number; // Sync validation & stale prevention
}

// ─── Floating Blob UI State ──────────────────────────────────────────────────

export type AnchorCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface BlobUIState {
  anchorCorner: AnchorCorner;
  offsetX: number; // Offset from horizontal anchor edge
  offsetY: number; // Offset from vertical anchor edge
  isCollapsed: boolean;
}
