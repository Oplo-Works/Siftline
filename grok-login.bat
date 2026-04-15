@echo off
title Grok Login - AI Council

set "APPDIR=%~dp0"

echo ================================================
echo   Grok Login - AI Council
echo ================================================
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
