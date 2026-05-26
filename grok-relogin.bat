@echo off
title Grok Re-Login - AI Council

set "APPDIR=%~dp0"

REM Point the helper Electron to the SAME userData the AI Council app uses,
REM so clearing cookies and the new login actually take effect inside the app.
REM AI Council uses package.json "name" = "ai-council", so userData is %APPDATA%\ai-council.
set "AI_COUNCIL_USERDATA=%APPDATA%\ai-council"

echo ================================================
echo   Grok Re-Login - AI Council
echo ================================================
echo.
echo  Target userData: %AI_COUNCIL_USERDATA%
echo.
echo  Clearing previous Grok/X session...
echo  A fresh login window will open automatically.
echo  Sign in with your X (Twitter) or Google account.
echo  The window will close automatically once login is detected.
echo.

cd /d "%APPDIR%"
npx electron grok-login.mjs --clear

echo.
echo  Done. You can now close this window.
pause
