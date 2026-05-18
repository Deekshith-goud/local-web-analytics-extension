/**
 * selectors.ts
 *
 * Derived selectors layer that computes stats for the Popup & Dashboard UI.
 *
 * RATIONALE:
 * - Directs all UI state aggregates strictly to pre-aggregated Daily Totals and
 *   Daily Domain Stats, avoiding massive table scans of raw Activity records.
 * - Protects against double-counting: Database records strictly contain COMPLETED sessions,
 *   while the active in-memory session is added dynamically at runtime.
 */

import { getDailyDomainStatsForDate, getDailyTotal } from "../storage/repository";
import type { PopupSnapshotResponse } from "../types/tracking";

/**
 * Returns a timezone-safe local YYYY-MM-DD formatted string.
 */
export function getLocalTodayDateString(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface ActiveSessionPayload {
  domain: string;
  startTime: number;
}

/**
 * Derives the popup state snapshot by marrying pre-aggregated database stats
 * with the ephemeral in-memory active session.
 */
export async function getTodayPopupSnapshot(
  activeSession: ActiveSessionPayload | null,
  trackingPaused: boolean,
  nowMs: number = Date.now()
): Promise<PopupSnapshotResponse> {
  const dateStr = getLocalTodayDateString(new Date(nowMs));

  // 1. Fetch pre-aggregated records from IndexedDB
  const [dbTotal, dbDomainStats] = await Promise.all([
    getDailyTotal(dateStr),
    getDailyDomainStatsForDate(dateStr)
  ]);

  // 2. Setup baseline totals
  let totalDurationMs = dbTotal ? dbTotal.totalDurationMs : 0;
  let totalVisits = dbTotal ? dbTotal.totalVisits : 0;
  const uniqueDomains = new Set<string>();

  if (dbDomainStats) {
    for (const stat of dbDomainStats) {
      uniqueDomains.add(stat.domain);
    }
  }

  // 3. Map domain stats baseline
  const domainDurations: Record<string, number> = {};
  if (dbDomainStats) {
    for (const stat of dbDomainStats) {
      domainDurations[stat.domain] = stat.durationMs;
    }
  }

  // 4. Incorporate the active in-memory session on-the-fly (Strict Invariant: Never Double-Counted)
  if (activeSession) {
    const elapsed = Math.max(0, nowMs - activeSession.startTime);
    totalDurationMs += elapsed;
    
    // An active session counts as 1 visit for the day
    totalVisits += 1;
    uniqueDomains.add(activeSession.domain);
    domainDurations[activeSession.domain] = (domainDurations[activeSession.domain] ?? 0) + elapsed;
  }

  // 5. Build top domains list, sorted descending
  const topDomains = Object.entries(domainDurations)
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5); // Limit to top 5 domains

  return {
    trackingPaused,
    activeSession,
    todayTotals: {
      totalDurationMs,
      totalVisits,
      uniqueDomainsCount: uniqueDomains.size
    },
    topDomains,
    snapshotGeneratedAt: nowMs
  };
}
