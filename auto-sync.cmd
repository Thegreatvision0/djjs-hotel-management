@echo off
REM Watches this project and automatically commits + pushes changes to GitHub.
REM Keep this window open (minimise it). Close it or press Ctrl+C to stop syncing.
title DJJS Hotel - GitHub auto-sync
cd /d "%~dp0"
node scripts\auto-sync.mjs
