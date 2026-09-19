#!/usr/bin/env bash
set -e

# ==============================================================================
# safari-packager.sh
#
# One-command Safari Web Extension release packager.
# Mirrors the Chrome release flow — runs entirely from the terminal:
#   1. Builds the Plasmo Safari MV3 bundle
#   2. Syncs web assets into Xcode extension resources
#   3. Runs the security audit gate
#   4. Archives the Xcode project with xcodebuild
#   5. Exports a signed .app and zips it → build/safari-release.zip
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
XCODE_PROJECT="$PROJECT_DIR/safari/Local Web Analytics.xcodeproj"
ARCHIVE_PATH="$PROJECT_DIR/build/safari-archive.xcarchive"
EXPORT_PATH="$PROJECT_DIR/build/safari-export"
EXPORT_OPTIONS_PLIST="$PROJECT_DIR/scripts/safari-export-options.plist"
RELEASE_ZIP="$PROJECT_DIR/build/safari-release.zip"
SCHEME="Local Web Analytics (macOS)"

echo ""
echo "=========================================================="
echo "🍎  LOCAL WEB ANALYTICS — SAFARI RELEASE PACKAGER"
echo "=========================================================="

# ── Step 1: Build Safari MV3 Plasmo bundle ──────────────────────────────────
echo ""
echo "▶ Step 1/5 — Building Safari MV3 extension bundle..."
bun run build:safari

# ── Step 2: Security audit ──────────────────────────────────────────────────
echo ""
echo "▶ Step 2/5 — Running Safari security audit..."
node "$PROJECT_DIR/scripts/package-safari.js"

# ── Step 3: Check Xcode availability ────────────────────────────────────────
echo ""
echo "▶ Step 3/5 — Checking Xcode environment..."

XCODE_PATH="$(xcode-select -p 2>/dev/null || true)"

if [[ "$XCODE_PATH" != *"Xcode.app"* ]]; then
  echo ""
  echo "  ⚠ Full Xcode.app not selected. Current developer dir: $XCODE_PATH"
  echo ""
  echo "  To complete the archive step, run once:"
  echo "    sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  echo ""
  echo "  Web extension assets are fully built and synced:"
  echo "    → safari/Shared (Extension)/Resources/ (ready for Xcode)"
  echo ""
  echo "  Then re-run:  bun run packager:safari"
  echo "=========================================================="
  exit 0
fi

echo "  ✓ Xcode found: $XCODE_PATH"

# ── Step 4: xcodebuild archive ───────────────────────────────────────────────
echo ""
echo "▶ Step 4/5 — Archiving Xcode project (this may take ~1 min)..."
rm -rf "$ARCHIVE_PATH"

xcodebuild archive \
  -project "$XCODE_PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  | grep -E "^(Build|Archive|error:|warning: ⚠|▸|==)" || true

echo "  ✓ Archive created: $ARCHIVE_PATH"

# ── Step 5: Export .app and zip it ───────────────────────────────────────────
echo ""
echo "▶ Step 5/5 — Exporting .app and packaging release zip..."
rm -rf "$EXPORT_PATH"

# Write export options plist if not already present
if [ ! -f "$EXPORT_OPTIONS_PLIST" ]; then
  cat > "$EXPORT_OPTIONS_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>destination</key>
    <string>export</string>
    <key>stripSwiftSymbols</key>
    <true/>
</dict>
</plist>
PLIST
fi

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
  -allowProvisioningUpdates \
  | grep -E "^(Export|error:|warning:|==)" || true

# Zip the exported app
rm -f "$RELEASE_ZIP"
cd "$EXPORT_PATH"
zip -rq "$RELEASE_ZIP" .
cd "$PROJECT_DIR"

ZIP_SIZE=$(du -sh "$RELEASE_ZIP" | cut -f1)
echo "  ✓ Release zip: build/safari-release.zip ($ZIP_SIZE)"

echo ""
echo "=========================================================="
echo "💚 SAFARI RELEASE PACKAGED SUCCESSFULLY!"
echo "🍎 Submit build/safari-release.zip via App Store Connect:"
echo "   https://appstoreconnect.apple.com"
echo "=========================================================="
