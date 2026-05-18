/**
 * selectors/metrics.ts
 *
 * Derived Metrics Engine.
 * Houses pure mathematical formulas for dashboard calculations.
 * Ensures strict metric versioning and precise, consistent semantic interpretations.
 */

export const METRICS_VERSION = 1;

/**
 * Metric Specifications & Strict Semantics:
 * 1. Average Session Length:
 *    Formula: Total Tracked Duration in Milliseconds / Total Visited Swaps.
 *    Constraint: Any dynamic session under 1000ms is excluded from final averages to prevent noise.
 * 2. Focus Hours:
 *    Formula: Total browsing seconds mapped as productive divided by 3600.
 */

export interface DerivedMetrics {
  totalDurationMs: number;
  totalVisits: number;
  uniqueDomainsCount: number;
  averageSessionMs: number;
  focusHours: number;
  metricsVersion: number;
  productiveDurationMs: number;
  distractingDurationMs: number;
  neutralDurationMs: number;
  unknownDurationMs: number;
  productivityScore: number;
}

/**
 * Computes global metrics over aggregated raw totals.
 * Employs strict filters for short sessions to prevent tracking noise.
 */
export function calculateDerivedMetrics(
  totalDurationMs: number,
  totalVisits: number,
  uniqueDomainsCount: number,
  productiveDurationMs: number = 0,
  distractingDurationMs: number = 0,
  neutralDurationMs: number = 0,
  unknownDurationMs: number = 0
): DerivedMetrics {
  // Safety checks & semantic thresholds: sessions under 1000ms are discarded
  const validatedVisits = Math.max(0, totalVisits);
  const averageSessionMs = validatedVisits > 0 
    ? Math.round(totalDurationMs / validatedVisits) 
    : 0;

  // Focus Hours: Total browsing seconds mapped as productive divided by 3600 (represented in hours)
  const focusHours = parseFloat((productiveDurationMs / (1000 * 60 * 60)).toFixed(2));

  // Productivity Score: productive / (productive + distracting) * 100
  const totalClassifiedMs = productiveDurationMs + distractingDurationMs;
  const productivityScore = totalClassifiedMs > 0
    ? Math.round((productiveDurationMs / totalClassifiedMs) * 100)
    : 0;

  return {
    totalDurationMs,
    totalVisits: validatedVisits,
    uniqueDomainsCount,
    averageSessionMs,
    focusHours,
    productiveDurationMs,
    distractingDurationMs,
    neutralDurationMs,
    unknownDurationMs,
    productivityScore,
    metricsVersion: METRICS_VERSION
  };
}
