# Contributing to Local Browse Insights

First off, thank you for considering contributing to Local Browse Insights! It's people like you that make open-source software such a great community.

## 🔒 The Golden Rule: Privacy First

This extension is built on an absolute commitment to user privacy. **Under no circumstances will any PR be accepted if it introduces:**
- Telemetry or analytics (Google Analytics, Mixpanel, Sentry, etc.)
- External network requests to third-party APIs (unless strictly opt-in and explicitly required for a core feature)
- Remote script execution or `eval()`
- Exfiltration of user browsing history, settings, or rulesets

All processing, storage, and analysis must remain **100% on-device**.

## 🛠️ Tech Stack
- **Framework**: Plasmo
- **UI**: React 18 & Vanilla CSS
- **Database**: Dexie.js (IndexedDB)
- **Package Manager**: Bun

## 🚀 Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/local-web-analytics-extension.git
   cd local-web-analytics-extension
   ```
3. **Install dependencies** using Bun:
   ```bash
   bun install
   ```
4. **Target-specific builds**:
   - **Chrome**:
     ```bash
     bun run dev          # Dev server with HMR
     bun run build:chrome # Production build
     bun run package:chrome # Security & bundle audit
     ```
   - **Safari (macOS & iOS)**:
     ```bash
     bun run build:safari   # Build Safari MV3 & sync to Xcode resources
     bun run package:safari # Release security audit for Safari
     ```
5. **Testing the Safari Extension locally**:
   - Open `safari/Local Web Analytics.xcodeproj` in Xcode.
   - In Safari, ensure **"Allow Unsigned Extensions"** is enabled in the **Develop** menu.
   - Run the macOS host app from Xcode, then enable **Local Web Analytics** in Safari Extensions settings.

## 📝 Pull Request Process

1. Create a new branch from `main` (`git checkout -b feature/amazing-feature`).
2. Make your changes. Ensure your code follows the existing style and is strictly typed with TypeScript.
3. Verify cross-browser compatibility:
   - Ensure all extension APIs use standard `chrome.*` or cross-browser polyfills (`src/utils/browser-compat.ts`).
   - Keep service worker event listeners synchronous at module startup to prevent cold-start event drops in Safari MV3.
   - Never call browser-specific APIs (e.g., `chrome.offscreen`) without safe runtime feature-guards.
4. Run testing, formatting, and linting:
   ```bash
   bun run test
   bun run lint
   bun run package:chrome
   bun run package:safari
   ```
5. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(dashboard): add new chart view`
   - `fix(tracking): resolve idle timeout bug`
   - `docs(readme): fix typo`
6. Push to your branch and open a Pull Request against the `main` branch.

## 🐛 Found a Bug or Have a Feature Request?

Please open an issue on GitHub using the provided issue templates. Make sure to check if a similar issue already exists before opening a new one!
