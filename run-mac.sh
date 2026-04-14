#!/bin/bash
# ============================================
#   AI Council - Quick Launch (Dev / Run)
#   Mac 사용자용: npm install 후 앱 실행
# ============================================

set -e

echo "============================================"
echo "  AI Council - Quick Setup & Run (Mac)"
echo "============================================"
echo ""

# Check Node
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js가 설치되지 않았습니다."
    echo "  설치: https://nodejs.org/  (LTS 버전 권장)"
    exit 1
fi

echo "[1/2] npm 패키지 설치 중..."
npm install
echo "  완료 ✔"
echo ""

echo "[2/2] 앱 실행 중..."
npm run start
