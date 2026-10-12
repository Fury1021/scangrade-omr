@echo off
title ScanGrade OMR - Backend (Port 8001)
echo Starting Python FastAPI OMR Grading Engine on http://127.0.0.1:8001 ...
cd /d "%~dp0"
call backend\venv\Scripts\activate
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001 --reload
pause
