/**
 * sensitive-sites.ts
 *
 * Centralized checker to flag high-sensitivity URLs that should avoid
 * any content script UI injection (e.g., banking domains, login portals,
 * credential management systems, localhost auth gateways).
 *
 * RATIONALE:
 * Injecting UI elements on highly sensitive pages (such as banking sites or
 * authentication logins) can trigger security filters, looks suspicious to
 * security-conscious users, and increases risk of store rejection.
 */

const SENSITIVE_PATTERNS = [
  // Authentication & Core Providers
  /accounts\.google\.com/i,
  /login\.microsoftonline\.com/i,
  /appleid\.apple\.com/i,
  /github\.com\/login/i,
  /auth\./i,
  /oauth/i,
  /signin/i,
  /signup/i,

  // Financial Services & Payment Gateways
  /paypal\.com/i,
  /stripe\.com/i,
  /chase\.com/i,
  /bankofamerica\.com/i,
  /wellsfargo\.com/i,
  /citibank\.com/i,
  /fidelity\.com/i,

  // System & Internal Sites
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^about:/i,
  /^file:\/\//i
];

/**
 * Checks if a given URL is a sensitive domain/page.
 * Returns true if injection should be blocked.
 */
export function isSensitiveSite(url: string | undefined): boolean {
  if (!url) return true;

  try {
    // Basic format check
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return true; // Exclude system, file, and blank protocols
    }

    return SENSITIVE_PATTERNS.some((pattern) => pattern.test(url));
  } catch (error) {
    // If URL parsing or pattern matching fails, fail-safe and treat as sensitive
    return true;
  }
}
