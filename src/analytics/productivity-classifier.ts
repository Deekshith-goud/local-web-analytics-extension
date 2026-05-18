/**
 * productivity-classifier.ts
 *
 * Highly optimized, priority-aware local domain productivity classifier.
 * Compiles matching hierarchies, applies O(1) Map lookups, and tracks
 * explanation metadata for debug/audit tools.
 */

import { DEFAULT_RULES, type ProductivityCategory, type ProductivityRule } from "./productivity-rules";

export interface ClassificationResult {
  category: ProductivityCategory;
  matchedRule: string; // audit trail explanation for custom tooltips
}

export class ProductivityClassifier {
  private compiledRules: ProductivityRule[] = [];
  private lookupCache = new Map<string, ClassificationResult>();

  constructor(customRules: ProductivityRule[] = []) {
    this.compileRules(customRules);
  }

  /**
   * Compiles the rule hierarchy:
   * 1. Merges default static presets and custom override rules.
   * 2. Sorts rules by descending priority.
   * 3. Sorts rules by descending suffix string length (longer domains win on equal priority).
   */
  public compileRules(customRules: ProductivityRule[]): void {
    this.lookupCache.clear();

    // Group rules by domain to ensure overrides completely replace defaults with same domain
    const ruleMap = new Map<string, ProductivityRule>();

    // Load defaults
    for (const rule of DEFAULT_RULES) {
      ruleMap.set(rule.domain, { ...rule });
    }

    // Overlay custom overrides
    for (const rule of customRules) {
      ruleMap.set(rule.domain, { ...rule });
    }

    // Sort compiled rules list
    this.compiledRules = Array.from(ruleMap.values()).sort((a, b) => {
      // 1. High priority first
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      // 2. Specific subdomain specificity (longer string length) first
      return b.domain.length - a.domain.length;
    });
  }

  /** Clears the lookup cache. Done when custom rules update. */
  public invalidateCache(): void {
    this.lookupCache.clear();
  }

  /**
   * Classifies a domain hostname locally with O(1) lookup cache fallback.
   * Matches domain boundaries safely (e.g. 'mygithub.com' does NOT match 'github.com').
   */
  public classifyDomain(hostname: string): ClassificationResult {
    if (!hostname) {
      return { category: "unknown", matchedRule: "No domain provided." };
    }

    const cleanHostname = hostname.trim().toLowerCase();

    // 1. Cache hit
    const cached = this.lookupCache.get(cleanHostname);
    if (cached) {
      return cached;
    }

    // 2. Walk priority-aware compiled rules
    for (const rule of this.compiledRules) {
      const ruleDomain = rule.domain;
      
      // Suffix boundary matching check (e.g., matching google.com or sub.google.com, but not mygoogle.com)
      const isMatch = cleanHostname === ruleDomain || cleanHostname.endsWith("." + ruleDomain);
      
      if (isMatch) {
        const result: ClassificationResult = {
          category: rule.category,
          matchedRule: `${hostname} matched rule '${rule.domain}' (priority: ${rule.priority})`
        };
        this.lookupCache.set(cleanHostname, result);
        return result;
      }
    }

    // 3. Fallback: Internal Unknown
    const unknownResult: ClassificationResult = {
      category: "unknown",
      matchedRule: `No classification rules matched '${hostname}' (defaulted to uncategorized)`
    };
    this.lookupCache.set(cleanHostname, unknownResult);
    return unknownResult;
  }
}
