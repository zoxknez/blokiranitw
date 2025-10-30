@echo off
echo Starting Twitter Blocked Users App...
echo.

echo Installing dependencies...
call npm run install-all

echo.
echo Starting development server...
call npm run dev

pause
