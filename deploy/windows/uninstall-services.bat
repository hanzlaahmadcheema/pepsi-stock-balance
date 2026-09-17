@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrator privileges required. Right-click and Run as administrator.
    pause
    exit /b 1
)

echo Removing Pepsi Depot Windows Services...

set "NSSM_EXE=C:\nssm\win64\nssm.exe"
if not exist "%NSSM_EXE%" set "NSSM_EXE=nssm.exe"

echo Stopping services...
"%NSSM_EXE%" stop "Pepsi Depot Sync" >nul 2>&1
"%NSSM_EXE%" stop "Pepsi Depot Web" >nul 2>&1

echo Removing "Pepsi Depot Sync"...
"%NSSM_EXE%" remove "Pepsi Depot Sync" confirm

echo Removing "Pepsi Depot Web"...
"%NSSM_EXE%" remove "Pepsi Depot Web" confirm

echo.
echo [SUCCESS] Services have been uninstalled.
pause
