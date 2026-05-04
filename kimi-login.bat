@echo off
title Kimi Login - AI Council

set "APPDIR=%~dp0"

echo ================================================
echo   Kimi Login - AI Council
echo ================================================
echo.
echo  Opening Kimi login window...
echo  Sign in with your Kimi (Moonshot) account.
echo  The window will close automatically once login is detected.
echo.

cd /d "%APPDIR%"
npx electron kimi-login.mjs

echo.
echo  Done. You can now close this window.
pause
