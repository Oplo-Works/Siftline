# make-portable.ps1
# Script to create a portable distribution without electron-builder
$ErrorActionPreference = 'Stop'

# ── Path configuration (works from any directory) ─────────────────────────────────────
if ($PSScriptRoot -and $PSScriptRoot -ne '') {
    $root = $PSScriptRoot
} else {
    $root = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
if (-not $root -or $root -eq '') {
    $root = (Get-Location).Path
}

$release = Join-Path $root 'release'
$out     = Join-Path $release 'Siftline-Portable'
$zip     = Join-Path $release 'Siftline-Portable.zip'

Write-Host ""
Write-Host "=== Siftline Portable Build ===" -ForegroundColor Cyan
Write-Host "Path: $root"

# ── 1. Build latest code ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[1/4] Building app code..." -ForegroundColor Green
Set-Location $root
npm run build

# ── 2. Verify Electron runtime source ──────────────────────────────────────────
$electronDist = Join-Path $root 'node_modules\electron\dist'
if (-not (Test-Path $electronDist)) {
    Write-Host "node_modules\electron\dist not found. Please run npm install first." -ForegroundColor Red
    exit 1
}

# ── 3. Configure output folder ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Copying Electron runtime..." -ForegroundColor Green

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out -Force | Out-Null

Copy-Item "$electronDist\*" -Destination $out -Recurse -Force

# electron.exe → Siftline.exe
$electronExe = "$out\electron.exe"
if (Test-Path $electronExe) {
    Rename-Item $electronExe 'Siftline.exe'
    Write-Host "  electron.exe -> Siftline.exe" -ForegroundColor DarkGreen
} else {
    Write-Host "  Warning: electron.exe not found. Check runtime path." -ForegroundColor Red
    Get-ChildItem $out | Format-Table Name
}

# ── 4. Setup resources\app\ ────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Packaging app code..." -ForegroundColor Green

$appDir = "$out\resources\app"
New-Item -ItemType Directory -Path $appDir -Force | Out-Null

# package.json (Electron reads the main field)
Copy-Item "$root\package.json" "$appDir\package.json" -Force

# Build artifacts
Copy-Item "$root\dist"         "$appDir\dist"         -Recurse -Force
Copy-Item "$root\dist-electron" "$appDir\dist-electron" -Recurse -Force

# Copy runtime dependencies
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

# Icon
$icoSrc = [System.IO.Path]::Combine($root, 'siftline.ico')
if ($icoSrc -and (Test-Path $icoSrc)) {
    Copy-Item $icoSrc "$out\resources\siftline.ico" -Force
}

# ── 5. ZIP compression ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Compressing to ZIP..." -ForegroundColor Green

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$out\*" -DestinationPath $zip -CompressionLevel Optimal

$sizeMB = [math]::Round((Get-Item $zip).Length / 1MB, 0)

Write-Host ""
Write-Host "=== Complete! ===" -ForegroundColor Cyan
Write-Host "Folder: $out"
Write-Host "ZIP   : $zip  (${sizeMB} MB)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Distribution:" -ForegroundColor White
Write-Host "  Copy ZIP file to another PC, extract -> Run by double-clicking 'Siftline.exe'" -ForegroundColor Green
