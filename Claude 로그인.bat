@echo off
chcp 65001 > nul
title AI Council - Claude Login

set "APPDIR=%~dp0"
set "ELECTRON=%APPDIR%node_modules\electron\dist\electron.exe"
set "SCRIPT=%APPDIR%claude-login.mjs"

if not exist "%ELECTRON%" (
  echo [ERROR] Electron not found: %ELECTRON%
  echo Run "npm install" first.
  pause
  exit /b 1
)

if not exist "%SCRIPT%" (
  echo [ERROR] claude-login.mjs not found.
  pause
  exit /b 1
)

echo ================================================
echo   AI Council - Claude Login Session Setup
echo ================================================
echo.
echo  Login with your Anthropic account so that
echo  the Claude panel loads without errors.
echo.
echo  Opening login window...
echo.

"%ELECTRON%" "%SCRIPT%"

echo.
echo  Done. You can now launch AI Council.
timeout /t 2 > nul
