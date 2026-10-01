/**
 * Cross-browser compatibility utilities for Chrome and Safari WebExtensions.
 * Provides unified access and feature detection across Chromium and WebKit runtimes.
 */

export type ExtensionApiNamespace = typeof chrome;

/**
 * Returns the active extension API root namespace (prefers `chrome` for MV3 compatibility,
 * falling back to standard `browser` WebExtension polyfill if available).
 */
export function getExtensionApi(): ExtensionApiNamespace {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    return chrome;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).browser !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).browser as ExtensionApiNamespace;
  }
  throw new Error("No WebExtension API namespace detected in the current execution context.");
}

/**
 * Detects if the current runtime is Apple Safari WebExtension environment.
 */
export function isSafariExtension(): boolean {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
    if (chrome.runtime.getURL("").startsWith("safari-web-extension://")) {
      return true;
    }
  }
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }
  return false;
}

/**
 * Resolves a favicon URL for a given domain in Chromium environments,
 * returning an empty string in Safari where the Chromium _favicon API is unsupported.
 */
export function getFaviconUrl(domain: string, size = 64): string {
  if (isSafariExtension()) {
    return "";
  }
  if (typeof chrome !== "undefined" && chrome.runtime?.id) {
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent("https://" + domain)}&size=${size}`;
  }
  return "";
}

/**
 * Feature detection helpers for cross-browser extensions.
 */
export const browserFeatures = {
  get hasStorage(): boolean {
    return typeof chrome !== "undefined" && !!chrome.storage?.local;
  },
  get hasTabs(): boolean {
    return typeof chrome !== "undefined" && !!chrome.tabs?.query;
  },
  get hasRuntime(): boolean {
    return typeof chrome !== "undefined" && !!chrome.runtime?.sendMessage;
  },
  get hasAlarms(): boolean {
    return typeof chrome !== "undefined" && !!chrome.alarms?.create;
  },
  get hasIdle(): boolean {
    return typeof chrome !== "undefined" && !!chrome.idle?.onStateChanged;
  },
  get hasOffscreen(): boolean {
    return typeof chrome !== "undefined" && !!chrome.offscreen?.hasDocument;
  }
};
