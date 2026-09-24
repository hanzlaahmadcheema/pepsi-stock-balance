@echo off
setlocal enabledelayedexpansion

echo ==============================================================================
echo  Pepsi Stock Balance - Automated Windows Update Script
echo ==============================================================================
echo.

:: 1. Verify Administrative Privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrator privileges required.
    echo Please right-click update.bat and select "Run as administrator".
    pause
    exit /b 1
)

:: 2. Resolve Application Directory
set "APP_DIR=C:\PepsiDepot\app"
if not exist "%APP_DIR%" (
    set "APP_DIR=%~dp0..\.."
    pushd "%APP_DIR%"
    set "APP_DIR=%CD%"
    popd
)
cd /d "%APP_DIR%"
echo [OK] Application directory: %APP_DIR%

:: 3. Locate NSSM
set "NSSM_EXE=nssm.exe"
if exist "C:\ProgramData\chocolatey\bin\nssm.exe" set "NSSM_EXE=C:\ProgramData\chocolatey\bin\nssm.exe"
if exist "C:\nssm\win64\nssm.exe" set "NSSM_EXE=C:\nssm\win64\nssm.exe"

:: Detect Service Names
set "WEB_SVC=PepsiDepotWeb"
set "SYNC_SVC=PepsiDepotSync"
"%NSSM_EXE%" status "%WEB_SVC%" >nul 2>&1
if %errorLevel% neq 0 (
    set "WEB_SVC=Pepsi Depot Web"
    set "SYNC_SVC=Pepsi Depot Sync"
)

echo [OK] Using NSSM at: %NSSM_EXE%
echo [OK] Target services: %WEB_SVC% / %SYNC_SVC%
echo.

:: 4. Stop Services before building to release file locks
echo [1/5] Stopping services to release file locks...
"%NSSM_EXE%" stop "%WEB_SVC%"
"%NSSM_EXE%" stop "%SYNC_SVC%"

:: 5. Pull latest code from GitHub
echo.
echo [2/5] Fetching and pulling latest changes from git...
git fetch origin main
if %errorLevel% neq 0 (
    echo [ERROR] Failed to fetch from origin main. Check internet connection.
    goto :restart_services
)
git reset --hard origin/main
if %errorLevel% neq 0 (
    echo [ERROR] Failed to reset to origin/main.
    goto :restart_services
)
echo [OK] Code updated to latest commit:
git log -n 1 --oneline

:: 6. Update dependencies if needed
echo.
echo [3/5] Verifying Node packages...
call npm install

:: 7. Build Next.js app and standalone Sync Daemon bundle
echo.
echo [4/5] Building application and daemon...
call npm run build
if %errorLevel% neq 0 (
    echo [ERROR] Build failed! Check compiler output.
    goto :restart_services
)

:: 8. Restart Services
:restart_services
echo.
echo [5/5] Starting services...
"%NSSM_EXE%" start "%WEB_SVC%"
"%NSSM_EXE%" start "%SYNC_SVC%"

echo.
echo ==============================================================================
echo  Current Service Status:
echo ==============================================================================
"%NSSM_EXE%" status "%WEB_SVC%"
"%NSSM_EXE%" status "%SYNC_SVC%"
echo ==============================================================================

pause
exit /b 0
