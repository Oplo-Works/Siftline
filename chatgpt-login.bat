@echo off
title Siftline - ChatGPT Login

set "APPDIR=%~dp0"
set "ELECTRON=%APPDIR%node_modules\electron\dist\electron.exe"
set "SCRIPT=%APPDIR%chatgpt-login.mjs"

if not exist "%ELECTRON%" (
  echo [ERROR] Electron not found: %ELECTRON%
  echo Run "npm install" first.
  pause
  exit /b 1
)

if not exist "%SCRIPT%" (
  echo [ERROR] chatgpt-login.mjs not found.
  pause
  exit /b 1
)

echo ================================================
echo   Siftline - ChatGPT Login Session Setup
echo ================================================
echo.
echo  Log in with your OpenAI account so that
echo  the ChatGPT panel loads without errors.
echo.
echo  - "Continue with Google" is supported.
echo  - "Continue with Microsoft" is supported.
echo.
echo  Opening login window...
echo.

"%ELECTRON%" "%SCRIPT%"

echo.
echo  Done. You can now launch Siftline.
pause
