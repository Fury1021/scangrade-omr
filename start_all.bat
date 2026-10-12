@echo off
title ScanGrade OMR - Launcher
echo Launching ScanGrade OMR (Backend + Frontend)...
start "ScanGrade OMR - Backend" cmd /k "%~dp0run_backend.bat"
timeout /t 2 /nobreak >nul
start "ScanGrade OMR - Frontend" cmd /k "%~dp0run_frontend.bat"
echo.
echo ========================================================
echo ScanGrade OMR has been launched!
echo - Frontend: http://localhost:3000
echo - Backend:  http://127.0.0.1:8001
echo ========================================================
echo.
