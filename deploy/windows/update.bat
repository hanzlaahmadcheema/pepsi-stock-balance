@echo off
setlocal enabledelayedexpansion

echo ==============================================================================
echo  Pepsi Stock Balance - Automated Windows Update Script
echo ==============================================================================
echo.

:: 1. Verify Administrative Privileges (auto-request elevation if needed)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Administrative privileges required. Requesting elevation...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

:: 2. Resolve Application Directory
set "APP_DIR=%~1"
if "%APP_DIR%"=="" set "APP_DIR=%~dp0..\.."
if not exist "%APP_DIR%" set "APP_DIR=C:\PepsiDepot\app"
pushd "%APP_DIR%"
set "APP_DIR=%CD%"
popd
cd /d "%APP_DIR%"
echo [OK] Application directory: %APP_DIR%

:: 3. Locate NSSM
set "NSSM_EXE=nssm.exe"
if exist "C:\ProgramData\chocolatey\bin\nssm.exe" set "NSSM_EXE=C:\ProgramData\chocolatey\bin\nssm.exe"
if exist "C:\nssm\win64\nssm.exe" set "NSSM_EXE=C:\nssm\win64\nssm.exe"

set "HAS_NSSM=0"
where "%NSSM_EXE%" >nul 2>&1
if %errorLevel% equ 0 set "HAS_NSSM=1"
if exist "%NSSM_EXE%" set "HAS_NSSM=1"

set "WEB_SVC=PepsiDepotWeb"
set "SYNC_SVC=PepsiDepotSync"
if %HAS_NSSM% equ 1 (
    "%NSSM_EXE%" status "%WEB_SVC%" >nul 2>&1
    if !errorLevel! neq 0 (
        set "WEB_SVC=Pepsi Depot Web"
        set "SYNC_SVC=Pepsi Depot Sync"
    )
    echo [OK] Using NSSM at: %NSSM_EXE%
    echo [OK] Target services: %WEB_SVC% / %SYNC_SVC%
) else (
    echo [NOTICE] NSSM service manager not found.
    echo Proceeding with Git update and application build.
)
echo.

:: 4. Stop Services before building to release file locks
if %HAS_NSSM% equ 1 (
    echo [1/5] Stopping services to release file locks...
    "%NSSM_EXE%" stop "%WEB_SVC%"
    "%NSSM_EXE%" stop "%SYNC_SVC%"
) else (
    echo [1/5] No NSSM services running. Skipping stop step...
)

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
call npm install --no-audit --no-fund

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
if %HAS_NSSM% equ 1 (
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
) else (
    echo.
    echo ==============================================================================
    echo  Update Completed Successfully!
    echo ==============================================================================
    echo  Start the application with:
    echo    npm run start   (or npm run dev)
    echo ==============================================================================
)

pause
exit /b 0
