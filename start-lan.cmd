@echo off
REM Builds the web app and serves the whole project on your local network (port 5050).
REM Share the "Share on your network" link printed below with others on the same network.
cd /d "%~dp0"
if not exist "server\node_modules" call npm install --prefix server
if not exist "client\node_modules" call npm install --prefix client
echo Building web app...
call npm run build --prefix client || exit /b 1
echo.
echo Starting server — keep this window open while others are using the app.
node server\src\index.js
