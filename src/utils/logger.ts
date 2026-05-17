/**
 * Minimal environment-gated logger for the extension.
 * Suppresses logs in production to avoid cluttering background workers.
 */

const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug("[Analytics Debug]", ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info("[Analytics Info]", ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn("[Analytics Warn]", ...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error("[Analytics Error]", ...args);
  }
};
