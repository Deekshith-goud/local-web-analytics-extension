/**
 * validators.ts
 *
 * Centralized schema validation and sanitization layer.
 * ALL data entering the storage or communication pipeline must pass through these guards.
 *
 * Security rationale:
 * - Prevents database corruption from malformed staging payloads.
 * - Enforces temporal and structural bounds consistently across all modules.
 * - Enforces context-based capability execution boundaries.
 */

import type { ActivityRecord, RuntimeMessage } from "../types/tracking";

// ─── Constants & Bounds ───────────────────────────────────────────────────────

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

/** Dynamic view safety constraints to prevent overlay styling attacks. */
const MAX_OFFSET_X = 2000;
const MAX_OFFSET_Y = 2000;

/** Strict Runtime Protocol Version Boundary. */
export const SUPPORTED_MESSAGE_VERSION = 1;

// ─── Trusted Surfaces & Capability Routing ────────────────────────────────────

export type ExtensionSurface = "content" | "popup" | "dashboard" | "background" | "unknown";

/**
 * Centrally maps privilege levels for each message type.
 * Deeply frozen to prevent runtime prototype pollution or override attacks.
 */
export const MESSAGE_CAPABILITIES = Object.freeze({
  GET_ACTIVE_SESSION: Object.freeze(["content", "popup", "dashboard"]),
  GET_TODAY_STATS: Object.freeze(["content", "popup", "dashboard"]),
  GET_POPUP_SNAPSHOT: Object.freeze(["popup"]),
  GET_HISTORICAL_STATS: Object.freeze(["dashboard"]),
  GET_CACHE_METRICS: Object.freeze(["dashboard"]),
  GET_TRACKING_STATUS: Object.freeze(["popup", "dashboard"]),
  GET_PRODUCTIVITY_RULES: Object.freeze(["popup", "dashboard"]),
  SAVE_PRODUCTIVITY_RULES: Object.freeze(["dashboard"]),
  RESET_PRODUCTIVITY_RULES: Object.freeze(["dashboard"]),
  TOGGLE_TRACKING: Object.freeze(["popup", "dashboard"]),
  BROADCAST_RULES_UPDATED: Object.freeze(["background", "dashboard"]),
  GET_SECURITY_METRICS: Object.freeze(["dashboard"])
});

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface BlobUIState {
  anchorCorner: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  offsetX: number;
  offsetY: number;
  isCollapsed: boolean;
}

export interface SecurityEvent {
  timestamp: number;
  eventType: string;
  surface: string;
  messageType?: string | undefined;
  reason: string;
}

// ─── Ring Buffer for Telemetry-Free Observability ─────────────────────────────

export class RingBuffer<T> {
  private buffer: T[] = [];
  private pointer = 0;

  constructor(private readonly limit: number) {}

  public push(item: T): void {
    if (this.buffer.length < this.limit) {
      this.buffer.push(item);
    } else {
      this.buffer[this.pointer] = item;
      this.pointer = (this.pointer + 1) % this.limit;
    }
  }

  public get(): T[] {
    if (this.buffer.length < this.limit) {
      return [...this.buffer];
    }
    // Return in correct chronological order (oldest to newest)
    return [
      ...this.buffer.slice(this.pointer),
      ...this.buffer.slice(0, this.pointer)
    ];
  }
}

// ─── Observability Repositories ───────────────────────────────────────────────

/** Local-only validation and capability safety diagnostics metrics. */
export const securityMetrics = {
  invalidBlobStates: 0,
  rejectedMessages: 0,
  malformedPayloads: 0,
  privilegeViolations: 0,
  unknownMessageTypes: 0
};

/** High-fidelity local security events audit trace log (last 50 events). */
export const securityEventsLog = new RingBuffer<SecurityEvent>(50);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Log a security event into the local, non-telemetry Ring Buffer. */
export function logSecurityEvent(
  eventType: string,
  surface: string,
  reason: string,
  messageType?: string
): void {
  securityEventsLog.push({
    timestamp: Date.now(),
    eventType,
    surface,
    messageType,
    reason
  });
}

/** Standardizes execution surfaces based on origin URLs and sender parameters. */
export function deriveSurface(sender: chrome.runtime.MessageSender): ExtensionSurface {
  if (sender.id !== chrome.runtime.id) {
    return "unknown";
  }

  // Webpage content scripts possess an associated active browser tab context
  if (sender.tab !== undefined) {
    return "content";
  }

  const url = sender.url;
  if (!url) {
    return "background";
  }

  if (url.includes("/popup.html")) {
    return "popup";
  }

  // Handle standard option dashboards (/tabs/dashboard.html or options.html)
  if (url.includes("/dashboard.html")) {
    return "dashboard";
  }

  // Classify system service worker context
  if (
    url.includes("/background.js") ||
    url.includes("/background.ts") ||
    url.includes("service-worker.js") ||
    url.includes("_generated_background_page.html")
  ) {
    return "background";
  }

  return "unknown";
}

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
  if (value.includes("/") || value.includes("?") || value.includes("#")) return false;
  return DOMAIN_REGEX.test(value);
}

/** Validates a Unix timestamp in milliseconds is a finite positive number. */
export function isValidTimestampMs(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value < Date.now() + 1000 * 60 * 60 * 24 * 365 * 10
  );
}

/**
 * Validates a complete ActivityRecord before it is written to IndexedDB.
 * Returns true only if ALL fields pass their respective bounds checks.
 */
export function isValidActivityRecord(record: unknown): record is ActivityRecord {
  if (typeof record !== "object" || record === null) return false;

  const r = record as Record<string, unknown>;

  if (!isValidUUID(r["sessionId"])) return false;
  if (!isValidDomain(r["domain"])) return false;
  if (!isValidTimestampMs(r["startTime"])) return false;
  if (!isValidTimestampMs(r["endTime"])) return false;

  if ((r["endTime"] as number) <= (r["startTime"] as number)) return false;

  if (typeof r["durationMs"] !== "number") return false;
  if (!Number.isFinite(r["durationMs"])) return false;
  if (r["durationMs"] < MIN_DURATION_MS) return false;
  if (r["durationMs"] > MAX_DURATION_MS) return false;

  const validReasons = new Set([
    "tab-switch",
    "url-change",
    "idle",
    "unfocused",
    "shutdown",
    "recovery-failed"
  ]);
  if (!validReasons.has(r["terminationReason"] as string)) return false;

  if (!isValidTimestampMs(r["createdAt"])) return false;
  if (!isValidTimestampMs(r["updatedAt"])) return false;
  if (typeof r["schemaVersion"] !== "number" || r["schemaVersion"] < 1) return false;

  return true;
}

/**
 * Validates, clamps coordinates aggressively against viewport bounds,
 * and yields a deeply frozen representation of the Blob UI state.
 */
export function validateBlobUIState(state: unknown): Readonly<BlobUIState> {
  const defaultState: BlobUIState = {
    anchorCorner: "bottom-right",
    offsetX: 24,
    offsetY: 24,
    isCollapsed: true
  };

  if (typeof state !== "object" || state === null) {
    securityMetrics.invalidBlobStates++;
    logSecurityEvent("INVALID_BLOB_STATE", "content", "Payload is not an object. Loaded defaults.");
    return Object.freeze(defaultState);
  }

  const s = state as Record<string, unknown>;
  const corners = new Set(["top-left", "top-right", "bottom-left", "bottom-right"]);

  const anchorCorner =
    typeof s.anchorCorner === "string" && corners.has(s.anchorCorner)
      ? (s.anchorCorner as BlobUIState["anchorCorner"])
      : defaultState.anchorCorner;

  let offsetX = typeof s.offsetX === "number" && Number.isFinite(s.offsetX)
    ? s.offsetX
    : defaultState.offsetX;

  let offsetY = typeof s.offsetY === "number" && Number.isFinite(s.offsetY)
    ? s.offsetY
    : defaultState.offsetY;

  // Enforce dynamic viewport-relative limits with defensive capping
  offsetX = Math.max(0, Math.min(offsetX, MAX_OFFSET_X));
  offsetY = Math.max(0, Math.min(offsetY, MAX_OFFSET_Y));

  const isCollapsed = typeof s.isCollapsed === "boolean"
    ? s.isCollapsed
    : defaultState.isCollapsed;

  const sanitized: BlobUIState = {
    anchorCorner,
    offsetX,
    offsetY,
    isCollapsed
  };

  if (
    anchorCorner !== s.anchorCorner ||
    offsetX !== s.offsetX ||
    offsetY !== s.offsetY ||
    isCollapsed !== s.isCollapsed
  ) {
    securityMetrics.invalidBlobStates++;
    logSecurityEvent(
      "BLOB_STATE_CLAMPED",
      "content",
      `Input state coordinates clamped: (${s.offsetX}, ${s.offsetY}) -> (${offsetX}, ${offsetY})`
    );
  }

  return Object.freeze(sanitized);
}

/**
 * Structurally parses and validates incoming runtime messages.
 * Verifies message signature shape, types, and strict protocol version matches.
 */
export function isRuntimeMessage(payload: unknown): payload is RuntimeMessage {
  if (typeof payload !== "object" || payload === null) {
    securityMetrics.malformedPayloads++;
    return false;
  }

  const msg = payload as Record<string, unknown>;

  if (typeof msg.type !== "string") {
    securityMetrics.malformedPayloads++;
    return false;
  }

  // Verify type matches allowed capability catalog keys
  if (!(msg.type in MESSAGE_CAPABILITIES)) {
    securityMetrics.unknownMessageTypes++;
    return false;
  }

  // Strict version validation check
  if (msg.version !== SUPPORTED_MESSAGE_VERSION) {
    securityMetrics.malformedPayloads++;
    return false;
  }

  // Type-specific field validations
  if (msg.type === "GET_HISTORICAL_STATS") {
    if (typeof msg.startMs !== "number" || typeof msg.endMs !== "number") {
      securityMetrics.malformedPayloads++;
      return false;
    }
  }

  if (msg.type === "TOGGLE_TRACKING") {
    if (typeof msg.paused !== "boolean") {
      securityMetrics.malformedPayloads++;
      return false;
    }
  }

  if (msg.type === "SAVE_PRODUCTIVITY_RULES") {
    if (!Array.isArray(msg.rules)) {
      securityMetrics.malformedPayloads++;
      return false;
    }
  }

  return true;
}
