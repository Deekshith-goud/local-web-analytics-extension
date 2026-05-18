/**
 * security-fixtures.ts
 *
 * Security test fixtures for manual validation and automated regression testing.
 * Contains malformed payloads, spoofed sender context objects, and coordinate overflows
 * to verify the robustness of validators and message dispatch firewalls.
 */

import type { RuntimeMessage } from "../types/tracking";
import type { BlobUIState } from "./validators";

/**
 * Spoofed sender origin configurations mimicking various surfaces.
 */
export const SENDER_FIXTURES = Object.freeze({
  /** authentic content script context */
  validContentScript: Object.freeze({
    id: "extension-id-placeholder", // Will match runtime.id in tests
    url: "https://github.com/login",
    tab: { id: 101, index: 0, pinned: false, windowId: 1, active: true }
  } as unknown as chrome.runtime.MessageSender),

  /** authentic privileged options tab context */
  validDashboardTab: Object.freeze({
    id: "extension-id-placeholder",
    url: "chrome-extension://extension-id-placeholder/tabs/dashboard.html",
    tab: undefined
  } as unknown as chrome.runtime.MessageSender),

  /** authentic privileged popup context */
  validPopupTab: Object.freeze({
    id: "extension-id-placeholder",
    url: "chrome-extension://extension-id-placeholder/popup.html",
    tab: undefined
  } as unknown as chrome.runtime.MessageSender),

  /** malicious external website origin trying to send extension messages */
  maliciousExternalPage: Object.freeze({
    id: undefined,
    url: "https://malicious-phishing-site.com",
    tab: { id: 202, index: 1, pinned: false, windowId: 2, active: true }
  } as unknown as chrome.runtime.MessageSender),

  /** rouge cross-extension origin attempting connection spoofing */
  rogueCrossExtension: Object.freeze({
    id: "some-other-hostile-extension-id",
    url: "chrome-extension://some-other-hostile-extension-id/popup.html",
    tab: undefined
  } as unknown as chrome.runtime.MessageSender)
});

/**
 * Corrupted local storage coordinates for Blob UI test validation.
 */
export const STORAGE_COORDINATE_FIXTURES = Object.freeze({
  /** standard clean positions */
  pristine: Object.freeze({
    anchorCorner: "bottom-right",
    offsetX: 24,
    offsetY: 24,
    isCollapsed: true
  }),

  /** absurd coordinate values designed to break layouts */
  layoutOverflowGiant: Object.freeze({
    anchorCorner: "top-left",
    offsetX: 999999,
    offsetY: 1234567,
    isCollapsed: false
  }),

  /** invalid string values causing parsing errors */
  corruptStringValues: Object.freeze({
    anchorCorner: "invalid-corner-name",
    offsetX: "one-hundred-pixels",
    offsetY: NaN,
    isCollapsed: "not-a-boolean"
  } as unknown as BlobUIState),

  /** null or undefined fields */
  nullifiedObject: null
});

/**
 * Payload fixtures for the runtime messaging protocol.
 */
export const RUNTIME_MESSAGE_FIXTURES = Object.freeze({
  /** authentic payload containing rule updates */
  validSaveRules: Object.freeze({
    type: "SAVE_PRODUCTIVITY_RULES",
    version: 1,
    rules: [
      {
        domain: "distracting.com",
        category: "distracting",
        priority: 10,
        createdAt: Date.now()
      }
    ]
  } as unknown as RuntimeMessage),

  /** payload missing vital version boundaries */
  missingVersionPayload: Object.freeze({
    type: "GET_TODAY_STATS"
    // version is missing
  } as unknown as RuntimeMessage),

  /** payload referencing an obsolete or unsupported protocol version */
  unsupportedVersionPayload: Object.freeze({
    type: "GET_TODAY_STATS",
    version: 99 // Strict firewall will reject this
  } as unknown as RuntimeMessage),

  /** payload holding an unknown event action type */
  unknownMessageTypePayload: Object.freeze({
    type: "FORMAT_HARD_DRIVE", // Unregistered event action key
    version: 1
  } as unknown as RuntimeMessage),

  /** malformed fields on valid types */
  malformedFieldPayload: Object.freeze({
    type: "TOGGLE_TRACKING",
    version: 1,
    paused: "true-as-a-string" // should be strict boolean
  } as unknown as RuntimeMessage),

  /** empty payload structures */
  emptyPayload: Object.freeze({})
});
