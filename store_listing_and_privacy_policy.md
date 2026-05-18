# Store Listing & Privacy Policy Metadata 🌐

This document contains the official submission metadata, promotional descriptions, permission justifications, and Privacy Label declarations for submitting the browser extension to the Chrome Web Store.

---

## 1. Store Listing Copy

### Extension Title
`Local Browse Insights — Private Time Analytics`

### Short Description
`Analyze your browsing habits and productivity with 100% private, on-device metrics and interactive visual charts.`

### Long Description
```
Gain deep, on-device visibility into your browsing patterns without compromising your privacy.

Local Browse Insights tracks your daily time spend, site navigations, and focus levels completely offline. All computation, storage, and classification processes happen directly inside your browser. No accounts, no clouds, and absolutely zero tracking.

FEATURES:
★ High-Density Local Analytics: Interactive dashboards populated by raw SVG charts detailing hostnames visited, Focus hours, and window focus durations.
★ Productivity Classifier: Label hostnames as Productive, Distracting, or Neutral. Tailor individual overrides with subdomain rules.
★ Floating Insights UI: Safe, non-invasive overlay summarizing today's active domain focus duration.
★ Data Portability: Export your rules configuration to JSON anytime.
★ Ultimate Safety: Perform an irreversible database purge with a single multi-step typing confirmation.

PRIVACY-FIRST DESIGN:
- Zero Remote Calls: Fully functional offline.
- No Telemetry: No tracking pixels, Google Analytics, or external server integrations.
- Local Storage Only: Stored securely in Dexie IndexedDB and local browser storage.
- Safe Sandboxing: Strict Content Security Policy protects against malicious injections.
```

---

## 2. Privacy Labels Matrix (Chrome Web Store Developer Console)

When publishing to the Chrome Web Store, check the following options under the **Single-Purpose Declaration** and **User Data Privacy** sections:

| Category / Data Type | Collected? | Processed Externally? | Explanation for Reviewer |
|---|---|---|---|
| **Web History** | **Yes** (Locally) | **No** | We log navigation timestamps and hostnames visited to generate local statistics. No raw URLs or navigation logs are sent to external servers. |
| **User Activity** | **Yes** (Locally) | **No** | Idle state transitions and active time sessions are monitored locally to calculate focus percentages. No data is stored externally. |
| **Personally Identifiable Info** | **No** | **No** | The extension does not collect names, email addresses, usernames, accounts, IP addresses, or location data. |
| **Authentication Info** | **No** | **No** | We do not monitor passwords, session tokens, cookies, or any identity provider state. |

### Mandatory Single-Purpose & Privacy Declarations:
- **Zero Telemetry Declaration**: *"We declare that this extension does not use any cloud servers, AI profiling systems, remote logging databases, or analytics suites. 100% of user data is stored on the local device's sandboxed filesystem."*
- **No Sale of Data**: *"This extension does not sell, rent, or transfer user data to third parties, advertising networks, or data brokers under any circumstances."*

---

## 3. Strict Permission Justification Matrix

Before publishing, copy these precise, verified justifications into the Chrome Developer Dashboard for each requested scope:

### `storage`
> *"Essential for storing custom productivity classification overrides, floating UI position coordinates, and UI display settings on the user's local machine."*

### `tabs`
> *"Used to inspect the active tab's hostname in real time to calculate browsing durations. No page scripts are injected and page contents are never read."*

### `idle`
> *"Used to determine when the user locks their screen or goes idle to pause tracking. This guarantees duration statistics are accurate and do not accumulate when the user is away."*

### `windows`
> *"Required to monitor when Chrome windows are minimized, maximized, or lose focus, ensuring that out-of-focus background tabs do not inflate tracking timers."*

### `webNavigation`
> *"Enables the tracking engine state machine to react instantly to page loads and domain switches, mapping navigation duration precisely without polling."*
