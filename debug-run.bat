@echo off
cd /d "C:\Users\parkm\OneDrive\Documents\Group Chat"
echo Starting AI Council...
"node_modules\electron\dist\electron.exe" "." 2>&1
echo.
echo Exit code: %errorlevel%
pause
