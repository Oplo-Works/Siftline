# make-portable.ps1
# electron-builder 없이 포터블 배포본을 만드는 스크립트
$ErrorActionPreference = 'Stop'

# ── 경로 설정 (어디서 실행해도 동작) ─────────────────────────────────────
if ($PSScriptRoot -and $PSScriptRoot -ne '') {
    $root = $PSScriptRoot
} else {
    $root = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
if (-not $root -or $root -eq '') {
    $root = (Get-Location).Path
}

$release = Join-Path $root 'release'
$out     = Join-Path $release 'AI-Council-Portable'
$zip     = Join-Path $release 'AI-Council-Portable.zip'

Write-Host ""
Write-Host "=== AI Council 포터블 빌드 ===" -ForegroundColor Cyan
Write-Host "경로: $root"

# ── 1. 최신 코드 빌드 ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/4] 앱 코드 빌드 중..." -ForegroundColor Green
Set-Location $root
npm run build

# ── 2. Electron 런타임 출처 확인 ──────────────────────────────────────────
$electronDist = Join-Path $root 'node_modules\electron\dist'
if (-not (Test-Path $electronDist)) {
    Write-Host "node_modules\electron\dist 가 없습니다. npm install 을 먼저 실행해주세요." -ForegroundColor Red
    exit 1
}

# ── 3. 출력 폴더 구성 ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Electron 런타임 복사 중..." -ForegroundColor Green

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out -Force | Out-Null

Copy-Item "$electronDist\*" -Destination $out -Recurse -Force

# electron.exe → AI Council.exe
$electronExe = "$out\electron.exe"
if (Test-Path $electronExe) {
    Rename-Item $electronExe 'AI Council.exe'
    Write-Host "  electron.exe -> AI Council.exe" -ForegroundColor DarkGreen
} else {
    Write-Host "  경고: electron.exe 를 찾을 수 없습니다. 런타임 경로를 확인하세요." -ForegroundColor Red
    Get-ChildItem $out | Format-Table Name
}

# ── 4. resources\app\ 구성 ────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] 앱 코드 패키징 중..." -ForegroundColor Green

$appDir = "$out\resources\app"
New-Item -ItemType Directory -Path $appDir -Force | Out-Null

# package.json (Electron이 main 필드를 읽음)
Copy-Item "$root\package.json" "$appDir\package.json" -Force

# 빌드 아티팩트
Copy-Item "$root\dist"         "$appDir\dist"         -Recurse -Force
Copy-Item "$root\dist-electron" "$appDir\dist-electron" -Recurse -Force

# 런타임 의존성 복사
$nmSrc  = "$root\node_modules"
$nmDest = "$appDir\node_modules"
New-Item -ItemType Directory -Path $nmDest -Force | Out-Null

$deps = @(
    'electron-store', 'conf', 'dot-prop', 'env-paths', 'atomically',
    'globals', 'json-schema-typed', 'pkg-up', 'find-up', 'locate-path',
    'p-locate', 'p-limit', 'yocto-queue', 'path-exists',
    'graceful-fs', 'is-path-inside', 'semver', 'ajv',
    'fast-deep-equal', 'fast-json-stable-stringify', 'json-schema-traverse',
    'uri-js', 'punycode', 'type-fest', 'mimic-fn', 'is-plain-obj',
    'xdg-basedir', 'is-docker', 'is-wsl'
)
foreach ($dep in $deps) {
    $src = "$nmSrc\$dep"
    if (Test-Path $src) {
        Copy-Item $src "$nmDest\$dep" -Recurse -Force
        Write-Host "  + $dep" -ForegroundColor DarkGreen
    }
}

# 아이콘
$icoSrc = [System.IO.Path]::Combine($root, 'ai-council.ico')
if ($icoSrc -and (Test-Path $icoSrc)) {
    Copy-Item $icoSrc "$out\resources\ai-council.ico" -Force
}

# ── 5. ZIP 압축 ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] ZIP 압축 중..." -ForegroundColor Green

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$out\*" -DestinationPath $zip -CompressionLevel Optimal

$sizeMB = [math]::Round((Get-Item $zip).Length / 1MB, 0)

Write-Host ""
Write-Host "=== 완료! ===" -ForegroundColor Cyan
Write-Host "폴더 : $out"
Write-Host "ZIP  : $zip  (${sizeMB} MB)" -ForegroundColor Yellow
Write-Host ""
Write-Host "배포 방법:" -ForegroundColor White
Write-Host "  ZIP 파일을 다른 PC 로 복사 후 압축 해제 -> 'AI Council.exe' 더블클릭으로 실행" -ForegroundColor Green
