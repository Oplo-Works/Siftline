#!/bin/bash
# ============================================
#   Siftline - Mac Installer Build Script
#   Generates a .dmg for macOS (x64 + arm64)
# ============================================

set -e  # exit on any error

echo "============================================"
echo "  Siftline - Mac Installer Build Script"
echo "============================================"
echo ""

# ── Step 1: Check Node / npm ─────────────────
echo "[1/4] Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "  [ERROR] Node.js is not installed."
    echo "  Install from: https://nodejs.org/"
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo "  [ERROR] npm is not installed."
    exit 1
fi
echo "  Node $(node -v)  /  npm $(npm -v)  ✔"
echo ""

# ── Step 2: Convert .ico → .icns (Mac icon) ──
echo "[2/4] Preparing macOS icon (.icns)..."
ICNS_FILE="siftline.icns"

if [ ! -f "$ICNS_FILE" ]; then
    echo "  siftline.icns not found. Generating from siftline.ico..."

    # Requires 'sips' (built into macOS) and 'iconutil' (built into macOS)
    if [ ! -f "siftline.ico" ]; then
        echo "  [ERROR] siftline.ico not found either. Please provide an icon file."
        exit 1
    fi

    # Create iconset directory
    ICONSET="siftline.iconset"
    mkdir -p "$ICONSET"

    # Export sizes using sips
    for SIZE in 16 32 64 128 256 512; do
        sips -z $SIZE $SIZE siftline.ico --out "$ICONSET/icon_${SIZE}x${SIZE}.png" &>/dev/null
        DOUBLE=$((SIZE * 2))
        sips -z $DOUBLE $DOUBLE siftline.ico --out "$ICONSET/icon_${SIZE}x${SIZE}@2x.png" &>/dev/null
    done

    iconutil -c icns "$ICONSET" -o "$ICNS_FILE"
    rm -rf "$ICONSET"
    echo "  siftline.icns created ✔"
else
    echo "  siftline.icns already present ✔"
fi
echo ""

# ── Step 3: Vite build ────────────────────────
echo "[3/4] Building app (Vite)..."
npm run build
echo "  Vite build complete ✔"
echo ""

# ── Step 4: Package DMG via electron-builder ─
echo "[4/4] Packaging .dmg installer..."
# CSC_IDENTITY_AUTO_DISCOVERY=false → skip code signing (no Apple Developer cert needed)
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dmg
echo ""

echo "============================================"
echo "  SUCCESS!"
echo "  Installer: release/Siftline-*.dmg"
echo "  (Both Intel x64 and Apple Silicon arm64)"
echo "============================================"
echo ""
