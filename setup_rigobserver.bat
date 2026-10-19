
@echo off
setlocal EnableExtensions

title RigObserver - Setup

cd /d "%~dp0"

echo.
echo ========================================
echo          RIGOBSERVER INSTALLER
echo ========================================
echo.

REM ========================================
REM STEP 1 - CHECK PYTHON
REM ========================================

echo [1/5] Checking Python...

py -3 --version >nul 2>&1

if not errorlevel 1 (
    set "PYTHON_CMD=py -3"
) else (
    python --version >nul 2>&1

    if errorlevel 1 (
        echo.
        echo ERROR: Python was not found.
        echo Install Python and run setup again.
        goto :failed
    )

    set "PYTHON_CMD=python"
)

%PYTHON_CMD% --version

REM ========================================
REM STEP 2 - CREATE VIRTUAL ENVIRONMENT
REM ========================================

echo.
echo [2/5] Setting up Python environment...

if not exist ".venv\Scripts\python.exe" (
    %PYTHON_CMD% -m venv .venv

    if errorlevel 1 goto :failed
) else (
    echo Existing virtual environment detected.
)

REM ========================================
REM STEP 3 - INSTALL DEPENDENCIES
REM ========================================

echo.
echo [3/5] Installing Python dependencies...

".venv\Scripts\python.exe" -m pip install -r requirements.txt

if errorlevel 1 goto :failed

REM ========================================
REM STEP 4 - CHECK .NET SDK
REM ========================================

echo.
echo [4/5] Checking .NET SDK...

dotnet --version

if errorlevel 1 (
    echo.
    echo ERROR: .NET SDK was not found.
    echo Install the .NET 10 SDK and run setup again.
    goto :failed
)

REM ========================================
REM STEP 5 - BUILD SENSOR BRIDGE
REM ========================================

echo.
echo [5/5] Building Hardware Sensor Bridge...


REM Check whether the Sensor Bridge DLL is locked
set "BRIDGE_DLL=%CD%\sensor_bridge\bin\Debug\net10.0\sensor_bridge.dll"

if exist "%BRIDGE_DLL%" (
    powershell.exe -NoProfile -Command "try { $f=[System.IO.File]::Open($env:BRIDGE_DLL,[System.IO.FileMode]::Open,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None); $f.Dispose(); exit 0 } catch { exit 1 }" >nul 2>&1

    if errorlevel 1 (
        echo.
        echo ERROR: Sensor Bridge DLL is in use or inaccessible.
        echo.
        echo Close RigObserver and the Administrator Sensor Helper.
        echo Wait a few seconds and run Setup again.
        goto :failed
    )
)


dotnet build "sensor_bridge\sensor_bridge.csproj" -c Debug

if errorlevel 1 goto :failed

if not exist "sensor_bridge\bin\Debug\net10.0\sensor_bridge.dll" (
    echo ERROR: Sensor Bridge DLL was not created.
    goto :failed
)

REM ========================================
REM SETUP COMPLETE
REM ========================================

echo.
echo ========================================
echo       INSTALLATION COMPLETED
echo ========================================
echo.
echo RigObserver is ready.
echo.
echo To start RigObserver:
echo Double-click start_rigobserver.bat
echo.
pause

exit /b 0

:failed

echo.
echo ========================================
echo       INSTALLATION FAILED
echo ========================================
echo.
echo Review the error above.
echo.
pause

exit /b 1
