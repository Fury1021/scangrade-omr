@echo off
title ScanGrade OMR - Frontend (Port 3000)
echo Starting Next.js Frontend on http://localhost:3000 ...
cd /d "%~dp0\frontend"
npm run dev
pause
