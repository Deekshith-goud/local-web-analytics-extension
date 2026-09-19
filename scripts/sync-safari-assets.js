/**
 * sync-safari-assets.js
 *
 * Synchronizes the Plasmo Safari MV3 production build into the Xcode project's
 * embedded Safari Web Extension resources directory (`safari/Shared (Extension)/Resources`).
 *
 * It normalizes manifest permissions to ensure strict compliance with Safari Web Extension
 * specifications (stripping Chromium-only APIs like 'offscreen' and 'favicon').
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const SAFARI_BUILD_DIR = path.join(ROOT_DIR, "build", "safari-mv3-prod");
const SAFARI_RESOURCES_DIR = path.join(ROOT_DIR, "safari", "Shared (Extension)", "Resources");

// Permissions supported natively by Safari Web Extensions
const SAFARI_COMPATIBLE_PERMISSIONS = new Set([
  "activeTab",
  "alarms",
  "contextMenus",
  "cookies",
  "declarativeNetRequest",
  "declarativeNetRequestFeedback",
  "declarativeNetRequestWithHostAccess",
  "geolocation",
  "idle",
  "nativeMessaging",
  "notifications",
  "scripting",
  "storage",
  "tabs",
  "unlimitedStorage",
  "webNavigation"
]);

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function syncSafariAssets() {
  console.log("\x1b[34m%s\x1b[0m", "==========================================================");
  console.log("\x1b[34m%s\x1b[0m", "🍎  SYNCHRONIZING SAFARI WEB EXTENSION ASSETS TO XCODE");
  console.log("\x1b[34m%s\x1b[0m", "==========================================================");

  if (!fs.existsSync(SAFARI_BUILD_DIR)) {
    console.error(`\x1b[31m❌ Safari production build not found at: ${SAFARI_BUILD_DIR}\x1b[0m`);
    console.error("Please run 'bun run build:safari' or 'plasmo build --target=safari-mv3' first.");
    process.exit(1);
  }

  console.log(`Copying build bundle:\n  From: ${SAFARI_BUILD_DIR}\n  To:   ${SAFARI_RESOURCES_DIR}`);
  copyDirRecursive(SAFARI_BUILD_DIR, SAFARI_RESOURCES_DIR);

  // Normalize manifest.json for Safari in both build directory and Xcode resources directory
  const manifestPaths = [
    path.join(SAFARI_BUILD_DIR, "manifest.json"),
    path.join(SAFARI_RESOURCES_DIR, "manifest.json")
  ];

  for (const manifestPath of manifestPaths) {
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

      // Filter permissions for Safari MV3 compatibility
      if (Array.isArray(manifest.permissions)) {
        const originalPermissions = [...manifest.permissions];
        manifest.permissions = manifest.permissions.filter((p) =>
          SAFARI_COMPATIBLE_PERMISSIONS.has(p)
        );
        const omitted = originalPermissions.filter((p) => !SAFARI_COMPATIBLE_PERMISSIONS.has(p));
        if (omitted.length > 0 && manifestPath === manifestPaths[0]) {
          console.log(`\x1b[33m  ℹ Filtered Chrome-only permissions for Safari target: [${omitted.join(", ")}]\x1b[0m`);
        }
        if (manifestPath === manifestPaths[0]) {
          console.log(`\x1b[32m  ✓ Active Safari permissions: [${manifest.permissions.join(", ")}]\x1b[0m`);
        }
      }

      // Ensure background service worker declaration is compliant
      if (manifest.background && manifest.background.service_worker && manifestPath === manifestPaths[0]) {
        console.log(`\x1b[32m  ✓ Safari MV3 Service Worker configured: ${manifest.background.service_worker}\x1b[0m`);
      }

      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
    }
  }


  console.log("\x1b[32m%s\x1b[0m", "✅ Safari assets successfully synchronized into Xcode extension target!");
  console.log("\x1b[34m%s\x1b[0m", "==========================================================");
}

syncSafariAssets();
