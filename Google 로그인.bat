@echo off
chcp 65001 > nul
title AI Council - Google Login

set "APPDIR=%~dp0"
set "ELECTRON=%APPDIR%node_modules\electron\dist\electron.exe"
set "SCRIPT=%APPDIR%google-login.mjs"

if not exist "%ELECTRON%" (
  echo [ERROR] Electron not found: %ELECTRON%
  echo Run "npm install" first.
  pause
  exit /b 1
)

if not exist "%SCRIPT%" (
  echo [ERROR] google-login.mjs not found.
  pause
  exit /b 1
)

echo ================================================
echo   AI Council - Google Login Session Setup
echo ================================================
echo.
echo  Login with your Google account so that
echo  the Gemini panel loads without 502 errors.
echo.
echo  Opening login window...
echo.

"%ELECTRON%" "%SCRIPT%"

echo.
echo  Done. You can now launch AI Council.
timeout /t 2 > nul
