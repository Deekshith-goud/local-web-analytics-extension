/**
 * validators.ts
 *
 * Centralized schema validation and sanitization layer.
 * ALL data entering the storage pipeline must pass through these guards.
 *
 * Security rationale:
 * - Prevents database corruption from malformed staging payloads.
 * - Enforces temporal and structural bounds consistently across all modules.
 * - Centralizing prevents validation logic drift across multiple files.
 */

import type { ActivityRecord } from "../types/tracking";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum session duration in ms — matches TrackingEngine clamping. */
const MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/** Minimum plausible session duration (under 100ms is noise). */
const MIN_DURATION_MS = 100;

/** Max retry attempts before a staging record is quarantined. */
export const MAX_DRAIN_RETRY_COUNT = 3;

/** Regex for RFC 4122 UUID v4 format. */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Minimal hostname pattern — at least one dot, no spaces, no paths. */
const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9\-.]{0,253}[a-z0-9])?$/i;

// ─── Validators ───────────────────────────────────────────────────────────────

/** Validates a UUID v4 string. */
export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value);
}

/**
 * Validates a normalized domain hostname.
 * Rejects: empty strings, paths, query params, protocols, IPs with spaces.
 */
export function isValidDomain(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  // Must not contain paths or query strings
  if (value.includes("/") || value.includes("?") || value.includes("#")) return false;
  return DOMAIN_REGEX.test(value);
}

/** Validates a Unix timestamp in milliseconds is a finite positive number. */
export function isValidTimestampMs(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    // Sanity upper bound: timestamps must be within the last 10 years
    value < Date.now() + 1000 * 60 * 60 * 24 * 365 * 10
  );
}

/**
 * Validates a complete ActivityRecord before it is written to IndexedDB.
 * Returns true only if ALL fields pass their respective bounds checks.
 *
 * This is the final gate before any data touches the database.
 */
export function isValidActivityRecord(record: unknown): record is ActivityRecord {
  if (typeof record !== "object" || record === null) return false;

  const r = record as Record<string, unknown>;

  if (!isValidUUID(r["sessionId"])) return false;
  if (!isValidDomain(r["domain"])) return false;
  if (!isValidTimestampMs(r["startTime"])) return false;
  if (!isValidTimestampMs(r["endTime"])) return false;

  // endTime must be after startTime
  if ((r["endTime"] as number) <= (r["startTime"] as number)) return false;

  if (typeof r["durationMs"] !== "number") return false;
  if (!Number.isFinite(r["durationMs"])) return false;
  if (r["durationMs"] < MIN_DURATION_MS) return false;
  if (r["durationMs"] > MAX_DURATION_MS) return false;

  // terminationReason must be a known string value
  const validReasons = new Set([
    "tab-switch",
    "url-change",
    "idle",
    "unfocused",
    "shutdown",
    "recovery-failed"
  ]);
  if (!validReasons.has(r["terminationReason"] as string)) return false;

  // Audit fields
  if (!isValidTimestampMs(r["createdAt"])) return false;
  if (!isValidTimestampMs(r["updatedAt"])) return false;
  if (typeof r["schemaVersion"] !== "number" || r["schemaVersion"] < 1) return false;

  return true;
}
