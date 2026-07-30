@echo off
title Grok Login - Siftline

set "APPDIR=%~dp0"

REM Point the helper Electron to the SAME userData the AI Council app uses,
REM so the login session actually shows up inside the app.
REM AI Council uses package.json "name" = "ai-council", so userData is %APPDATA%\ai-council.
set "AI_COUNCIL_USERDATA=%APPDATA%\ai-council"

echo ================================================
echo   Grok Login - Siftline
echo ================================================
echo.
echo  Target userData: %AI_COUNCIL_USERDATA%
echo.
echo  Opening Grok login window...
echo  Sign in with your X (Twitter) or Google account.
echo  The window will close automatically once login is detected.
echo.

cd /d "%APPDIR%"
npx electron grok-login.mjs

echo.
echo  Done. You can now close this window.
pause
