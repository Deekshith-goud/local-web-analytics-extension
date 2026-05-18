# Release Verification & Checklist 🛡️

This document outlines the strict pre-release validation protocols, performance budgets, and regression testing procedures for the privacy-first browser analytics extension. Follow these instructions before publishing any version to the Chrome Web Store.

---

## 1. Compliance Audit & Permissions Justification

Verify that permissions declared in `manifest.json` are minimal and precisely justified:

| Declared Permission | Purpose & Technical Justification | Risk Classification |
|---|---|---|
| `storage` | Persistent storage of rules and user UI states via local storage API. | **Low** — Locked to local device only. |
| `tabs` | Active navigation inspection to determine duration, tab transitions, and focus tracking. | **Medium** — Critical for engine accuracy; restricted from reading tab content or page scripts. |
| `idle` | Detects when the user goes idle or locks the screen to stop duration tracking. | **Low** — Prevents inflating active tracking statistics. |
| `windows` | Detects when application windows change focus or go minimized. | **Low** — Standard window focus query. |
| `webNavigation` | Detects page loading events to map transitions. | **Medium** — Essential for tracking state machines without reading DOM. |

### Permissions Verification Step:
Run the security verifier to assert only these permissions are packed:
```bash
bun run package
```

---

## 2. Runtime Performance & Latency Budgets

To keep the extension lightweight, all service worker tasks must adhere to strict performance ceilings:

- **CPU Overhead**: Service worker wake duration on page transitions must be `< 30ms`.
- **Memory Footprint**: Volatile ring buffers and classifier structures must stay `< 8MB` peak RAM.
- **Storage Database Budget**:
  - Compaction should occur once every 24 hours (or at 500 entry intervals).
  - Average storage growth should not exceed `50KB` per active week.
- **Cooperative Scheduler Yield**: All batch loops and database writes must yield execution back to the browser event loop every `100ms` using `cooperativeYield()`.

---

## 3. Offline Mock-Data Simulation Checks

To perform a regression test under offline conditions, simulate browse activity in a clean browser profile:

1. **Enable Offline Mode**: Disconnect the machine from Wi-Fi / Ethernet completely.
2. **Launch Developer Profile**:
   - Open Chrome `chrome://extensions/`.
   - Toggle **Developer Mode** on the top right.
   - Click **Load Unpacked** and select `build/chrome-mv3-prod` or developer build folders.
3. **Execute Simulation Scenarios**:
   - Open standard local files or browse mock hostnames (e.g., set up local hosts aliases).
   - Verify that the Floating Blob UI mounts inside content scripts with zero errors.
   - Verify that the Popup UI correctly fetches today's analytics overview.
4. **Offline Isolation Validation**:
   - Inspect the **Network Tab** of the Background Service Worker.
   - Assert that **zero network calls** are attempted under any user action (tab change, classification rule saving, data export/import, data purging).

---

## 4. Multi-Step Database Wiping Audit

Before wrapping the release, perform manual verification of the "Danger Zone" purge logic:

1. Navigate to the **Settings & Privacy** tab in the main Analytics Dashboard.
2. Click **Purge On-Device Database**. Verify that the modal overlay blocks interaction.
3. Type `CANCEL` or arbitrary strings. Assert the "Confirm Purge" button remains disabled.
4. Close the modal, open it again. Verify the confirmation text is reset.
5. Type `PURGE` exactly and confirm.
6. Verify that:
   - All charts return to the empty state (rendered with clean raw SVGs).
   - Customized productivity rules are restored to standard defaults.
   - Volatile today/historical caches are fully invalidated.
   - Service worker returns a clean success response.

---

## 5. Automated Build Packaging

Verify that the final zip file is generated with strict checksums:
```bash
bun run package
```
Verify that the `release-manifest.json` is populated inside `build/chrome-mv3-prod/` and check its contents for integrity.
