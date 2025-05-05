@echo off
cd /d %~dp0
node check-update.js
node server.js