import { safeParseUrl } from "../utils/url";

/**
 * sensitive-sites.ts
 *
 * Centralized checker to flag high-sensitivity URLs that should avoid
 * any content script UI injection (e.g., banking domains, login portals,
 * credential management systems, system URLs).
 */

export interface SensitiveSitePattern {
  readonly category: "auth" | "financial" | "system" | "manager";
  readonly pattern: RegExp;
}

/**
 * Structured sensitive site patterns catalog.
 * Deeply frozen to prevent runtime mutation or injection.
 */
export const SENSITIVE_PATTERNS: readonly SensitiveSitePattern[] = Object.freeze([
  // Authentication & Core Providers
  { category: "auth", pattern: /accounts\.google\.com/i },
  { category: "auth", pattern: /login\.microsoftonline\.com/i },
  { category: "auth", pattern: /appleid\.apple\.com/i },
  { category: "auth", pattern: /github\.com\/login/i },
  { category: "auth", pattern: /auth\./i },
  { category: "auth", pattern: /oauth/i },
  { category: "auth", pattern: /signin/i },
  { category: "auth", pattern: /signup/i },

  // Password Managers
  { category: "manager", pattern: /bitwarden\.com/i },
  { category: "manager", pattern: /1password\.com/i },
  { category: "manager", pattern: /lastpass\.com/i },
  { category: "manager", pattern: /dashlane\.com/i },

  // Financial Services & Banking
  { category: "financial", pattern: /paypal\.com/i },
  { category: "financial", pattern: /stripe\.com/i },
  { category: "financial", pattern: /chase\.com/i },
  { category: "financial", pattern: /bankofamerica\.com/i },
  { category: "financial", pattern: /wellsfargo\.com/i },
  { category: "financial", pattern: /citibank\.com/i },
  { category: "financial", pattern: /fidelity\.com/i },
  { category: "financial", pattern: /schwab\.com/i },
  { category: "financial", pattern: /capitalone\.com/i },
  { category: "financial", pattern: /hsbc\.com/i },
  { category: "financial", pattern: /barclays\.co\.uk/i },

  // Web3 & Crypto Wallets
  { category: "financial", pattern: /metamask\.io/i },
  { category: "financial", pattern: /phantom\.app/i },
  { category: "financial", pattern: /coinbase\.com/i },
  { category: "financial", pattern: /binance\.com/i },

  // System & Internal Sites
  { category: "system", pattern: /^chrome:\/\//i },
  { category: "system", pattern: /^chrome-extension:\/\//i },
  { category: "system", pattern: /^about:/i },
  { category: "system", pattern: /^file:\/\//i }
]);

/**
 * Checks if a given URL is a sensitive domain/page.
 * Returns true if injection should be blocked.
 * Leverages secure safeParseUrl for defense-in-depth scheme checks.
 */
export function isSensitiveSite(url: string | undefined): boolean {
  if (!url) {
    return true; // Fail-safe
  }

  // centralize parsing through our safety validator (which strips unsafe schemes)
  const parsed = safeParseUrl(url);
  if (!parsed) {
    return true; // If parse fails or scheme is dangerous, fail-secure and treat as sensitive
  }

  const fullUrl = parsed.toString();
  return SENSITIVE_PATTERNS.some((entry) => entry.pattern.test(fullUrl));
}
