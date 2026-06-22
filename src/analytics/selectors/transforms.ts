import type { ProductivityCategory } from "../productivity-rules";
/**
 * selectors/transforms.ts
 *
 * Visual Data Transformation Layer.
 *
 * 100% PURE, DETERMINISTIC FUNCTIONS ONLY.
 * Never queries IndexedDB, never mutates state, never accesses globals/time.
 * Takes raw inputs and returns coordinates/structures for rendering.
 * Allows safe memoization inside React components.
 */

import type { DailyTotal, DailyDomainStat } from "../../types/tracking";
import { calculateDerivedMetrics, type DerivedMetrics } from "./metrics";

export interface TimelineItem {
  date: string; // YYYY-MM-DD
  durationMs: number;
  visitCount: number;
  productiveMs: number;
  distractingMs: number;
}

export interface DomainLeaderboardItem {
  domain: string;
  durationMs: number;
  visitCount: number;
}

export interface HistoricalAggregates {
  metrics: DerivedMetrics;
  timeline: TimelineItem[];
  topDomains: DomainLeaderboardItem[];
}

export interface SVGBarCoordinate {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  valueLabel: string;
  rawDate: string;
}

export interface SVGLineCoordinate {
  x: number;
  y: number;
  rawDate: string;
  valueLabel: string;
}

/**
 * Normalizes daily totals and domain stats over a solid range of continuous dates.
 * Fills in missing days with zero values to maintain visual continuity.
 */
export function aggregateHistoricalStats(
  allDates: string[],
  dbTotals: DailyTotal[],
  dbDomainStats: DailyDomainStat[],
  domainCategories: Record<string, ProductivityCategory> = {}
): HistoricalAggregates {
  // 1. Build map of existing totals
  const totalsMap = new Map<string, DailyTotal>();
  for (const t of dbTotals) {
    totalsMap.set(t.date, t);
  }

  // 2. Aggregate domain stats across the entire range and calculate daily classifications
  const domainAggregates = new Map<string, { durationMs: number; visitCount: number }>();
  const dailyClassifications = new Map<string, { productiveMs: number; distractingMs: number }>();

  for (const stat of dbDomainStats) {
    // Overall domain aggregates
    const existing = domainAggregates.get(stat.domain) || { durationMs: 0, visitCount: 0 };
    domainAggregates.set(stat.domain, {
      durationMs: existing.durationMs + stat.durationMs,
      visitCount: existing.visitCount + stat.visitCount,
    });

    // Daily productivity breakdown
    const category = domainCategories[stat.domain] || "unknown";
    const dailyExisting = dailyClassifications.get(stat.date) || { productiveMs: 0, distractingMs: 0 };
    if (category === "productive") {
      dailyExisting.productiveMs += stat.durationMs;
    } else if (category === "distracting") {
      dailyExisting.distractingMs += stat.durationMs;
    }
    dailyClassifications.set(stat.date, dailyExisting);
  }

  // 3. Build continuous timeline series
  let aggregatedMs = 0;
  let aggregatedVisits = 0;
  const timeline: TimelineItem[] = allDates.map((dateStr) => {
    const record = totalsMap.get(dateStr);
    const durationMs = record ? record.totalDurationMs : 0;
    const visitCount = record ? record.totalVisits : 0;
    
    const classifications = dailyClassifications.get(dateStr) || { productiveMs: 0, distractingMs: 0 };

    aggregatedMs += durationMs;
    aggregatedVisits += visitCount;

    return {
      date: dateStr,
      durationMs,
      visitCount,
      productiveMs: classifications.productiveMs,
      distractingMs: classifications.distractingMs,
    };
  });



  const topDomains: DomainLeaderboardItem[] = Array.from(domainAggregates.entries())
    .map(([domain, data]) => ({
      domain,
      durationMs: data.durationMs,
      visitCount: data.visitCount,
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  const uniqueDomainsCount = domainAggregates.size;

  // 4. Compute Productivity Breakdown Durations
  let productiveDurationMs = 0;
  let distractingDurationMs = 0;
  let neutralDurationMs = 0;
  let unknownDurationMs = 0;

  for (const [domain, data] of domainAggregates.entries()) {
    const category = domainCategories[domain] || "unknown";
    if (category === "productive") {
      productiveDurationMs += data.durationMs;
    } else if (category === "distracting") {
      distractingDurationMs += data.durationMs;
    } else if (category === "neutral") {
      neutralDurationMs += data.durationMs;
    } else {
      unknownDurationMs += data.durationMs;
    }
  }

  // 5. Compute Derived Metrics
  const metrics = calculateDerivedMetrics(
    aggregatedMs,
    aggregatedVisits,
    uniqueDomainsCount,
    productiveDurationMs,
    distractingDurationMs,
    neutralDurationMs,
    unknownDurationMs
  );

  return {
    metrics,
    timeline,
    topDomains,
  };
}

/**
 * Groups adjacent timeline points into chunks if the dates exceed a maximum count.
 * Prevents visual rendering bottleneck of drawing 100+ SVG items.
 */
export function downsampleTimeline(
  timeline: TimelineItem[],
  maxPoints: number = 14
): TimelineItem[] {
  if (timeline.length <= maxPoints) {
    return timeline;
  }

  const chunkSize = Math.ceil(timeline.length / maxPoints);
  const result: TimelineItem[] = [];

  for (let i = 0; i < timeline.length; i += chunkSize) {
    const chunk = timeline.slice(i, i + chunkSize);
    const firstItem = chunk[0];
    const lastItem = chunk[chunk.length - 1];
    let label = "";
    if (firstItem && lastItem && chunk.length > 1) {
      label = `${firstItem.date.substring(5)} to ${lastItem.date.substring(5)}`;
    } else if (firstItem) {
      label = firstItem.date;
    }

    const durationMs = chunk.reduce((sum, item) => sum + item.durationMs, 0);
    const visitCount = chunk.reduce((sum, item) => sum + item.visitCount, 0);
    const productiveMs = chunk.reduce((sum, item) => sum + item.productiveMs, 0);
    const distractingMs = chunk.reduce((sum, item) => sum + item.distractingMs, 0);

    result.push({
      date: label,
      durationMs,
      visitCount,
      productiveMs,
      distractingMs,
    });
  }

  return result;
}

/**
 * Transforms timeline datasets purely deterministically into SVG bar chart layouts.
 * Computes coordinates relative to a coordinate viewport grid.
 */
export function computeBarCoordinates(
  timeline: TimelineItem[],
  width: number,
  height: number,
  padding: { top: number; bottom: number; left: number; right: number }
): SVGBarCoordinate[] {
  if (timeline.length === 0) return [];

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find max duration in dataset
  const maxDuration = Math.max(...timeline.map((item) => item.durationMs), 1000);

  const barCount = timeline.length;
  const gapRatio = 0.25; // 25% gap between bars
  const totalBarSpace = chartWidth / barCount;
  let barWidth = totalBarSpace * (1 - gapRatio);
  if (barWidth > 56) barWidth = 56; // Limit max width for aesthetic reasons

  return timeline.map((item, idx) => {
    // Coordinate offsets (centered in the available space)
    const cx = padding.left + idx * totalBarSpace + totalBarSpace / 2;
    const x = cx - barWidth / 2;
    const barHeight = (item.durationMs / maxDuration) * chartHeight;
    const y = height - padding.bottom - barHeight;

    // Build duration text
    const minutes = Math.round(item.durationMs / 60000);
    const hoursVal = (item.durationMs / 3600000).toFixed(1);
    const valueLabel = minutes >= 60 ? `${hoursVal}h` : `${minutes}m`;

    return {
      x,
      y,
      width: barWidth,
      height: Math.max(2, barHeight), // Minimum height of 2px for visual visibility
      label: item.date.includes(":") ? item.date : item.date.substring(5), // Short date MM-DD or HH:00
      valueLabel,
      rawDate: item.date,
    };
  });
}

/**
 * Transforms timeline datasets purely deterministically into SVG line chart points.
 * Returns coordinates to draw path nodes and markers safely.
 */
export function computeLineCoordinates(
  timeline: TimelineItem[],
  width: number,
  height: number,
  padding: { top: number; bottom: number; left: number; right: number }
): SVGLineCoordinate[] {
  if (timeline.length === 0) return [];

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxDuration = Math.max(...timeline.map((item) => item.durationMs), 1000);
  const pointCount = timeline.length;

  const stepX = pointCount > 1 ? chartWidth / (pointCount - 1) : chartWidth;

  return timeline.map((item, idx) => {
    const x = padding.left + idx * stepX;
    const valueRatio = item.durationMs / maxDuration;
    const y = height - padding.bottom - valueRatio * chartHeight;

    const minutes = Math.round(item.durationMs / 60000);
    const hoursVal = (item.durationMs / 3600000).toFixed(1);
    const valueLabel = minutes >= 60 ? `${hoursVal}h` : `${minutes}m`;

    return {
      x,
      y,
      rawDate: item.date,
      valueLabel,
    };
  });
}
