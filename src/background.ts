/**
 * background.ts
 *
 * Manifest V3 background service worker entry point.
 * Instantiates the TrackingEngine and wires lifecycle events.
 * Handles clean shutdown to avoid phantom sessions on suspension.
 * Integrates the staging Drain Engine with debounced flushing strategy.
 * Handles secure, versioned messaging from Content Script UIs.
 */

import { TrackingEngine } from "./analytics/tracking-engine";
import { drainStaging } from "./storage/drain-engine";
import {
  getActivityRecordsInRange,
  pruneOldActivities,
  clearAllData
} from "./storage/repository";
import {
  getLocalTodayDateString,
  getDateRangeList,
  getStartOfDayTimestamp
} from "./utils/date-utils";
import { aggregateHistoricalStats } from "./analytics/selectors/transforms";
import { ProductivityClassifier } from "./analytics/productivity-classifier";
import { pomodoroEngine } from "./analytics/pomodoro-engine";
import { 
  DEFAULT_RULES, 
  getCustomRules, 
  saveCustomRules, 
  type ProductivityCategory 
} from "./analytics/productivity-rules";
import {
  getTimeLimitRules,
  saveTimeLimitRules,
  getTimeLimitBypasses,
  setTimeLimitBypass
} from "./analytics/time-limits";
import type {
  RuntimeMessage,
  ActiveSessionResponse,
  TodayStatsResponse,
  PopupSnapshotResponse,
  HistoricalStatsResponse,
  DomainIntervalsResponse
} from "./types/tracking";
import { logger } from "./utils/logger";
import {
  deriveSurface,
  isRuntimeMessage,
  MESSAGE_CAPABILITIES,
  logSecurityEvent,
  securityMetrics,
  securityEventsLog
} from "./security/validators";


export {};

const engine = new TrackingEngine();
const classifier = new ProductivityClassifier([]);

// Bootstrap asynchronous engines on service worker startup
(async () => {
  try {
    await engine.initialize();
    
    // Broadcast a state sync to all tabs when a new tracking session begins.
    // This allows content scripts to perfectly resume their local timers without phantom ticking.
    engine.events.on("session-started", () => {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: "SYNC_REQUESTED", version: 1 }).catch(() => {});
          }
        });
      });
    });

    await pomodoroEngine.initialize();
    logger.info("[Background] All async engines initialized successfully.");
  } catch (err) {
    logger.error("[Background] Failed to initialize engines:", err);
  }
})();

// ─── Isolated, Ring-Buffered Cache Layer & Metrics ─────────────────────────────

const SNAPSHOT_SCHEMA_VERSION = 1;
const MAX_HISTORICAL_CACHE_ENTRIES = 30;

// Simple Ring Buffer implementation for memory-safe telemetry metrics
class RingBuffer<T> {
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

// Bounded structure for historical ranges
interface HistoricalCacheEntry {
  key: string;
  generatedAt: number;
  lastAccessedAt: number;
  payload: HistoricalStatsResponse;
  estimatedBytes: number;
  schemaVersion: number;
}

// Telemetry Observability structures (locally only)
interface CacheMetricEvent {
  timestamp: number;
  type: "hit" | "miss" | "invalidation";
  cacheType: "today" | "historical";
  key: string;
  computeTimeMs?: number;
  estimatedBytes?: number;
}

interface MaintenanceMetricEvent {
  timestamp: number;
  durationMs: number;
  rowsDeleted: number;
  batchesExecuted: number;
  success: boolean;
}

// Ring buffers capped at 100 entries to prevent memory leaks completely
const cacheEventsLog = new RingBuffer<CacheMetricEvent>(100);
const maintenanceEventsLog = new RingBuffer<MaintenanceMetricEvent>(100);

// Observability metrics summary
const cacheMetrics = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  computesCount: 0,
  totalComputeTimeMs: 0
};

// 1. Separate caches for isolated invalidation semantics
let todaySnapshotCache: {
  date: string;
  todayTotals: { totalDurationMs: number; totalVisits: number; uniqueDomainsCount: number };
  topDomains: Array<{ domain: string; durationMs: number }>;
} | null = null;

const historicalSnapshotCache = new Map<string, HistoricalCacheEntry>();

// Cache Stampede Prevention Map to deduplicate concurrent requests for identical boundaries
const inFlightPromises = new Map<string, Promise<HistoricalStatsResponse>>();

/**
 * Deep-freezes an object recursively to safeguard cached data from 
 * accidental UI-layer mutation side-effects.
 */
function deepFreeze<T extends object>(obj: T): T {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    const val = (obj as Record<string, unknown>)[prop];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val as object);
    }
  });
  return obj;
}

/**
 * Estimates character payload footprint size in bytes.
 */
function estimatePayloadSize(obj: unknown): number {
  try {
    return JSON.stringify(obj).length * 2;
  } catch {
    return 0;
  }
}

/**
 * Invalidates the volatile Today cache (triggered by drains/sessions starts/ends).
 * This is a "Soft" invalidation — preserves the historical aggregates.
 */
function invalidateTodayCache(): void {
  logger.debug("[Background] Soft Invalidation: Clearing volatile todaySnapshotCache.");
  todaySnapshotCache = null;
  cacheMetrics.invalidations += 1;
  cacheEventsLog.push({
    timestamp: Date.now(),
    type: "invalidation",
    cacheType: "today",
    key: "today"
  });
}

/**
 * Invalidates ALL caches (volatile today + bounded historical maps).
 * This is a "Hard" invalidation — triggered by rules compiling or database reset.
 */
function invalidateAllCaches(): void {
  logger.info("[Background] Hard Invalidation: Purging all cache maps (today & historical).");
  todaySnapshotCache = null;
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

/**
 * Generates canonical contextual signature for cache keys to prevent collision 
 * when custom rules configuration or metrics schemas version updates.
 */
function getCacheKey(startMs: number, endMs: number): string {
  const rulesSignature = classifier.getRulesCount();
  return `v${SNAPSHOT_SCHEMA_VERSION}:m1:r${rulesSignature}:${startMs}_${endMs}`;
}

/**
 * Bounded LRU Cache Eviction: inserts key and prunes oldest item if limit exceeded.
 */
function setHistoricalCache(key: string, payload: HistoricalStatsResponse): void {
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

  // Freeze payload recursively to block unexpected UI mutations
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

// ─── Debounced Drain ──────────────────────────────────────────────────────────

const DRAIN_DEBOUNCE_MS = 5_000;
let drainTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDrain(): void {
  if (drainTimer !== null) {
    clearTimeout(drainTimer);
  }
  drainTimer = setTimeout(() => {
    drainTimer = null;
    drainStaging().catch((e) => logger.error("Scheduled drain failed:", e));
  }, DRAIN_DEBOUNCE_MS);
}

// ─── Reentrancy Locked Daily Incremental Maintenance Scheduler ───────────────────

let maintenanceInProgress = false;

/**
 * Runs DB pruning compaction safely under idle state limits.
 * Uses a reentrancy lock and lastPrunedAt to restrict running once daily.
 */
async function runMaintenance(): Promise<void> {
  if (maintenanceInProgress) {
    logger.debug("[Background] Maintenance skipped: Compaction is already in progress.");
    return;
  }

  try {
    // 1. Verify system state is actually idle or locked
    const systemState = await new Promise<chrome.idle.IdleState>((resolve) => {
      chrome.idle.queryState(60, resolve);
    });

    if (systemState !== "idle" && systemState !== "locked") {
      logger.debug("[Background] Deferring maintenance: System is currently active.");
      return;
    }

    // 2. Enforce daily interval via storage token
    const storage = await chrome.storage.local.get("maintenance:lastPrunedAt");
    const lastPruned = storage["maintenance:lastPrunedAt"] as number | undefined;
    const now = Date.now();

    if (lastPruned && now - lastPruned < 24 * 60 * 60 * 1000) {
      logger.debug("[Background] Compaction deferred: Database already pruned in last 24h.");
      return;
    }

    // 3. Run incremental pruning under lock
    logger.info("[Background] System is idle. Executing daily database compaction...");
    maintenanceInProgress = true;
    const tStart = performance.now();

    const result = await pruneOldActivities(90, 500);

    const durationMs = performance.now() - tStart;
    maintenanceInProgress = false;

    // 4. Update last pruned token & log metrics event
    await chrome.storage.local.set({ "maintenance:lastPrunedAt": now });
    maintenanceEventsLog.push({
      timestamp: now,
      durationMs,
      rowsDeleted: result.rowsDeleted,
      batchesExecuted: result.batchesExecuted,
      success: true
    });

    logger.info(`[Background] Compaction completed successfully: Pruned ${result.rowsDeleted} rows across ${result.batchesExecuted} batches.`);
  } catch (err) {
    maintenanceInProgress = false;
    logger.error("[Background] Maintenance compaction failed:", err);
    maintenanceEventsLog.push({
      timestamp: Date.now(),
      durationMs: 0,
      rowsDeleted: 0,
      batchesExecuted: 0,
      success: false
    });
  }
}

/**
 * Warm-up Strategy: precomputes Today's live snapshot in the background
 * to pre-populate caches for immediate surface (popup/blob) openings.
 */
async function prewarmCache(): Promise<void> {
  logger.debug("[Background] Warming today stats cache...");
  try {
    const active = engine.getActiveSession();
    const paused = engine.getPaused();
    const activePayload = active ? { domain: active.domain, startTime: active.startTime } : null;
    await getLivePopupSnapshot(activePayload, paused);
    logger.info("[Background] Today cache pre-warmed successfully.");
  } catch (err) {
    logger.error("[Background] Failed to pre-warm cache on worker wakeup:", err);
  }
}

// Register background maintenance compaction to execute during idle windows
chrome.idle.onStateChanged.addListener(async (state) => {
  if (state === "idle" || state === "locked") {
    await runMaintenance();
  }
});

// ─── Engine + Drain Lifecycle ─────────────────────────────────────────────────

async function initializeAndDrain(): Promise<void> {
  await engine.initialize();
  // Fetch custom rules and compile classifier
  try {
    const customRules = await getCustomRules();
    classifier.compileRules(customRules);
    logger.info(`Productivity classifier compiled with ${customRules.length} custom rules.`);
  } catch (err) {
    logger.error("Failed to load custom rules on initialization:", err);
  }
  // Initialize Pomodoro Timer
  await pomodoroEngine.initialize();
  // Immediate drain on wakeup catches records staged before last suspension
  await drainStaging();
  // Pre-warm caches immediately after drain completion
  await prewarmCache();
  // Attempt daily maintenance during wakeup if system happens to be idle already
  await runMaintenance();
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  logger.info("Extension installed. Initializing tracking engine...");
  await initializeAndDrain();
});

// Re-initialize on browser startup
chrome.runtime.onStartup.addListener(async () => {
  logger.info("Browser started. Initializing tracking engine...");
  await initializeAndDrain();
});

// Initialize immediately when the service worker starts (MV3 quirk:
// onInstalled/onStartup may not fire on worker wake-ups after suspension)
(async () => {
  logger.info("Service worker awoke. Initializing tracking engine...");
  await initializeAndDrain();
})();

// Schedule a debounced drain and invalidate cache on session state changes
engine.events.on("session-started", () => {
  invalidateTodayCache();
});

engine.events.on("session-ended", () => {
  invalidateTodayCache();
  scheduleDrain();
});

// Finalize active session gracefully when the worker is about to be suspended
chrome.runtime.onSuspend.addListener(() => {
  logger.info("Service worker suspending. Finalizing active session...");
  // Clear the debounce timer — suspension cancels any pending scheduled drain
  if (drainTimer !== null) {
    clearTimeout(drainTimer);
    drainTimer = null;
  }
  engine.handleShutdown();
});

// ─── Live Aggregate Aggregation ───────────────────────────────────────────────

/**
 * Calculates live daily aggregates by merging persisted database records
 * with the in-memory active session from the tracking engine.
 *
 * RATIONALE:
 * Doing this in the background ensures the content script has zero direct
 * DB read access (least privilege) and stays extremely lightweight.
 */
async function getLiveTodayStats(): Promise<TodayStatsResponse> {
  const now = Date.now();
  const today = new Date();
  const dateStr = getLocalTodayDateString(today);
  const startOfDayMs = getStartOfDayTimestamp(dateStr);

  // 1. Fetch all completed records for today from DB
  const records = await getActivityRecordsInRange(startOfDayMs, now);

  // 2. Query in-memory live tracking state
  const active = engine.getActiveSession();
  const activeSessionPayload = active
    ? { domain: active.domain, startTime: active.startTime, todayTotalMs: 0 }
    : null;

  // 3. Build aggregated structures
  let totalDurationMs = 0;
  const domainDurations: Record<string, number> = {};
  const uniqueDomains = new Set<string>();

  // Add DB records
  for (const r of records) {
    totalDurationMs += r.durationMs;
    uniqueDomains.add(r.domain);
    domainDurations[r.domain] = (domainDurations[r.domain] ?? 0) + r.durationMs;
  }

  // Add live active tracking session duration
  if (active && activeSessionPayload) {
    const elapsed = Math.max(0, now - active.startTime);
    totalDurationMs += elapsed;
    uniqueDomains.add(active.domain);
    domainDurations[active.domain] = (domainDurations[active.domain] ?? 0) + elapsed;
    activeSessionPayload.todayTotalMs = domainDurations[active.domain] ?? 0;
  }

  // Map to list, sort descending by duration
  const topDomains = Object.entries(domainDurations)
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5); // Limit to top 5 for the floating blob UI

  return {
    activeSession: activeSessionPayload,
    totalDurationMs,
    uniqueDomainsCount: uniqueDomains.size,
    topDomains
  };
}

// ─── Secure Runtime Message Passing ───────────────────────────────────────────

async function getLivePopupSnapshot(
  activeSession: { domain: string; startTime: number } | null,
  trackingPaused: boolean
): Promise<PopupSnapshotResponse> {
  const now = Date.now();
  const dateStr = getLocalTodayDateString(new Date(now));

  // If cache is empty or for a different day, refresh it!
  if (!todaySnapshotCache || todaySnapshotCache.date !== dateStr) {
    logger.debug("[Background] Today cache miss. Fetching from IndexedDB repository...");
    const tStart = performance.now();
    const startOfDayMs = getStartOfDayTimestamp(dateStr);
    
    // FETCH DIRECTLY FROM ACTIVITIES TABLE instead of unpopulated pre-aggregates
    const records = await getActivityRecordsInRange(startOfDayMs, now);

    let totalDurationMs = 0;
    let totalVisits = 0;
    
    const uniqueDomains = new Set<string>();
    const domainDurations: Record<string, number> = {};

    for (const r of records) {
      totalDurationMs += r.durationMs;
      totalVisits += 1;
      uniqueDomains.add(r.domain);
      domainDurations[r.domain] = (domainDurations[r.domain] ?? 0) + r.durationMs;
    }

    todaySnapshotCache = {
      date: dateStr,
      todayTotals: {
        totalDurationMs,
        totalVisits,
        uniqueDomainsCount: uniqueDomains.size
      },
      topDomains: Object.entries(domainDurations)
        .map(([domain, durationMs]) => ({ domain, durationMs }))
        .sort((a, b) => b.durationMs - a.durationMs)
    };

    const computeTimeMs = performance.now() - tStart;
    cacheMetrics.misses += 1;
    cacheMetrics.computesCount += 1;
    cacheMetrics.totalComputeTimeMs += computeTimeMs;
    cacheEventsLog.push({
      timestamp: Date.now(),
      type: "miss",
      cacheType: "today",
      key: `today:${dateStr}`,
      computeTimeMs,
      estimatedBytes: estimatePayloadSize(todaySnapshotCache)
    });
  } else {
    logger.debug("[Background] Today snapshot cache hit!");
    cacheMetrics.hits += 1;
    cacheEventsLog.push({
      timestamp: Date.now(),
      type: "hit",
      cacheType: "today",
      key: `today:${dateStr}`
    });
  }

  // Marriage: dynamic live overlay of the in-memory active session (Safe from double-counting)
  let totalDurationMs = todaySnapshotCache.todayTotals.totalDurationMs;
  let totalVisits = todaySnapshotCache.todayTotals.totalVisits;
  const uniqueDomainsCount = todaySnapshotCache.todayTotals.uniqueDomainsCount;
  
  const domainDurations: Record<string, number> = {};
  for (const item of todaySnapshotCache.topDomains) {
    domainDurations[item.domain] = item.durationMs;
  }

  let finalUniqueDomainsCount = uniqueDomainsCount;

  const finalActiveSession = activeSession ? { ...activeSession, todayTotalMs: 0 } : null;

  if (activeSession && finalActiveSession) {
    const elapsed = Math.max(0, now - activeSession.startTime);
    totalDurationMs += elapsed;
    totalVisits += 1;
    
    if (domainDurations[activeSession.domain] === undefined) {
      finalUniqueDomainsCount += 1;
    }
    domainDurations[activeSession.domain] = (domainDurations[activeSession.domain] ?? 0) + elapsed;
    finalActiveSession.todayTotalMs = domainDurations[activeSession.domain] ?? 0;
  }

  const topDomains = Object.entries(domainDurations)
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5);

  return {
    trackingPaused,
    activeSession: finalActiveSession,
    todayTotals: {
      totalDurationMs,
      totalVisits,
      uniqueDomainsCount: finalUniqueDomainsCount
    },
    topDomains,
    snapshotGeneratedAt: now
  };
}

async function handleGetHistoricalStats(
  startMs: number,
  endMs: number,
  activeSession: { domain: string; startTime: number } | null,
  trackingPaused: boolean
): Promise<HistoricalStatsResponse> {
  // 1. Get dates range in YYYY-MM-DD format (Canonical key boundaries)
  const dates = getDateRangeList(startMs, endMs);

  const key = getCacheKey(startMs, endMs);

  // 2. Cache Hit checking (Soft boundaries: 5s for today, 60s for historical)
  const cached = historicalSnapshotCache.get(key);
  const todayStr = getLocalTodayDateString(new Date());
  const containsToday = dates.includes(todayStr);
  const TTL_MS = containsToday ? 5_000 : 60_000;

  if (cached && (Date.now() - cached.generatedAt < TTL_MS)) {
    logger.debug(`[Background] Historical cache hit for key: ${key}`);
    cached.lastAccessedAt = Date.now();
    cacheMetrics.hits += 1;
    cacheEventsLog.push({
      timestamp: Date.now(),
      type: "hit",
      cacheType: "historical",
      key
    });
    return cached.payload;
  }

  // 3. Cache Stampede Prevention check
  const inFlight = inFlightPromises.get(key);
  if (inFlight) {
    logger.debug(`[Background] Cache Stampede Merging: Joining active promise for key: ${key}`);
    return inFlight;
  }

  // 4. Computation Promise Block
  const tStart = performance.now();
  const computePromise = (async () => {
    // FETCH DIRECTLY FROM ACTIVITIES TABLE instead of unpopulated pre-aggregates
    const rawActivities = await getActivityRecordsInRange(startMs, endMs);
    
    interface DbTotalEntry {
      date: string;
      totalDurationMs: number;
      totalVisits: number;
      uniqueDomainsCount: number;
      schemaVersion: number;
      createdAt: number;
      updatedAt: number;
    }
    interface DbDomainStatEntry {
      date: string;
      domain: string;
      durationMs: number;
      visitCount: number;
      schemaVersion: number;
      createdAt: number;
      updatedAt: number;
    }
    const dbTotalsMap: Record<string, DbTotalEntry> = {};
    const dbDomainStatsMap: Record<string, DbDomainStatEntry> = {};
    
    for (const r of rawActivities) {
      const dStr = getLocalTodayDateString(new Date(r.startTime));
      if (!dbTotalsMap[dStr]) {
        dbTotalsMap[dStr] = { date: dStr, totalDurationMs: 0, totalVisits: 0, uniqueDomainsCount: 0, schemaVersion: 1, createdAt: r.startTime, updatedAt: r.startTime };
      }
      dbTotalsMap[dStr]!.totalDurationMs += r.durationMs;
      dbTotalsMap[dStr]!.totalVisits += 1;
      
      const domKey = `${dStr}:${r.domain}`;
      if (!dbDomainStatsMap[domKey]) {
        dbDomainStatsMap[domKey] = { date: dStr, domain: r.domain, durationMs: 0, visitCount: 0, schemaVersion: 1, createdAt: r.startTime, updatedAt: r.startTime };
      }
      dbDomainStatsMap[domKey]!.durationMs += r.durationMs;
      dbDomainStatsMap[domKey]!.visitCount += 1;
    }
    
    const finalTotals = Object.values(dbTotalsMap).map(entry => {
      const uniqueCount = Object.keys(dbDomainStatsMap).filter(k => k.startsWith(entry.date + ":")).length;
      return {
        date: entry.date,
        totalDurationMs: entry.totalDurationMs,
        totalVisits: entry.totalVisits,
        uniqueDomainsCount: uniqueCount,
        schemaVersion: entry.schemaVersion,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      };
    });
    
    const finalDomainStats = Object.values(dbDomainStatsMap);

    if (activeSession && containsToday) {
      const elapsed = Math.max(0, Date.now() - activeSession.startTime);

      // Find if domain already exists for today in finalDomainStats to check unique domains
      const domainRecordedToday = finalDomainStats.some(
        (s) => s.date === todayStr && s.domain === activeSession.domain
      );
      const isNewDomainForToday = !domainRecordedToday;

      // Find if today already exists in dbTotals
      const todayIndex = finalTotals.findIndex((t) => t.date === todayStr);
      if (todayIndex >= 0) {
        const existing = finalTotals[todayIndex];
        if (existing) {
          finalTotals[todayIndex] = {
            ...existing,
            totalDurationMs: existing.totalDurationMs + elapsed,
            totalVisits: existing.totalVisits + 1,
            uniqueDomainsCount: existing.uniqueDomainsCount + (isNewDomainForToday ? 1 : 0),
            updatedAt: Date.now(),
          };
        }
      } else {
        finalTotals.push({
          date: todayStr,
          totalDurationMs: elapsed,
          totalVisits: 1,
          uniqueDomainsCount: 1,
          schemaVersion: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      // Find if domain already exists for today in finalDomainStats
      const domainStatIndex = finalDomainStats.findIndex(
        (s) => s.date === todayStr && s.domain === activeSession.domain
      );
      if (domainStatIndex >= 0) {
        const existing = finalDomainStats[domainStatIndex];
        if (existing) {
          finalDomainStats[domainStatIndex] = {
            ...existing,
            durationMs: existing.durationMs + elapsed,
            visitCount: existing.visitCount + 1,
            updatedAt: Date.now(),
          };
        }
      } else {
        finalDomainStats.push({
          date: todayStr,
          domain: activeSession.domain,
          durationMs: elapsed,
          visitCount: 1,
          schemaVersion: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // Perform pure deterministic aggregations and metrics transformations
    const domainCategories: Record<string, ProductivityCategory> = {};
    for (const stat of finalDomainStats) {
      if (stat && stat.domain && !domainCategories[stat.domain]) {
        domainCategories[stat.domain] = classifier.classifyDomain(stat.domain).category;
      }
    }
    if (activeSession && activeSession.domain && !domainCategories[activeSession.domain]) {
      domainCategories[activeSession.domain] = classifier.classifyDomain(activeSession.domain).category;
    }

    const historical = aggregateHistoricalStats(dates, finalTotals, finalDomainStats, domainCategories);

    // Build 24-bucket hourly timeline when querying a single day
    let hourlyTimeline: Array<{ date: string; durationMs: number; visitCount: number; productiveMs: number; distractingMs: number }> | undefined;
    if (dates.length === 1) {
      // Initialize 24 zeroed buckets
      const buckets = Array.from({ length: 24 }, (_, h) => ({
        date: `${String(h).padStart(2, "0")}:00`,
        durationMs: 0,
        visitCount: 0,
        productiveMs: 0,
        distractingMs: 0
      }));
      // Accumulate each activity record into the correct hour bucket
      for (const r of rawActivities) {
        const hour = new Date(r.startTime).getHours();
        if (hour >= 0 && hour < 24 && buckets[hour]) {
          buckets[hour]!.durationMs += r.durationMs;
          buckets[hour]!.visitCount += 1;
          
          const cat = domainCategories[r.domain] || "unknown";
          if (cat === "productive") buckets[hour]!.productiveMs += r.durationMs;
          else if (cat === "distracting") buckets[hour]!.distractingMs += r.durationMs;
        }
      }
      // Also fold in the current active session if within today
      if (activeSession && containsToday) {
        const elapsed = Math.max(0, Date.now() - activeSession.startTime);
        const hour = new Date(activeSession.startTime).getHours();
        if (hour >= 0 && hour < 24 && buckets[hour]) {
          buckets[hour]!.durationMs += elapsed;
          buckets[hour]!.visitCount += 1;
          
          const cat = domainCategories[activeSession.domain] || "unknown";
          if (cat === "productive") buckets[hour]!.productiveMs += elapsed;
          else if (cat === "distracting") buckets[hour]!.distractingMs += elapsed;
        }
      }
      // Only include hours that have any data, or keep all 24 for a complete axis
      hourlyTimeline = buckets;
    }

    const resultPayload: HistoricalStatsResponse = {
      trackingPaused,
      metrics: historical.metrics,
      timeline: historical.timeline,
      ...(hourlyTimeline && { hourlyTimeline }),
      topDomains: historical.topDomains,
      snapshotGeneratedAt: Date.now()
    };

    // Deep freeze and set in cache
    setHistoricalCache(key, resultPayload);
    return resultPayload;
  })();

  // Track promise to merge concurrent requests
  inFlightPromises.set(key, computePromise);

  try {
    const finalPayload = await computePromise;
    const computeTimeMs = performance.now() - tStart;
    
    cacheMetrics.misses += 1;
    cacheMetrics.computesCount += 1;
    cacheMetrics.totalComputeTimeMs += computeTimeMs;
    cacheEventsLog.push({
      timestamp: Date.now(),
      type: "miss",
      cacheType: "historical",
      key,
      computeTimeMs,
      estimatedBytes: estimatePayloadSize(finalPayload)
    });

    return finalPayload;
  } finally {
    // Cleanup in-flight map
    inFlightPromises.delete(key);
  }
}

/**
 * Destructively clears all local extension state including IndexedDB tables,
 * local storage configurations, custom productivity rules, active timers, and in-memory caches.
 */
async function resetExtensionState(): Promise<void> {
  logger.warn("[Background] Commencing full extension state reset...");

  // 1. Pause tracking engine
  await engine.setPaused(true);

  // 2. Clear IndexedDB repositories
  await clearAllData();

  // 3. Clear chrome.storage.local completely (WAL keys, options, maintenance timestamps, custom rules)
  await chrome.storage.local.clear();

  // 4. Reset engine in-memory state
  engine.clearState();

  // 5. Re-compile productivity classifier to empty state
  classifier.compileRules([]);

  // 6. Invalidate all cache memoizations
  invalidateAllCaches();

  logger.info("[Background] Full extension state reset completed successfully.");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Derive execution origin context surface and validate sender identity
  const surface = deriveSurface(sender);
  if (surface === "unknown") {
    securityMetrics.rejectedMessages++;
    logSecurityEvent(
      "REJECTED_UNKNOWN_SURFACE",
      "unknown",
      `Connection blocked. Sender ID: ${sender.id ?? "none"}, URL: ${sender.url ?? "none"}`
    );
    logger.warn(`[Background Security] Rejected message from untrusted surface. Sender URL: ${sender.url}`);
    return false;
  }

  // 2. Structurally validate message schema shape and protocol version
  if (!isRuntimeMessage(message)) {
    logSecurityEvent(
      "REJECTED_MALFORMED_SCHEMA",
      surface,
      `Payload failed schema validation type-guards.`
    );
    logger.warn(`[Background Security] Malformed payload rejected from surface: ${surface}`);
    sendResponse({ success: false, error: "Access denied. Malformed message payload." });
    return false;
  }

  const msg = message as RuntimeMessage;

  // 3. Enforce capabilities access policies (Deny-by-Default)
  const allowedSurfaces = (MESSAGE_CAPABILITIES as Record<string, readonly string[]>)[msg.type];
  if (!allowedSurfaces || !allowedSurfaces.includes(surface)) {
    securityMetrics.privilegeViolations++;
    logSecurityEvent(
      "REJECTED_PRIVILEGE_VIOLATION",
      surface,
      `Action '${msg.type}' requires privileged access. Allowed: [${allowedSurfaces ? allowedSurfaces.join(", ") : "none"}]`,
      msg.type
    );
    logger.error(
      `[Background Security] Privilege violation: surface '${surface}' attempted action '${msg.type}'`
    );
    sendResponse({ success: false, error: `Access denied. Unauthorized context surface '${surface}'.` });
    return false;
  }

  // 4. Privileged command route execution
  if (msg.type === "GET_ACTIVE_SESSION") {
    const active = engine.getActiveSession();
    const response: ActiveSessionResponse = {
      activeSession: active ? { domain: active.domain, startTime: active.startTime } : null
    };
    sendResponse(response);
    return false; // Synchronous response
  }

  if (msg.type === "GET_TODAY_STATS") {
    // Aggregation uses async DB call — return true to signal asynchronous response
    getLiveTodayStats()
      .then((stats) => {
        sendResponse(stats);
      })
      .catch((err) => {
        logger.error("[Background] Failed to aggregate live today stats", err);
        // Fail-safe empty stats payload
        sendResponse({
          activeSession: null,
          totalDurationMs: 0,
          uniqueDomainsCount: 0,
          topDomains: []
        } as TodayStatsResponse);
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "GET_POPUP_SNAPSHOT") {
    const active = engine.getActiveSession();
    const paused = engine.getPaused();
    const activePayload = active ? { domain: active.domain, startTime: active.startTime } : null;

    getLivePopupSnapshot(activePayload, paused)
      .then((snapshot) => {
        sendResponse(snapshot);
      })
      .catch((err) => {
        logger.error("[Background] Failed to generate popup snapshot", err);
        sendResponse({
          trackingPaused: paused,
          activeSession: null,
          todayTotals: { totalDurationMs: 0, totalVisits: 0, uniqueDomainsCount: 0 },
          topDomains: [],
          snapshotGeneratedAt: Date.now()
        } as PopupSnapshotResponse);
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "GET_HISTORICAL_STATS") {
    const active = engine.getActiveSession();
    const paused = engine.getPaused();
    const activePayload = active ? { domain: active.domain, startTime: active.startTime } : null;

    if (typeof msg.startMs !== "number" || typeof msg.endMs !== "number") {
      sendResponse({
        trackingPaused: paused,
        metrics: {
          totalDurationMs: 0,
          totalVisits: 0,
          uniqueDomainsCount: 0,
          averageSessionMs: 0,
          focusHours: 0,
          productiveDurationMs: 0,
          distractingDurationMs: 0,
          neutralDurationMs: 0,
          unknownDurationMs: 0,
          productivityScore: 0,
          metricsVersion: 1
        },
        timeline: [],
        topDomains: [],
        snapshotGeneratedAt: Date.now()
      } as HistoricalStatsResponse);
      return false;
    }

    handleGetHistoricalStats(msg.startMs, msg.endMs, activePayload, paused)
      .then((res) => {
        sendResponse(res);
      })
      .catch((err) => {
        logger.error("[Background] Failed to aggregate historical range", err);
        sendResponse({
          trackingPaused: paused,
          metrics: {
            totalDurationMs: 0,
            totalVisits: 0,
            uniqueDomainsCount: 0,
            averageSessionMs: 0,
            focusHours: 0,
            productiveDurationMs: 0,
            distractingDurationMs: 0,
            neutralDurationMs: 0,
            unknownDurationMs: 0,
            productivityScore: 0,
            metricsVersion: 1
          },
          timeline: [],
          topDomains: [],
          snapshotGeneratedAt: Date.now()
        } as HistoricalStatsResponse);
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "GET_DOMAIN_INTERVALS") {
    if (typeof msg.startMs !== "number" || typeof msg.endMs !== "number" || typeof msg.domain !== "string") {
      sendResponse({ domain: msg.domain || "", intervals: [] } as DomainIntervalsResponse);
      return false;
    }

    getActivityRecordsInRange(msg.startMs, msg.endMs)
      .then((records) => {
        const domainRecords = records.filter(r => r.domain === msg.domain);
        
        // Check if there's an active session for this domain that should be included
        const active = engine.getActiveSession();
        if (active && active.domain === msg.domain && active.startTime <= msg.endMs && active.startTime >= msg.startMs) {
           domainRecords.push({
             sessionId: active.sessionId,
             domain: active.domain,
             startTime: active.startTime,
             endTime: Date.now(),
             durationMs: Date.now() - active.startTime,
             terminationReason: "idle", // Placeholder for ongoing session
             createdAt: Date.now(),
             updatedAt: Date.now(),
             schemaVersion: 1
           });
        }
        
        sendResponse({
          domain: msg.domain,
          intervals: domainRecords
        } as DomainIntervalsResponse);
      })
      .catch((err) => {
        logger.error("[Background] Failed to get domain intervals", err);
        sendResponse({ domain: msg.domain, intervals: [] } as DomainIntervalsResponse);
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "GET_CACHE_METRICS") {
    sendResponse({
      metrics: cacheMetrics,
      eventsLog: cacheEventsLog.get(),
      maintenanceLog: maintenanceEventsLog.get(),
      historicalCacheSize: historicalSnapshotCache.size,
      historicalCacheKeys: Array.from(historicalSnapshotCache.keys())
    });
    return false; // Synchronous response
  }

  if (msg.type === "GET_SECURITY_METRICS") {
    sendResponse({
      metrics: securityMetrics,
      eventsLog: securityEventsLog.get()
    });
    return false; // Synchronous response
  }

  if (msg.type === "GET_TRACKING_STATUS") {
    sendResponse({
      trackingPaused: engine.getPaused()
    });
    return false; // Synchronous response
  }

  if (msg.type === "BROADCAST_RULES_UPDATED") {
    getCustomRules()
      .then((rules) => {
        classifier.compileRules(rules);
        invalidateAllCaches();
      })
      .catch(() => {});
    return false; // Synchronous acknowledgment
  }

  if (msg.type === "GET_PRODUCTIVITY_RULES") {
    getCustomRules()
      .then((customRules) => {
        sendResponse({
          success: true,
          customRules,
          defaultRules: DEFAULT_RULES
        });
      })
      .catch((err) => {
        logger.error("[Background] Failed to get productivity rules", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "SAVE_PRODUCTIVITY_RULES") {
    if (!Array.isArray(msg.rules)) {
      sendResponse({ success: false, error: "Rules payload must be a valid array." });
      return false;
    }
    const rulesToSave = msg.rules;
    saveCustomRules(rulesToSave)
      .then((res) => {
        if (res.success) {
          classifier.compileRules(rulesToSave);
          invalidateAllCaches();
        }
        sendResponse(res);
      })
      .catch((err) => {
        logger.error("[Background] Failed to save productivity rules", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "RESET_PRODUCTIVITY_RULES") {
    saveCustomRules([])
      .then((res) => {
        if (res.success) {
          classifier.compileRules([]);
          invalidateAllCaches();
        }
        sendResponse(res);
      })
      .catch((err) => {
        logger.error("[Background] Failed to reset productivity rules", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "TOGGLE_TRACKING") {
    const desiredState = !!msg.paused;
    engine.setPaused(desiredState)
      .then(() => {
        invalidateTodayCache();
        sendResponse({ success: true, trackingPaused: desiredState });
      })
      .catch((err) => {
        logger.error("[Background] Failed to toggle tracking engine paused state", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }

  if (msg.type === "PURGE_ALL_DATA") {
    resetExtensionState()
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((err) => {
        logger.error("[Background] Failed to execute extension state purge:", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }

  // Pomodoro Handlers
  if (msg.type === "GET_POMODORO_STATE") {
    pomodoroEngine.getState().then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === "START_POMODORO") {
    pomodoroEngine.startTimer(msg.phase).then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === "PAUSE_POMODORO") {
    pomodoroEngine.pauseTimer().then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === "RESUME_POMODORO") {
    pomodoroEngine.resumeTimer().then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === "STOP_POMODORO") {
    pomodoroEngine.stopTimer().then((state) => {
      sendResponse(state);
    });
    return true;
  }

  if (msg.type === "GET_POMODORO_SETTINGS") {
    pomodoroEngine.getSettings().then((settings) => {
      sendResponse(settings);
    });
    return true;
  }

  if (msg.type === "SAVE_POMODORO_SETTINGS") {
    pomodoroEngine.saveSettings(msg.settings).then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  if (msg.type === "GET_TIME_LIMIT_RULES") {
    getTimeLimitRules().then((rules) => {
      sendResponse({ success: true, rules });
    }).catch(err => {
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  if (msg.type === "SAVE_TIME_LIMIT_RULES") {
    saveTimeLimitRules(msg.rules).then((res) => {
      sendResponse(res);
    }).catch(err => {
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  if (msg.type === "BYPASS_TIME_LIMIT") {
    setTimeLimitBypass(msg.domain, msg.durationMs).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      sendResponse({ success: false, error: String(err) });
    });
    return true;
  }

  if (msg.type === "GET_TIME_LIMIT_STATE") {
    (async () => {
      try {
        const rules = await getTimeLimitRules();
        const normalizedMsgDomain = msg.domain.replace(/^www\./, "");
        const rule = rules.find(r => r.domain.replace(/^www\./, "") === normalizedMsgDomain && r.enabled !== false);
        
        if (!rule) {
          sendResponse({ domain: msg.domain, isBlocked: false });
          return;
        }

        const bypasses = await getTimeLimitBypasses();
        const bypass = bypasses.find(b => b.domain.replace(/^www\./, "") === normalizedMsgDomain);
        const bypassedUntil = bypass ? bypass.bypassedUntil : undefined;

        // Calculate time spent today on this domain
        const active = engine.getActiveSession();
        const now = Date.now();
        const startOfDayMs = getStartOfDayTimestamp(getLocalTodayDateString(new Date(now)));
        const records = await getActivityRecordsInRange(startOfDayMs, now);
        
        let currentDurationMs = 0;
        for (const r of records) {
          if (r.domain.replace(/^www\./, "") === normalizedMsgDomain) {
            currentDurationMs += r.durationMs;
          }
        }
        
        if (active && !engine.getPaused()) {
          if (active.domain.replace(/^www\./, "") === normalizedMsgDomain) {
            currentDurationMs += Math.max(0, now - active.startTime);
          }
        }

        const isBlocked = currentDurationMs >= rule.maxDurationMs && (!bypassedUntil || now > bypassedUntil);

        sendResponse({
          domain: msg.domain,
          isBlocked,
          bypassedUntil,
          maxDurationMs: rule.maxDurationMs,
          currentDurationMs
        });
      } catch (err) {
        logger.error("[Background] Failed to get time limit state", err);
        sendResponse({ domain: msg.domain, isBlocked: false });
      }
    })();
    return true;
  }

  return false;
});
