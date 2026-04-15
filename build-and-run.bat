@echo off
title AI Council - Build and Run

set "APPDIR=%~dp0"

echo ================================================
echo   AI Council - Build and Run
echo ================================================
echo.
echo  Building app...
echo.

cd /d "%APPDIR%"
call npm run build

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo  [ERROR] Build failed. Check the errors above.
  pause
  exit /b 1
)

echo.
echo  Build complete. Launching AI Council...
echo.

wscript.exe "%APPDIR%AI Council.vbs"

timeout /t 2 > nul
