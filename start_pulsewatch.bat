
@echo off
setlocal

title PulseWatch - System Monitor

cd /d "%~dp0"

echo.
echo ========================================
echo          PULSEWATCH STARTUP
echo ========================================
echo.

REM Check Python virtual environment
if not exist ".venv\Scripts\python.exe" (
    echo ERROR: Python virtual environment not found.
    echo.
    pause
    exit /b 1
)

REM Start Administrator Sensor Helper
echo [1/2] Starting Hardware Monitoring...
echo.

".venv\Scripts\python.exe" -m app.launch_admin_helper

if errorlevel 1 (
    echo.
    echo Advanced monitoring unavailable.
    echo Continuing with Basic Monitoring.
)

REM Start PulseWatch Dashboard
echo.
echo [2/2] Starting PulseWatch Dashboard...
echo.
echo Dashboard:
echo http://127.0.0.1:8000/dashboard
echo.
echo Press Ctrl+C to stop PulseWatch.
echo.

REM Open browser automatically when server is ready
start "" ".venv\Scripts\python.exe" -m app.open_dashboard

REM Start FastAPI Server
".venv\Scripts\python.exe" -m uvicorn app.api:app --host 127.0.0.1 --port 8000

echo.
echo PulseWatch server stopped.
pause
