@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrator privileges required. Right-click and Run as administrator.
    pause
    exit /b 1
)

echo Stopping Pepsi Depot Services...

set "NSSM_EXE=C:\nssm\win64\nssm.exe"
if not exist "%NSSM_EXE%" set "NSSM_EXE=nssm.exe"

"%NSSM_EXE%" stop "Pepsi Depot Sync"
"%NSSM_EXE%" stop "Pepsi Depot Web"

echo.
echo Current Status:
"%NSSM_EXE%" status "Pepsi Depot Web"
"%NSSM_EXE%" status "Pepsi Depot Sync"

pause
