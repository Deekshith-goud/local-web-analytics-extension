<div align="center">
  <img src="assets/logo-banner.png" alt="Local Browse Insights Logo" width="600" />
  <p><strong>Private Time Analytics & Productivity Dashboard</strong></p>
  
  <p>
    <a href="https://github.com/Deekshith-goud/local-web-analytics-extension/actions/workflows/main.yml"><img src="https://github.com/Deekshith-goud/local-web-analytics-extension/actions/workflows/main.yml/badge.svg" alt="CI Build Status" /></a>
    <a href="https://github.com/Deekshith-goud/local-web-analytics-extension/releases"><img src="https://img.shields.io/github/v/release/Deekshith-goud/local-web-analytics-extension?style=flat-square" alt="Latest Release" /></a>
    <a href="https://github.com/Deekshith-goud/local-web-analytics-extension/issues"><img src="https://img.shields.io/github/issues/Deekshith-goud/local-web-analytics-extension?style=flat-square" alt="Open Issues" /></a>
    <a href="https://github.com/Deekshith-goud/local-web-analytics-extension/stargazers"><img src="https://img.shields.io/github/stars/Deekshith-goud/local-web-analytics-extension?style=social" alt="Stars" /></a>
    <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License" />
    <img src="https://img.shields.io/badge/privacy-100%25_local-success.svg" alt="Privacy First" />
    <img src="https://img.shields.io/badge/telemetry-ZERO-critical.svg" alt="Zero Telemetry" />
  </p>
  
  <p><em>If you find this extension helpful, consider giving it a ⭐ on GitHub!</em></p>
</div>

---

## 📖 About the Project

**Local Browse Insights** provides detailed, actionable insights into your daily browsing habits without compromising your privacy. 

Unlike other productivity tools that send your history to remote servers, **100% of our tracking, analysis, and data storage occurs locally on your machine.**

Understand where your time goes, track your "Focus Hours," and view a beautiful dashboard of your internet activity—all without a single byte of your data ever leaving your browser.

---

## ✨ Key Features

- **📊 100% Local Analytics Dashboard**: Interactive UI with custom, zero-dependency SVG charts tracking your browsing time and focus hours.
- **🎯 Productivity Classifier**: Rule-based engine to label websites (Productive, Distracting, Neutral) and calculate your daily Productivity Score.
- **💬 Floating Insights Widget**: A draggable, non-invasive overlay seamlessly injected into your active tab for real-time tracking.
- **⚙️ Complete Privacy Control**: Absolute zero telemetry, no external server calls, and a built-in irreversible database purge for peace of mind.

---

## 🛡️ Privacy Policy & Local-First Guarantee

We believe your browsing history is deeply personal. **Local Browse Insights** adheres to the following strict privacy guarantees:

1. **Zero Remote Processing**: No accounts are required. No cloud backups, no AI profiling, and no server-side rendering. Everything runs in your browser's sandboxed Service Worker.
2. **Zero Telemetry**: We do not use Google Analytics, tracking pixels, crash reporters, or any other external monitoring tools. 
3. **No External Connections**: The extension's `manifest.json` deliberately omits `host_permissions` outside of local execution, meaning the extension literally *cannot* make network requests to external servers.
4. **Data Ownership**: You have complete control over your data. A built-in "Danger Zone" allows you to permanently and securely purge all IndexedDB records, local storage caches, and configurations with a multi-step confirmation.

---

## 🔒 Security Architecture

This extension was engineered over 10 rigorous phases with a focus on defense-in-depth:
- **Deny-by-Default Gateway**: All internal messaging passes through a strict context-aware capability validator.
- **XSS Mitigation**: Content scripts operate in isolated worlds. We never use `eval()`, `new Function()`, or unsafe inline scripts.
- **Automated Security Pipelines**: Custom CI scripts audit manifest permissions, CSP directives, and dangerous APIs on every build to prevent accidental permission creep.

---

## 🛠️ Tech Stack

- **Framework**: [Plasmo](https://docs.plasmo.com/) - The ultimate browser extension framework.
- **UI/Components**: React 18, HTML5/CSS3 (Vanilla CSS for max control and zero bloat).
- **Database**: Dexie.js (Robust IndexedDB wrapper for local storage).
- **Language**: TypeScript (Strict mode enabled).
- **Package Manager**: Bun (for blisteringly fast builds and dependency resolution).

---

## 🚀 Getting Started

### Prerequisites
Before you begin, ensure you have the following installed on your machine:
- **[Bun](https://bun.sh/)** (v1.0 or higher) - Required for ultra-fast dependency resolution and running scripts.
- **[Node.js](https://nodejs.org/)** (v18 or higher) - Recommended as a fallback runtime for certain underlying build tools.
- **Git** - For cloning the repository.

### Installation & Development Setup

1. **Clone the repository**
   Open your terminal (Command Prompt, PowerShell, or bash) and run:
   ```bash
   git clone https://github.com/Deekshith-goud/local-web-analytics-extension.git
   cd local-web-analytics-extension
   ```

2. **Install dependencies**
   It is critical to install dependencies before attempting to run any code. Execute:
   ```bash
   bun install
   ```
   *(Note: If you encounter any installation errors, try running `bun pm cache rm` to clear the cache, then run `bun install` again).*

3. **Start the development server**
   Run the following command to start the Plasmo development server:
   ```bash
   bun run dev
   ```
   *This command compiles the extension and watches for file changes.*

4. **Load the Extension in Chrome**
   If the browser doesn't open the extension automatically, you must load it manually:
   - Open Google Chrome and navigate to `chrome://extensions/`
   - Toggle **"Developer mode"** on in the top-right corner.
   - Click the **"Load unpacked"** button in the top-left.
   - Navigate to the project folder and select the newly created `build/chrome-mv3-dev` directory.
   
   The extension is now installed locally and will hot-reload automatically as you make code changes!

### Production Build & Packaging
To build a production-ready, minified version of the extension:
```bash
bun run build
```
To run automated security audits and package it into a zip file for the Chrome Web Store:
```bash
bun run package
```
*This verifies permissions, CSP, bundle size, and generates a deterministic `release-manifest.json` before zipping into `build/chrome-mv3-prod.zip`.*

### 🏷️ Release Management & Tagging

This project uses automated GitHub Actions workflows to publish releases and extension packages when new versions are tagged.

#### How to publish a release:
1. **Increment version**: Update the `version` field in `package.json` (e.g., `"1.0.0"` -> `"1.1.0"`).
2. **Create and push a Git Tag**:
   ```bash
   git tag -a v1.1.0 -m "Release version 1.1.0"
   git push origin v1.1.0
   ```
3. **Automated Workflow**:
   - The `.github/workflows/release.yml` workflow triggers on the tag push.
   - It performs strict security checks, permissions audits, and CSP scans.
   - It generates `build/chrome-mv3-prod.zip` (extension package) and `build/chrome-mv3-prod/release-manifest.json` (build fingerprint).
   - It automatically publishes a new GitHub Release with the build zip and manifest attached.

#### 🛡️ Verifying Release Integrity:
You can verify the authenticity of the release asset (`chrome-mv3-prod.zip`) against the fingerprint in `release-manifest.json`:
1. Download both the zip and manifest from the GitHub Release.
2. Run a SHA-256 checksum on the files:
   ```bash
   # Windows PowerShell
   Get-FileHash chrome-mv3-prod.zip -Algorithm SHA256
   
   # Linux / macOS
   shasum -a 256 chrome-mv3-prod.zip
   ```
3. Compare the checksum value with the hash of `chrome-mv3-prod.zip` inside `release-manifest.json`. They must match exactly.

---

## 🤝 Contributing

Open source contributions are warmly welcomed and greatly appreciated! Whether you are fixing bugs, improving the documentation, or proposing new features, here is how you can contribute:

1. **Fork the Project**
2. **Create your Feature Branch** (`git checkout -b feature/AmazingFeature`)
3. **Commit your Changes** (`git commit -m 'feat: add some AmazingFeature'`)
4. **Push to the Branch** (`git push origin feature/AmazingFeature`)
5. **Open a Pull Request**

Please ensure your code passes the linting (`bun run lint`) and typing checks (`bun x tsc --noEmit`) before submitting a pull request. As this is a privacy-first extension, **no PRs adding external tracking, telemetry, or remote API calls will be accepted.**

---

## 🛑 Danger Zone: Purge Data

Need to wipe your data or uninstall? Go to the **Settings & Privacy** tab in the Dashboard, click **Purge On-Device Database**, and type `PURGE` to permanently wipe all local indexed records, customized rules, and caches. Uninstalling the extension from your browser will also automatically clear all associated data.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  <p>Built with 🩵 for privacy advocates.</p>
</div>