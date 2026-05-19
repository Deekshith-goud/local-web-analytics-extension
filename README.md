<div align="center">
  <img src="assets/icon128.png" alt="Local Browse Analytics Logo" width="128" height="128" />
  <h1>Local Browse Insights</h1>
  <p><strong>Private Time Analytics & Productivity Dashboard</strong></p>
  
  <p>
    <a href="https://github.com/Deekshith-goud/local-web-analytics-extension/stargazers"><img src="https://img.shields.io/github/stars/Deekshith-goud/local-web-analytics-extension?style=social" alt="Stars" /></a>
    <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version" />
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

- **📊 High-Density Local Analytics**: Interactive dashboards populated by raw SVG charts detailing hostnames visited, Focus hours, and window focus durations. No external charting libraries that phone home.
- **🎯 Productivity Classifier**: Label hostnames as Productive, Distracting, or Neutral. Tailor individual overrides with subdomain rules. The system intelligently compiles these rules to score your daily focus.
- **💬 Floating Insights UI**: A safe, non-invasive overlay summarizing today's active domain focus duration, dynamically injected into your active tab.
- **⚙️ Safe & Secure**: Multi-step irreversible database purge, ring-buffered observability, strict Content Security Policy (CSP), and capability-mapped messaging.
- **🚀 Ultra-Lightweight**: Built with Plasmo, React, and Dexie (IndexedDB), highly optimized for performance. The total production bundle size stays comfortably under 2MB.
- **💾 Export & Import**: Full data portability. Export your custom productivity rules to a JSON file and import them on another device.

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
Make sure you have [Bun](https://bun.sh/) installed on your machine.

### Installation & Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/Deekshith-goud/local-web-analytics-extension.git
   cd local-web-analytics-extension
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Start the development server**
   ```bash
   bun run dev
   ```
   *This will compile the extension and load it into a new Chrome instance automatically with hot-module reloading enabled.*

### Production Build & Packaging
To build a production-ready zip file with automated security audits:
```bash
bun run package
```
*This runs the `package-extension.js` script to verify permissions, CSP, bundle size, and generates a deterministic `release-manifest.json` before zipping.*

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