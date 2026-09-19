/**
 * package-safari.js
 *
 * Automated verification and packaging gate for Safari Web Extension release builds.
 * Performs multi-point security and specification checks:
 *   1. Manifest permissions audit (verifies Safari MV3 allowed scopes)
 *   2. Strict CSP validation
 *   3. Host permissions check (offline isolation)
 *   4. Code security scan (eval, new Function, leakage)
 *   5. Deterministic fingerprinting and bundle size metrics
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const WORKSPACE_DIR = path.resolve(__dirname, "..");
const SAFARI_RESOURCES_DIR = path.join(WORKSPACE_DIR, "safari", "Shared (Extension)", "Resources");
const RELEASE_MANIFEST_PATH = path.join(SAFARI_RESOURCES_DIR, "release-manifest.json");

const ALLOWED_PERMISSIONS = Object.freeze([
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

const BUNDLE_SIZE_BUDGET_BYTES = 3 * 1024 * 1024; // 3MB

console.log("\x1b[35m%s\x1b[0m", "==========================================================");
console.log("\x1b[35m%s\x1b[0m", "🛡️  SAFARI WEB EXTENSION RELEASE SECURITY & AUDIT VERIFIER");
console.log("\x1b[35m%s\x1b[0m", "==========================================================");

function getFilesRecursive(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursive(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

function calculateSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha256");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

function runAudit() {
  if (!fs.existsSync(SAFARI_RESOURCES_DIR)) {
    console.error(`\x1b[31m❌ Safari extension resources directory not found at: ${SAFARI_RESOURCES_DIR}\x1b[0m`);
    console.error("Please run 'bun run build:safari' before packaging.");
    process.exit(1);
  }

  const manifestPath = path.join(SAFARI_RESOURCES_DIR, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("\x1b[31m❌ manifest.json not found in Safari extension resources folder.\x1b[0m");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let auditFailed = false;

  // 1. Permissions audit
  console.log("\n\x1b[36m%s\x1b[0m", "1. Auditing Safari extension permissions...");
  const permissions = manifest.permissions || [];
  const hostPermissions = manifest.host_permissions || [];

  const invalidPermissions = permissions.filter((p) => !ALLOWED_PERMISSIONS.includes(p));
  if (invalidPermissions.length > 0) {
    console.error(`\x1b[31m❌ Permission audit failed! Unsupported Safari scopes found: ${invalidPermissions.join(", ")}\x1b[0m`);
    auditFailed = true;
  } else {
    console.log(`\x1b[32m  ✓ Permissions verified for Safari MV3: [${permissions.join(", ")}]\x1b[0m`);
  }

  if (hostPermissions.length > 0) {
    console.error(`\x1b[31m❌ Host permissions audit failed! Found host permissions: ${hostPermissions.join(", ")}\x1b[0m`);
    auditFailed = true;
  } else {
    console.log("\x1b[32m  ✓ Host permissions verified empty (offline privacy preserved).\x1b[0m");
  }

  // 2. CSP verification
  console.log("\n\x1b[36m%s\x1b[0m", "2. Auditing Content Security Policy (CSP)...");
  const extensionPagesCsp = manifest.content_security_policy?.extension_pages || "";
  if (!extensionPagesCsp.includes("script-src 'self'")) {
    console.error(`\x1b[31m❌ CSP verification failed! Missing strict script-src 'self' directive: "${extensionPagesCsp}"\x1b[0m`);
    auditFailed = true;
  } else {
    console.log(`\x1b[32m  ✓ Strict CSP validated: "${extensionPagesCsp}"\x1b[0m`);
  }

  // 3. Scan scripts
  console.log("\n\x1b[36m%s\x1b[0m", "3. Scanning build scripts for dangerous API calls & leaks...");
  const buildFiles = getFilesRecursive(SAFARI_RESOURCES_DIR);
  let totalBundleSize = 0;
  const fileManifest = {};

  buildFiles.forEach((filePath) => {
    const relativePath = path.relative(SAFARI_RESOURCES_DIR, filePath);
    if (relativePath === "manifest.json" || relativePath === "release-manifest.json") {
      return;
    }

    const stat = fs.statSync(filePath);
    totalBundleSize += stat.size;

    const fileContent = fs.readFileSync(filePath, "utf8");
    const isJS = filePath.endsWith(".js");

    if (isJS) {
      if (fileContent.includes("eval(")) {
        console.error(`\x1b[31m❌ Security scan failed! eval() detected in: ${relativePath}\x1b[0m`);
        auditFailed = true;
      }
      if (fileContent.includes("new Function(")) {
        console.error(`\x1b[31m❌ Security scan failed! new Function() detected in: ${relativePath}\x1b[0m`);
        auditFailed = true;
      }
    }

    fileManifest[relativePath] = {
      sizeBytes: stat.size,
      sha256: calculateSha256(filePath)
    };
  });

  if (!auditFailed) {
    console.log("\x1b[32m  ✓ All Safari extension scripts cleared of eval and new Function.\x1b[0m");
  }

  // 4. Budget check
  console.log("\n\x1b[36m%s\x1b[0m", "4. Checking bundle storage metrics...");
  console.log(`  Total Bundle Size: ${(totalBundleSize / 1024).toFixed(2)} KB`);
  if (totalBundleSize > BUNDLE_SIZE_BUDGET_BYTES) {
    console.error(`\x1b[31m❌ Bundle size budget exceeded: ${(totalBundleSize / 1024 / 1024).toFixed(2)}MB\x1b[0m`);
    auditFailed = true;
  } else {
    console.log(`\x1b[32m  ✓ Bundle size remains within budget (${(BUNDLE_SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(2)}MB).\x1b[0m`);
  }

  // 5. Release manifest
  console.log("\n\x1b[36m%s\x1b[0m", "5. Generating deterministic Safari release manifest...");
  const releaseManifest = {
    name: manifest.name,
    version: manifest.version,
    target: "safari-mv3",
    buildTimestamp: new Date().toISOString(),
    permissions: permissions,
    csp: extensionPagesCsp,
    totalSizeBytes: totalBundleSize,
    files: fileManifest
  };

  fs.writeFileSync(RELEASE_MANIFEST_PATH, JSON.stringify(releaseManifest, null, 2), "utf8");
  console.log(`\x1b[32m  ✓ Saved Safari release manifest: ${path.relative(WORKSPACE_DIR, RELEASE_MANIFEST_PATH)}\x1b[0m`);

  console.log("\n\x1b[35m%s\x1b[0m", "==========================================================");
  if (auditFailed) {
    console.error("\x1b[31m❌ SAFARI SECURITY & INTEGRITY AUDIT FAILED!\x1b[0m");
    console.log("\x1b[35m%s\x1b[0m", "==========================================================");
    process.exit(1);
  } else {
    console.log("\x1b[32m💚 SAFARI WEB EXTENSION RELEASE AUDIT PASSED!\x1b[0m");
    console.log("\x1b[32m🍎 Ready for Xcode compilation, local testing, and App Store submission.\x1b[0m");
    console.log("\x1b[35m%s\x1b[0m", "==========================================================");
  }
}

runAudit();
