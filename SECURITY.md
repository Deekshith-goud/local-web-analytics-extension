# Security Policy 🛡️

## Our Privacy-First Commitment

**Local Browse Analytics** is designed from the ground up as a privacy-first, on-device-only browser extension. We guarantee:
1. **Zero Remote Data Storage**: All stats are stored solely in your local browser's IndexedDB database.
2. **Zero Telemetry**: No tracking pixels, Google Analytics, Sentry reporting, or other external monitoring.
3. **No External Network Permissions**: We request no host permissions, meaning the extension is physically blocked by Chrome from communicating with external servers.

---

## Supported Versions

Only the latest release of the extension is supported for security patches. Please ensure you are running the most up-to-date version:

| Version | Supported |
| ------- | --------- |
| >= 1.0  | ✅ Yes    |
| < 1.0   | ❌ No     |

---

## Reporting a Vulnerability

If you discover a potential security vulnerability (e.g., cross-site scripting (XSS) in the dashboard, DOM injection in content scripts, or a sandbox escape), please report it responsibly:

1. **Do NOT open a public issue** on GitHub for security vulnerabilities.
2. Email reports to the maintainer: **Deekshith Goud** (deekshithgoud7101@gmail.com).
3. In your report, please include:
   - A description of the vulnerability and its potential impact.
   - Detailed step-by-step instructions to reproduce the vulnerability (proof of concept).
   - Any suggested remediations or patches.

Once received, we will acknowledge the report within 48 hours, investigate the issue, and provide a timeline for releasing a security patch.

Thank you for helping keep Local Browse Analytics secure for everyone!
