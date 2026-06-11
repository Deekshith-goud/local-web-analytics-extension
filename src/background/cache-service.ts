import { logger } from "../utils/logger";
import type { HistoricalStatsResponse } from "../types/tracking";

export const SNAPSHOT_SCHEMA_VERSION = 1;
const MAX_HISTORICAL_CACHE_ENTRIES = 30;

export class RingBuffer<T> {
  private items: T[] = [];
  constructor(private limit: number) {}

  public push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.limit) {
      this.items.shift();
    }
  }

  public get(): T[] {
    return [...this.items];
  }
}

export interface HistoricalCacheEntry {
  key: string;
  generatedAt: number;
  lastAccessedAt: number;
  payload: HistoricalStatsResponse;
  estimatedBytes: number;
  schemaVersion: number;
}

export interface CacheMetricEvent {
  timestamp: number;
  type: "hit" | "miss" | "invalidation";
  cacheType: "today" | "historical";
  key: string;
  computeTimeMs?: number;
  estimatedBytes?: number;
}

export interface MaintenanceMetricEvent {
  timestamp: number;
  durationMs: number;
  rowsDeleted: number;
  batchesExecuted: number;
  success: boolean;
}

export const cacheEventsLog = new RingBuffer<CacheMetricEvent>(100);
export const maintenanceEventsLog = new RingBuffer<MaintenanceMetricEvent>(100);

export const cacheMetrics = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  computesCount: 0,
  totalComputeTimeMs: 0
};

let _todaySnapshotCache: {
  date: string;
  todayTotals: { totalDurationMs: number; totalVisits: number; uniqueDomainsCount: number };
  topDomains: Array<{ domain: string; durationMs: number }>;
} | null = null;

export const historicalSnapshotCache = new Map<string, HistoricalCacheEntry>();

export const inFlightPromises = new Map<string, Promise<HistoricalStatsResponse>>();

export function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const val = (obj as Record<string, unknown>)[prop];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val as object);
    }
  });
  return obj;
}

export function estimatePayloadSize(obj: unknown): number {
  try {
    return JSON.stringify(obj).length * 2;
  } catch {
    return 0;
  }
}

export function invalidateTodayCache(): void {
  logger.debug("[Background] Soft Invalidation: Clearing volatile todaySnapshotCache.");
  _todaySnapshotCache = null;
  cacheMetrics.invalidations += 1;
  cacheEventsLog.push({
    timestamp: Date.now(),
    type: "invalidation",
    cacheType: "today",
    key: "today"
  });
}

export function invalidateAllCaches(): void {
  logger.info("[Background] Hard Invalidation: Purging all cache maps (today & historical).");
  _todaySnapshotCache = null;
  historicalSnapshotCache.clear();
  inFlightPromises.clear();
  cacheMetrics.invalidations += 1;
  cacheEventsLog.push({
    timestamp: Date.now(),
    type: "invalidation",
    cacheType: "historical",
    key: "all"
  });
}

export function getCacheKey(startMs: number, endMs: number, rulesCount: number): string {
  return `v${SNAPSHOT_SCHEMA_VERSION}:m1:r${rulesCount}:${startMs}_${endMs}`;
}

export function setHistoricalCache(key: string, payload: HistoricalStatsResponse): void {
  if (historicalSnapshotCache.size >= MAX_HISTORICAL_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [k, entry] of historicalSnapshotCache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = k;
      }
    }

    if (oldestKey) {
      logger.debug(`[Background] LRU Cache Eviction: Removing oldest cache item '${oldestKey}'.`);
      historicalSnapshotCache.delete(oldestKey);
    }
  }

  const frozenPayload = deepFreeze(payload);
  const estimatedBytes = estimatePayloadSize(frozenPayload);

  historicalSnapshotCache.set(key, {
    key,
    generatedAt: Date.now(),
    lastAccessedAt: Date.now(),
    payload: frozenPayload,
    estimatedBytes,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION
  });
}

export function getTodaySnapshotCache() { return _todaySnapshotCache; }
export function setTodaySnapshotCache(snapshot: unknown) { _todaySnapshotCache = snapshot; }
