/**
 * productivity-rules.ts
 *
 * Local rule definitions and validation mechanisms for productivity classification.
 * Restricts remote connections, enforces bounds, and validates schemas offline.
 */

export type ProductivityCategory = "productive" | "distracting" | "neutral" | "unknown";

export interface ProductivityRule {
  domain: string;
  category: ProductivityCategory;
  priority: number;
  createdAt: number;
  isCustom?: boolean;
}

export const RULESET_VERSION = 1;
export const MAX_CUSTOM_RULES = 200;

// High-level dangerous TLDs/generic labels that cannot be mapped to avoid matching broad suffixes
const DANGEROUS_GENERIC_SUFFIXES = new Set([
  "com", "org", "net", "edu", "gov", "mil", "int", "co", "io", "me", "in", "us", "uk", "app", "dev", "so", "tv"
]);

// Multi-segment public suffix lists that shouldn't be mapped directly as broad custom rules
const DANGEROUS_TWO_SEGMENT_SUFFIXES = new Set([
  "co.uk", "org.uk", "me.uk", "ltd.uk", "plc.uk",
  "com.au", "net.au", "org.au", "co.in", "net.in",
  "org.in", "co.nz", "net.nz", "co.za", "co.jp",
  "com.br", "net.br", "com.cn", "net.cn"
]);

/**
 * Static Default Ruleset
 * Curated, non-judgmental starting category bounds.
 */
export const DEFAULT_RULES: ProductivityRule[] = [
  { domain: "github.com", category: "productive", priority: 1, createdAt: 1715900000000 },
  { domain: "stackoverflow.com", category: "productive", priority: 1, createdAt: 1715900000000 },
  { domain: "docs.google.com", category: "productive", priority: 1, createdAt: 1715900000000 },
  { domain: "notion.so", category: "productive", priority: 1, createdAt: 1715900000000 },
  { domain: "figma.com", category: "productive", priority: 1, createdAt: 1715900000000 },
  { domain: "localhost", category: "productive", priority: 1, createdAt: 1715900000000 },
  { domain: "youtube.com", category: "distracting", priority: 1, createdAt: 1715900000000 },
  { domain: "facebook.com", category: "distracting", priority: 1, createdAt: 1715900000000 },
  { domain: "twitter.com", category: "distracting", priority: 1, createdAt: 1715900000000 },
  { domain: "x.com", category: "distracting", priority: 1, createdAt: 1715900000000 },
  { domain: "reddit.com", category: "distracting", priority: 1, createdAt: 1715900000000 },
  { domain: "instagram.com", category: "distracting", priority: 1, createdAt: 1715900000000 },
  { domain: "netflix.com", category: "distracting", priority: 1, createdAt: 1715900000000 }
];

/**
 * Performs strict validation over a rule payload before persistence.
 * Prevents wildcard explosions, protocol injections, or path pollution.
 *
 * @returns string explaining the validation failure, or null if valid.
 */
export function validateProductivityRule(rule: Partial<ProductivityRule>): string | null {
  if (!rule) {
    return "Rule is empty or null.";
  }

  // 1. Domain Validation
  if (typeof rule.domain !== "string" || !rule.domain) {
    return "Domain must be a non-empty string.";
  }

  const rawDomain = rule.domain.trim();
  if (rawDomain !== rule.domain) {
    return "Domain cannot contain leading or trailing whitespaces.";
  }

  const cleanDomain = rawDomain.toLowerCase();
  if (cleanDomain !== rule.domain) {
    return "Domain must be completely lowercase.";
  }

  if (cleanDomain.includes("://")) {
    return "Domain cannot contain protocol prefixes (e.g. http:// or https://).";
  }

  if (cleanDomain.includes("/")) {
    return "Domain cannot contain path parameters or slash suffixes.";
  }

  if (cleanDomain.includes("*")) {
    return "Wildcards (*) are forbidden. Suffix matching is supported automatically.";
  }

  // Split and validate segments
  const segments = cleanDomain.split(".");
  if (segments.some(s => !s)) {
    return "Domain contains empty segments (e.g. duplicate dots).";
  }

  if (segments.length === 1 && segments[0] !== "localhost") {
    return "Domain must be a fully qualified domain name (FQDN) or 'localhost'.";
  }

  // 2. Dangerous Suffix Bounds
  if (segments.length === 1 && DANGEROUS_GENERIC_SUFFIXES.has(cleanDomain)) {
    return `Domain matching cannot be a generic high-level suffix (e.g. '.${cleanDomain}').`;
  }

  if (segments.length === 2 && DANGEROUS_TWO_SEGMENT_SUFFIXES.has(cleanDomain)) {
    return `Domain matching is too generic and matches entire double-segment TLD '${cleanDomain}'.`;
  }

  // 3. Category Validation
  const validCategories = new Set<ProductivityCategory>(["productive", "distracting", "neutral", "unknown"]);
  if (!rule.category || !validCategories.has(rule.category)) {
    return "Invalid productivity category selection.";
  }

  // 4. Priority Validation
  if (typeof rule.priority !== "number" || !Number.isInteger(rule.priority)) {
    return "Priority must be a valid integer.";
  }

  if (rule.priority < 1 || rule.priority > 100) {
    return "Priority value must be bounded between 1 and 100 inclusive.";
  }

  return null;
}

/** Retrieves custom override rules from chrome.storage.local. */
export async function getCustomRules(): Promise<ProductivityRule[]> {
  try {
    const data = await chrome.storage.local.get("customRules");
    return Array.isArray(data.customRules) ? data.customRules : [];
  } catch (err) {
    console.error("[ProductivityRules] Failed to retrieve custom rules from storage", err);
    return [];
  }
}

/** Persists custom override rules list after validation verification. */
export async function saveCustomRules(rules: ProductivityRule[]): Promise<{ success: boolean; error?: string }> {
  if (rules.length > MAX_CUSTOM_RULES) {
    return { success: false, error: `Custom rules count exceeds safe limit of ${MAX_CUSTOM_RULES}.` };
  }

  // Validate every entry
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule) continue;
    const error = validateProductivityRule(rule);
    if (error) {
      return { success: false, error: `Rule at index ${i} (${rule.domain}) is invalid: ${error}` };
    }
  }

  try {
    await chrome.storage.local.set({ customRules: rules });
    // Emit custom rules update notification
    chrome.runtime.sendMessage({ type: "BROADCAST_RULES_UPDATED", version: 1 }).catch(() => {
      // Receiver might not be active, ignore
    });
    return { success: true };
  } catch (err) {
    console.error("[ProductivityRules] Failed to persist custom rules", err);
    return { success: false, error: String(err) };
  }
}
