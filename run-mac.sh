#!/bin/bash
# ============================================
#   Siftline - Quick Launch (Dev / Run)
#   For Mac users: Launches app after npm install
# ============================================

set -e

echo "============================================"
echo "  Siftline - Quick Setup & Run (Mac)"
echo "============================================"
echo ""

# Check Node
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed."
    echo "  Install from: https://nodejs.org/  (LTS version recommended)"
    exit 1
fi

echo "[1/2] Installing npm packages..."
npm install
echo "  Complete ✔"
echo ""

echo "[2/2] Launching app..."
npm run start
