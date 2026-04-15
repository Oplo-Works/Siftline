@echo off
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0AI-Council-logout.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to run. Error code: %ERRORLEVEL%
    pause
)
