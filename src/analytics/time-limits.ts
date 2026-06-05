/**
 * time-limits.ts
 *
 * Local rule definitions and storage for Soft-Block Time Limits.
 */

import type { TimeLimitRule, TimeLimitBypass } from "../types/tracking";

export const MAX_TIME_LIMIT_RULES = 100;

/**
 * Validates a Time Limit Rule before saving.
 */
export function validateTimeLimitRule(rule: Partial<TimeLimitRule>): string | null {
  if (!rule) return "Rule is empty or null.";
  
  if (typeof rule.domain !== "string" || !rule.domain) {
    return "Domain must be a non-empty string.";
  }

  const cleanDomain = rule.domain.trim().toLowerCase();
  if (cleanDomain !== rule.domain) {
    return "Domain must be completely lowercase and trimmed.";
  }

  if (cleanDomain.includes("://") || cleanDomain.includes("/")) {
    return "Domain must not contain protocols or paths.";
  }

  if (typeof rule.maxDurationMs !== "number" || rule.maxDurationMs < 0) {
    return "maxDurationMs must be a positive number.";
  }

  return null;
}

/** Retrieves custom time limit rules from chrome.storage.local. */
export async function getTimeLimitRules(): Promise<TimeLimitRule[]> {
  try {
    const data = await chrome.storage.local.get("timeLimitRules");
    return Array.isArray(data.timeLimitRules) ? data.timeLimitRules : [];
  } catch (err) {
    console.error("[TimeLimits] Failed to retrieve rules from storage", err);
    return [];
  }
}

/** Persists custom time limit rules list after validation. */
export async function saveTimeLimitRules(rules: TimeLimitRule[]): Promise<{ success: boolean; error?: string }> {
  if (rules.length > MAX_TIME_LIMIT_RULES) {
    return { success: false, error: `Rules count exceeds limit of ${MAX_TIME_LIMIT_RULES}.` };
  }

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;
    const error = validateTimeLimitRule(rule);
    if (error) {
      return { success: false, error: `Rule for domain ${rule.domain} is invalid: ${error}` };
    }
  }

  try {
    await chrome.storage.local.set({ timeLimitRules: rules });
    return { success: true };
  } catch (err) {
    console.error("[TimeLimits] Failed to persist rules", err);
    return { success: false, error: String(err) };
  }
}

/** Retrieves all active bypasses from storage. Cleans up expired ones. */
export async function getTimeLimitBypasses(): Promise<TimeLimitBypass[]> {
  try {
    const data = await chrome.storage.local.get("timeLimitBypasses_v2");
    const bypasses = Array.isArray(data.timeLimitBypasses_v2) ? data.timeLimitBypasses_v2 as TimeLimitBypass[] : [];
    
    // Clean up expired bypasses lazily
    const now = Date.now();
    const active = bypasses.filter(b => b.bypassedUntil > now);
    
    if (active.length !== bypasses.length) {
      // Async write-back to clean up storage
      chrome.storage.local.set({ timeLimitBypasses_v2: active }).catch(() => {});
    }
    
    return active;
  } catch (err) {
    console.error("[TimeLimits] Failed to retrieve bypasses", err);
    return [];
  }
}

/** Adds or updates a bypass for a specific domain. */
export async function setTimeLimitBypass(domain: string, durationMs: number): Promise<void> {
  try {
    const active = await getTimeLimitBypasses();
    const existingIndex = active.findIndex(b => b.domain === domain);
    
    const bypassedUntil = Date.now() + durationMs;
    
    if (existingIndex >= 0) {
      active[existingIndex]!.bypassedUntil = bypassedUntil;
    } else {
      active.push({ domain, bypassedUntil });
    }
    
    await chrome.storage.local.set({ timeLimitBypasses_v2: active });
  } catch (err) {
    console.error("[TimeLimits] Failed to set bypass", err);
  }
}
