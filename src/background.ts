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
  getDailyTotal,
  getDailyDomainStatsForDate
} from "./storage/repository";
import {
  getLocalTodayDateString,
  getLocalDateString,
  getDateRangeList,
  getStartOfDayTimestamp
} from "./utils/date-utils";

import {
  getDailyTotalsRange,
  getDailyDomainStatsRange
} from "./analytics/selectors/queries";
import { aggregateHistoricalStats } from "./analytics/selectors/transforms";
import { ProductivityClassifier } from "./analytics/productivity-classifier";
import { 
  DEFAULT_RULES, 
  getCustomRules, 
  saveCustomRules, 
  type ProductivityCategory, 
  type ProductivityRule 
} from "./analytics/productivity-rules";
import type {
  RuntimeMessage,
  ActiveSessionResponse,
  TodayStatsResponse,
  PopupSnapshotResponse,
  HistoricalStatsResponse
} from "./types/tracking";
import { logger } from "./utils/logger";


export {};

const engine = new TrackingEngine();
const classifier = new ProductivityClassifier([]);

// ─── Today Stats Cache Memoization Layer (Sub-300ms Hydration) ──────────────────

let cachedDbStats: {
  date: string;
  todayTotals: { totalDurationMs: number; totalVisits: number; uniqueDomainsCount: number };
  topDomains: Array<{ domain: string; durationMs: number }>;
} | null = null;

function invalidateCache(): void {
  logger.debug("[Background] Invalidating today stats cache.");
  cachedDbStats = null;
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
  // Immediate drain on wakeup catches records staged before last suspension
  await drainStaging();
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
  invalidateCache();
});

engine.events.on("session-ended", () => {
  invalidateCache();
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
    ? { domain: active.domain, startTime: active.startTime }
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
  if (active) {
    const elapsed = Math.max(0, now - active.startTime);
    totalDurationMs += elapsed;
    uniqueDomains.add(active.domain);
    domainDurations[active.domain] = (domainDurations[active.domain] ?? 0) + elapsed;
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
  if (!cachedDbStats || cachedDbStats.date !== dateStr) {
    logger.debug("[Background] Cache miss. Fetching from IndexedDB repository...");
    const [dbTotal, dbDomainStats] = await Promise.all([
      getDailyTotal(dateStr),
      getDailyDomainStatsForDate(dateStr)
    ]);

    const totalDurationMs = dbTotal ? dbTotal.totalDurationMs : 0;
    const totalVisits = dbTotal ? dbTotal.totalVisits : 0;
    
    const uniqueDomains = new Set<string>();
    const domainDurations: Record<string, number> = {};

    if (dbDomainStats) {
      for (const stat of dbDomainStats) {
        uniqueDomains.add(stat.domain);
        domainDurations[stat.domain] = stat.durationMs;
      }
    }

    cachedDbStats = {
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
  } else {
    logger.debug("[Background] Today snapshot cache hit!");
  }

  // Marriage: dynamic live overlay of the in-memory active session (Safe from double-counting)
  let totalDurationMs = cachedDbStats.todayTotals.totalDurationMs;
  let totalVisits = cachedDbStats.todayTotals.totalVisits;
  const uniqueDomainsCount = cachedDbStats.todayTotals.uniqueDomainsCount;
  
  const domainDurations: Record<string, number> = {};
  for (const item of cachedDbStats.topDomains) {
    domainDurations[item.domain] = item.durationMs;
  }

  let finalUniqueDomainsCount = uniqueDomainsCount;

  if (activeSession) {
    const elapsed = Math.max(0, now - activeSession.startTime);
    totalDurationMs += elapsed;
    totalVisits += 1;
    
    if (domainDurations[activeSession.domain] === undefined) {
      finalUniqueDomainsCount += 1;
    }
    domainDurations[activeSession.domain] = (domainDurations[activeSession.domain] ?? 0) + elapsed;
  }

  const topDomains = Object.entries(domainDurations)
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5);

  return {
    trackingPaused,
    activeSession,
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
  const now = Date.now();
  
  // 1. Get dates range in YYYY-MM-DD format
  const dates = getDateRangeList(startMs, endMs);
  const startDateStr = dates[0] || getLocalDateString(startMs);
  const endDateStr = dates[dates.length - 1] || getLocalDateString(endMs);

  // 2. Fetch pre-aggregated records from IndexedDB range query
  const [dbTotals, dbDomainStats] = await Promise.all([
    getDailyTotalsRange(startDateStr, endDateStr),
    getDailyDomainStatsRange(startDateStr, endDateStr)
  ]);

  // 3. Clone and overlay active dynamic session if active and inside the queried date range
  const todayStr = getLocalTodayDateString(new Date(now));
  const isTodayIncluded = dates.includes(todayStr);

  const finalTotals = [...dbTotals];
  const finalDomainStats = [...dbDomainStats];

  if (activeSession && isTodayIncluded) {
    const elapsed = Math.max(0, now - activeSession.startTime);

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
          updatedAt: now,
        };
      }
    } else {
      finalTotals.push({
        date: todayStr,
        totalDurationMs: elapsed,
        totalVisits: 1,
        uniqueDomainsCount: 1,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
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
          updatedAt: now,
        };
      }
    } else {
      finalDomainStats.push({
        date: todayStr,
        domain: activeSession.domain,
        durationMs: elapsed,
        visitCount: 1,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 4. Perform pure deterministic aggregations and metrics transformations
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

  return {
    trackingPaused,
    metrics: historical.metrics,
    timeline: historical.timeline,
    topDomains: historical.topDomains,
    snapshotGeneratedAt: now
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Security Check: Reject untyped or loose payloads
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const msg = message as Partial<RuntimeMessage>;

  // 2. Version Check: enforce strict compatibility
  if (msg.version !== 1) {
    logger.warn(`[Background] Rejected message with invalid protocol version: ${msg.version}`);
    return false;
  }

  // 3. Command Route
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
        invalidateCache();
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
          invalidateCache();
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
          invalidateCache();
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
        invalidateCache();
        sendResponse({ success: true, trackingPaused: desiredState });
      })
      .catch((err) => {
        logger.error("[Background] Failed to toggle tracking engine paused state", err);
        sendResponse({ success: false, error: String(err) });
      });
    return true; // Asynchronous reply
  }


  return false;
});
