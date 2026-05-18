import { logger } from "./logger";

/**
 * Extracts and preserves the full hostname from a URL.
 * Only allows http: and https: protocols.
 * Strips path, query, hash, etc.
 * E.g., https://docs.github.com/path?query -> docs.github.com
 */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
}

/**
 * Extracts and preserves the full hostname from a URL.
 * Only allows http: and https: protocols.
 * Strips path, query, hash, etc.
 * E.g., https://docs.github.com/path?query -> docs.github.com
 */
export function extractHostname(urlStr: string | undefined): string | null {
  if (!urlStr) {
    return null;
  }

  try {
    const parsedUrl = new URL(urlStr);
    
    // Strict whitelist: only HTTP and HTTPS
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      logger.debug(`[URL Util] Ignored protocol: ${parsedUrl.protocol}`);
      return null;
    }

    // Preserve the full hostname (e.g. docs.github.com)
    return normalizeDomain(parsedUrl.hostname);
  } catch (error) {
    logger.debug(`[URL Util] Failed to parse URL: ${urlStr}`);
    return null;
  }
}

