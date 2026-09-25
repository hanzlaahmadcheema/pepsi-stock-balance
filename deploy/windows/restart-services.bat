@echo off
setlocal enabledelayedexpansion

:: 1. Verify Administrative Privileges (auto-request elevation if needed)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Administrative privileges required. Requesting elevation...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo ==============================================================================
echo  Restarting Pepsi Depot Services...
echo ==============================================================================

set "NSSM_EXE=nssm.exe"
if exist "C:\ProgramData\chocolatey\bin\nssm.exe" set "NSSM_EXE=C:\ProgramData\chocolatey\bin\nssm.exe"
if exist "C:\nssm\win64\nssm.exe" set "NSSM_EXE=C:\nssm\win64\nssm.exe"
if exist "C:\nssm\nssm.exe" set "NSSM_EXE=C:\nssm\nssm.exe"

set "HAS_NSSM=0"
where "%NSSM_EXE%" >nul 2>&1
if %errorLevel% equ 0 set "HAS_NSSM=1"
if exist "%NSSM_EXE%" set "HAS_NSSM=1"

set "WEB_SVC=Pepsi Depot Web"
set "SYNC_SVC=Pepsi Depot Sync"

sc query "Pepsi Depot Web" >nul 2>&1
if %errorLevel% neq 0 (
    sc query "PepsiDepotWeb" >nul 2>&1
    if !errorLevel! equ 0 (
        set "WEB_SVC=PepsiDepotWeb"
        set "SYNC_SVC=PepsiDepotSync"
    )
)

echo [1/2] Stopping services...
net stop "!SYNC_SVC!" /y >nul 2>&1
net stop "!WEB_SVC!" /y >nul 2>&1
if %HAS_NSSM% equ 1 (
    "%NSSM_EXE%" stop "!SYNC_SVC!" >nul 2>&1
    "%NSSM_EXE%" stop "!WEB_SVC!" >nul 2>&1
)

ping 127.0.0.1 -n 3 >nul

echo [2/2] Starting services...
net start "!WEB_SVC!" >nul 2>&1
net start "!SYNC_SVC!" >nul 2>&1
if %HAS_NSSM% equ 1 (
    "%NSSM_EXE%" start "!WEB_SVC!" >nul 2>&1
    "%NSSM_EXE%" start "!SYNC_SVC!" >nul 2>&1
)

echo.
echo ==============================================================================
echo  Current Service Status:
echo ==============================================================================
sc query "!WEB_SVC!"
echo.
sc query "!SYNC_SVC!"
echo ==============================================================================

pause
