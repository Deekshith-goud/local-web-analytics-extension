import { logger } from "./logger";

/**
 * Normalizes a domain name by removing leading and trailing dots and lowercase conversion.
 */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

/**
 * Standard list of explicitly denied dangerous URL schemes.
 * Deeply frozen to prevent mutation.
 */
export const DENIED_URL_SCHEMES = Object.freeze([
  "javascript:",
  "data:",
  "blob:",
  "filesystem:"
]);

/**
 * Centralized, secure URL parser that wraps V8 instantiation.
 * Rejects malformed strings, dangerous schemes, and non-web protocols safely.
 */
export function safeParseUrl(urlStr: string | undefined): URL | null {
  if (!urlStr) {
    return null;
  }

  try {
    const parsedUrl = new URL(urlStr);
    const protocol = parsedUrl.protocol.toLowerCase();

    // Explicitly reject dangerous schemes
    if (DENIED_URL_SCHEMES.includes(protocol)) {
      logger.debug(`[URL Safety] Explicitly denied URL scheme rejected: ${protocol}`);
      return null;
    }

    // Strict whitelist: only HTTP and HTTPS
    if (protocol !== "http:" && protocol !== "https:") {
      logger.debug(`[URL Safety] Ignored non-web protocol: ${protocol}`);
      return null;
    }

    return parsedUrl;
  } catch (_error) {
    logger.debug(`[URL Safety] Failed to securely parse URL: ${urlStr}`);
    return null;
  }
}

/**
 * Extracts and normalizes the hostname from a URL.
 * Leverages safeParseUrl for strict scheme and security parsing.
 */
export function extractHostname(urlStr: string | undefined): string | null {
  const parsed = safeParseUrl(urlStr);
  if (!parsed) {
    return null;
  }
  return normalizeDomain(parsed.hostname);
}
