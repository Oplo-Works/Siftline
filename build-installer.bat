@echo off
echo ============================================
echo   Siftline - Installer Build Script
echo ============================================
echo.

:: rcedit-x64.exe is required by electron-builder to set .exe icon and version info.
:: Download the standalone rcedit binary instead of the full winCodeSign bundle.
set WCSIGN_DIR=%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0
set RCEDIT=%WCSIGN_DIR%\rcedit-x64.exe

if not exist "%RCEDIT%" (
    echo [1/4] Downloading rcedit-x64.exe...
    mkdir "%WCSIGN_DIR%" 2>nul

    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe' -OutFile '%RCEDIT%' -UseBasicParsing"

    if not exist "%RCEDIT%" (
        echo.
        echo    [ERROR] Failed to download rcedit-x64.exe.
        echo    Check your internet connection or manually download from:
        echo    URL : https://github.com/electron/rcedit/releases/download/v2.0.0/rcedit-x64.exe
        echo    Save to: %RCEDIT%
        echo.
        pause
        exit /b 1
    )
    echo    rcedit-x64.exe ready.
) else (
    echo [1/4] rcedit-x64.exe already present.
)

echo [2/4] Building app (Vite)...
call npm run build
if errorlevel 1 (
    echo ERROR: Vite build failed.
    pause
    exit /b 1
)

echo [3/4] Packaging installer...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --win nsis
if errorlevel 1 (
    echo ERROR: Installer build failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   SUCCESS!
echo   Installer: release\Siftline-Setup-<version>.exe
echo ============================================
echo.
pause
