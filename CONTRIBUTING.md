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
4. **Run the development server**:
   ```bash
   bun run dev
   ```
5. **Load the unpacked extension** in Chrome from `build/chrome-mv3-dev`.

## 📝 Pull Request Process

1. Create a new branch from `main` (`git checkout -b feature/amazing-feature`).
2. Make your changes. Ensure your code follows the existing style and is strictly typed with TypeScript.
3. Verify your changes don't introduce security vulnerabilities or violate the CSP.
4. Run formatting and linting:
   ```bash
   bun run lint
   bun x tsc --noEmit
   ```
5. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(dashboard): add new chart view`
   - `fix(tracking): resolve idle timeout bug`
   - `docs(readme): fix typo`
6. Push to your branch and open a Pull Request against the `main` branch.

## 🐛 Found a Bug or Have a Feature Request?

Please open an issue on GitHub using the provided issue templates. Make sure to check if a similar issue already exists before opening a new one!
