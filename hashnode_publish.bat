@echo off
chcp 65001 >nul
title Hashnode Draft Publisher

echo.
echo ============================================================
echo   Hashnode Draft Publisher — Siftline
echo ============================================================
echo.

REM Find Python
where python >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON=python
    goto :run
)

where python3 >nul 2>&1
if %errorlevel% == 0 (
    set PYTHON=python3
    goto :run
)

echo [ERROR] Python not found. Please install Python from python.org
pause
exit /b 1

:run
echo Running hashnode_publish.py ...
echo.
%PYTHON% "%~dp0hashnode_publish.py"

echo.
if %errorlevel% == 0 (
    echo Done! Open the draft link above in your browser.
) else (
    echo [ERROR] Something went wrong. Check the output above.
)

echo.
pause
