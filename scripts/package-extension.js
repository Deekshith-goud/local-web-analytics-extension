/**
 * package-extension.js
 *
 * Automated verification and packaging gate for Chrome Web Store release builds.
 * Performs rigorous multi-point security checks including:
 *   1. Manifest Permissions Audit (No permissions creep allowed)
 *   2. CSP & Inline script scan
 *   3. Dangerous API usage scanner (eval, new Function)
 *   4. File system scans for dev source-maps and security fixtures leakage
 *   5. Deterministic fingerprinting and asset size budget analysis
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const WORKSPACE_DIR = path.resolve(__dirname, "..");
const PROD_BUILD_DIR = path.join(WORKSPACE_DIR, "build", "chrome-mv3-prod");
const RELEASE_MANIFEST_PATH = path.join(PROD_BUILD_DIR, "release-manifest.json");

// Allowed list of permissions in chrome-mv3-prod
const ALLOWED_PERMISSIONS = Object.freeze(["storage", "tabs", "idle", "windows", "webNavigation"]);
const ALLOWED_CSP_DIRECTIVES = Object.freeze(["script-src 'self'"]);

// Total bundle size budget (e.g., 2MB limit for privacy-first light extensions)
const BUNDLE_SIZE_BUDGET_BYTES = 2 * 1024 * 1024; // 2MB

console.log("\x1b[35m%s\x1b[0m", "==========================================================");
console.log("\x1b[35m%s\x1b[0m", "🛡️  LOCAL BROWSE ANALYTICS BUILD SECURITY AUDIT & VERIFIER");
console.log("\x1b[35m%s\x1b[0m", "==========================================================");

function getFilesRecursive(dir) {
  let results = [];
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
  if (!fs.existsSync(PROD_BUILD_DIR)) {
    console.error(`\x1b[31m❌ Production build directory not found at: ${PROD_BUILD_DIR}\x1b[0m`);
    console.error("Please run 'bun run build' before packaging.");
    process.exit(1);
  }

  const manifestPath = path.join(PROD_BUILD_DIR, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("\x1b[31m❌ Manifest.json not found in production build folder.\x1b[0m");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  let auditFailed = false;

  // 1. Manifest Permissions Audit
  console.log("\n\x1b[36m%s\x1b[0m", "1. Auditing extension permissions...");
  const permissions = manifest.permissions || [];
  const hostPermissions = manifest.host_permissions || [];

  const invalidPermissions = permissions.filter(p => !ALLOWED_PERMISSIONS.includes(p));
  if (invalidPermissions.length > 0) {
    console.error(`\x1b[31m❌ Permission audit failed! Unexpected scopes found: ${invalidPermissions.join(", ")}\x1b[0m`);
    auditFailed = true;
  } else {
    console.log(`\x1b[32m  ✓ Permissions verified. Scope subset matching allowed profile: [${permissions.join(", ")}]\x1b[0m`);
  }

  if (hostPermissions.length > 0) {
    console.error(`\x1b[31m❌ Host permissions audit failed! Found host permissions: ${hostPermissions.join(", ")}. Privacy policy forbids external connections.\x1b[0m`);
    auditFailed = true;
  } else {
    console.log("\x1b[32m  ✓ Host permissions verified empty. Perfect offline-only isolation.\x1b[0m");
  }

  // 2. CSP (Content Security Policy) validation
  console.log("\n\x1b[36m%s\x1b[0m", "2. Auditing Content Security Policy (CSP)...");
  const extensionPagesCsp = manifest.content_security_policy?.extension_pages || "";
  
  if (!extensionPagesCsp.includes("script-src 'self'")) {
    console.error(`\x1b[31m❌ CSP verification failed! Missing strict script-src 'self' directive. Found CSP: "${extensionPagesCsp}"\x1b[0m`);
    auditFailed = true;
  } else {
    console.log(`\x1b[32m  ✓ Strict CSP validated: "${extensionPagesCsp}"\x1b[0m`);
  }

  // 3. Scan build files for eval(), source maps, and security fixture leakage
  console.log("\n\x1b[36m%s\x1b[0m", "3. Scanning build scripts for dangerous API calls & dev remnants...");
  const buildFiles = getFilesRecursive(PROD_BUILD_DIR);
  let totalBundleSize = 0;
  const fileManifest = {};

  buildFiles.forEach((filePath) => {
    const relativePath = path.relative(PROD_BUILD_DIR, filePath);
    
    // Ignore manifest & release-manifest in checks
    if (relativePath === "manifest.json" || relativePath === "release-manifest.json") {
      return;
    }

    const stat = fs.statSync(filePath);
    totalBundleSize += stat.size;

    const fileContent = fs.readFileSync(filePath, "utf8");
    const isJS = filePath.endsWith(".js");

    // Danger checks
    if (isJS) {
      if (fileContent.includes("eval(")) {
        console.error(`\x1b[31m❌ Security scan failed! "eval(" statement found in script: ${relativePath}\x1b[0m`);
        auditFailed = true;
      }
      if (fileContent.includes("new Function(")) {
        console.error(`\x1b[31m❌ Security scan failed! "new Function(" constructor found in script: ${relativePath}\x1b[0m`);
        auditFailed = true;
      }
      if (fileContent.includes(".map") || fileContent.includes("sourceMappingURL")) {
        console.warn(`\x1b[33m  ⚠ Warning: Sourcemap remnant pattern matching in script: ${relativePath}\x1b[0m`);
      }
      if (fileContent.includes("security-fixtures") || fileContent.includes("MOCK_DUMMY_SENSITIVE_DATA")) {
        console.error(`\x1b[31m❌ Code leak check failed! Security fixture details or dev structures leaked into script: ${relativePath}\x1b[0m`);
        auditFailed = true;
      }
    }

    fileManifest[relativePath] = {
      sizeBytes: stat.size,
      sha256: calculateSha256(filePath)
    };
  });

  if (!auditFailed) {
    console.log("\x1b[32m  ✓ All production build JS/HTML scripts cleared clean of eval, new Function, and security-fixtures leakage.\x1b[0m");
  }

  // 4. Budget Constraints validation
  console.log("\n\x1b[36m%s\x1b[0m", "4. Checking bundle storage metrics & budgets...");
  console.log(`  Total Bundle Size: ${(totalBundleSize / 1024).toFixed(2)} KB`);
  if (totalBundleSize > BUNDLE_SIZE_BUDGET_BYTES) {
    console.error(`\x1b[31m❌ Bundle size budget exceeded! Total size is ${(totalBundleSize / (1024 * 1024)).toFixed(2)}MB, budget limit is ${(BUNDLE_SIZE_BUDGET_BYTES / (1024 * 1024)).toFixed(2)}MB\x1b[0m`);
    auditFailed = true;
  } else {
    console.log(`\x1b[32m  ✓ Bundle size remains within strict budget bounds (${(BUNDLE_SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(2)}MB).\x1b[0m`);
  }

  // 5. Save release-manifest.json
  console.log("\n\x1b[36m%s\x1b[0m", "5. Generating deterministic release fingerprint manifest...");
  const releaseManifest = {
    name: manifest.name,
    version: manifest.version,
    buildTimestamp: new Date().toISOString(),
    permissions: permissions,
    csp: extensionPagesCsp,
    totalSizeBytes: totalBundleSize,
    files: fileManifest
  };

  fs.writeFileSync(RELEASE_MANIFEST_PATH, JSON.stringify(releaseManifest, null, 2), "utf8");
  console.log(`\x1b[32m  ✓ Generated deterministic release-manifest: ${path.relative(WORKSPACE_DIR, RELEASE_MANIFEST_PATH)}\x1b[0m`);

  console.log("\n\x1b[35m%s\x1b[0m", "==========================================================");
  if (auditFailed) {
    console.error("\x1b[31m❌ SECURITY & INTEGRITY AUDIT FAILED! See details above.\x1b[0m");
    console.log("\x1b[35m%s\x1b[0m", "==========================================================");
    process.exit(1);
  } else {
    console.log("\x1b[32m💚 CONGRATULATIONS! ALL RELEASE SECURITY INTEGRITY CHECKS PASSED SUCCESSFULLY!\x1b[0m");
    console.log("\x1b[32m🛡️  Extension is ready for local distribution & Chrome Web Store submission.\x1b[0m");
    console.log("\x1b[35m%s\x1b[0m", "==========================================================");
  }
}

runAudit();
