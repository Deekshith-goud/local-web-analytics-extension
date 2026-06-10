import { engine, classifier } from "./engine-instance";
import { getActivityRecordsInRange } from "../storage/repository";
import { getLocalTodayDateString, getDateRangeList, getStartOfDayTimestamp } from "../utils/date-utils";
import { aggregateHistoricalStats } from "../analytics/selectors/transforms";
import type { ProductivityCategory } from "../analytics/productivity-rules";
import type { TodayStatsResponse, PopupSnapshotResponse, HistoricalStatsResponse } from "../types/tracking";
import { logger } from "../utils/logger";
import { 
  getTodaySnapshotCache, 
  setTodaySnapshotCache, 
  historicalSnapshotCache, 
  inFlightPromises, 
  cacheMetrics, 
  cacheEventsLog, 
  setHistoricalCache, 
  estimatePayloadSize, 
  getCacheKey 
} from "./cache-service";

/**
 * Calculates live daily aggregates by merging persisted database records
 * with the in-memory active session from the tracking engine.
 *
 * RATIONALE:
 * Doing this in the background ensures the content script has zero direct
 * DB read access (least privilege) and stays extremely lightweight.
 */
export async function getLiveTodayStats(): Promise<TodayStatsResponse> {
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

export async function getLivePopupSnapshot(
  activeSession: { domain: string; startTime: number } | null,
  trackingPaused: boolean
): Promise<PopupSnapshotResponse> {
  const now = Date.now();
  const dateStr = getLocalTodayDateString(new Date(now));

  // If cache is empty or for a different day, refresh it!
  if (!getTodaySnapshotCache() || getTodaySnapshotCache()?.date !== dateStr) {
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

    setTodaySnapshotCache({
      date: dateStr,
      todayTotals: {
        totalDurationMs,
        totalVisits,
        uniqueDomainsCount: uniqueDomains.size
      },
      topDomains: Object.entries(domainDurations)
        .map(([domain, durationMs]) => ({ domain, durationMs }))
        .sort((a, b) => b.durationMs - a.durationMs)
    });

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
      estimatedBytes: estimatePayloadSize(getTodaySnapshotCache())
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
  let totalDurationMs = getTodaySnapshotCache()!.todayTotals.totalDurationMs;
  let totalVisits = getTodaySnapshotCache()!.todayTotals.totalVisits;
  const uniqueDomainsCount = getTodaySnapshotCache()!.todayTotals.uniqueDomainsCount;
  
  const domainDurations: Record<string, number> = {};
  for (const item of getTodaySnapshotCache()!.topDomains) {
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

export async function handleGetHistoricalStats(
  startMs: number,
  endMs: number,
  activeSession: { domain: string; startTime: number } | null,
  trackingPaused: boolean
): Promise<HistoricalStatsResponse> {
  // 1. Get dates range in YYYY-MM-DD format (Canonical key boundaries)
  const dates = getDateRangeList(startMs, endMs);

  const key = getCacheKey(startMs, endMs, classifier.getRulesCount());

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

