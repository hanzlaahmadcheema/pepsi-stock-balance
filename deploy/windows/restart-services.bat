@echo off
setlocal enabledelayedexpansion

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrator privileges required. Right-click and Run as administrator.
    pause
    exit /b 1
)

echo Restarting Pepsi Depot Services...

set "NSSM_EXE=nssm.exe"
if exist "C:\ProgramData\chocolatey\bin\nssm.exe" set "NSSM_EXE=C:\ProgramData\chocolatey\bin\nssm.exe"
if exist "C:\nssm\win64\nssm.exe" set "NSSM_EXE=C:\nssm\win64\nssm.exe"

set "WEB_SVC=PepsiDepotWeb"
set "SYNC_SVC=PepsiDepotSync"
"%NSSM_EXE%" status "%WEB_SVC%" >nul 2>&1
if %errorLevel% neq 0 (
    set "WEB_SVC=Pepsi Depot Web"
    set "SYNC_SVC=Pepsi Depot Sync"
)

"%NSSM_EXE%" restart "%WEB_SVC%"
"%NSSM_EXE%" restart "%SYNC_SVC%"

echo.
echo Current Status:
"%NSSM_EXE%" status "%WEB_SVC%"
"%NSSM_EXE%" status "%SYNC_SVC%"

pause
