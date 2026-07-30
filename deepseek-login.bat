@echo off
title Siftline - DeepSeek Login

set "APPDIR=%~dp0"
set "ELECTRON=%APPDIR%node_modules\electron\dist\electron.exe"
set "SCRIPT=%APPDIR%deepseek-login.mjs"

if not exist "%ELECTRON%" (
  echo [ERROR] Electron not found: %ELECTRON%
  echo Run "npm install" first.
  pause
  exit /b 1
)

if not exist "%SCRIPT%" (
  echo [ERROR] deepseek-login.mjs not found.
  pause
  exit /b 1
)

echo ================================================
echo   Siftline - DeepSeek Login Session Setup
echo ================================================
echo.
echo  Log in with your DeepSeek account so that
echo  the DeepSeek panel loads without errors.
echo.
echo  - "Continue with Google" is supported.
echo.
echo  Opening login window...
echo.

"%ELECTRON%" "%SCRIPT%"

echo.
echo  Done. You can now launch Siftline.
pause
