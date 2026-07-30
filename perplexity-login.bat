@echo off
title Siftline - Perplexity Login

set "APPDIR=%~dp0"
set "ELECTRON=%APPDIR%node_modules\electron\dist\electron.exe"
set "SCRIPT=%APPDIR%perplexity-login.mjs"

if not exist "%ELECTRON%" (
  echo [ERROR] Electron not found: %ELECTRON%
  echo Run "npm install" first.
  pause
  exit /b 1
)

if not exist "%SCRIPT%" (
  echo [ERROR] perplexity-login.mjs not found.
  pause
  exit /b 1
)

echo ================================================
echo   Siftline - Perplexity Login Session Setup
echo ================================================
echo.
echo  Log in with your Perplexity account so that
echo  the Perplexity panel loads without errors.
echo.
echo  - "Continue with Google" is supported.
echo  - "This browser is not secure" error is bypassed.
echo.
echo  Opening login window...
echo.

"%ELECTRON%" "%SCRIPT%"

echo.
echo  Done. You can now launch Siftline.
pause
