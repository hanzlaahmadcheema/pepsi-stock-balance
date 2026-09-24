@echo off
setlocal enabledelayedexpansion

:: 1. Resolve Application Directory
set "APP_DIR=C:\PepsiDepot\app"
if not exist "%APP_DIR%" (
    set "APP_DIR=%~dp0..\.."
    pushd "%APP_DIR%"
    set "APP_DIR=%CD%"
    popd
)
cd /d "%APP_DIR%"

:: Ensure log directory exists
if not exist "C:\PepsiDepot\logs" mkdir "C:\PepsiDepot\logs"
set "LOG_FILE=C:\PepsiDepot\logs\update.log"

echo ============================================================================== >> "%LOG_FILE%"
echo [%DATE% %TIME%] Automated System Update Triggered from Web UI >> "%LOG_FILE%"
echo ============================================================================== >> "%LOG_FILE%"

:: 2. Locate NSSM
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
)

:: 3. Delay 2 seconds to allow the Web UI HTTP response to return cleanly
timeout /t 2 /nobreak >nul

:: 4. Stop Services to release file locks
if %HAS_NSSM% equ 1 (
    echo [%DATE% %TIME%] [1/5] Stopping services to release file locks... >> "%LOG_FILE%"
    "%NSSM_EXE%" stop "%WEB_SVC%" >> "%LOG_FILE%" 2>&1
    "%NSSM_EXE%" stop "%SYNC_SVC%" >> "%LOG_FILE%" 2>&1
) else (
    echo [%DATE% %TIME%] [1/5] No NSSM services detected. Continuing... >> "%LOG_FILE%"
)

:: 5. Pull latest code from GitHub
echo [%DATE% %TIME%] [2/5] Pulling latest code from origin main... >> "%LOG_FILE%"
git fetch origin main >> "%LOG_FILE%" 2>&1
git reset --hard origin/main >> "%LOG_FILE%" 2>&1
echo [%DATE% %TIME%] Head is now at: >> "%LOG_FILE%"
git log -1 --oneline >> "%LOG_FILE%" 2>&1

:: 6. Verify and install Node packages if modified
echo [%DATE% %TIME%] [3/5] Verifying Node packages... >> "%LOG_FILE%"
call npm install --no-audit --no-fund >> "%LOG_FILE%" 2>&1

:: 7. Build Next.js app and daemon
echo [%DATE% %TIME%] [4/5] Running production build (Prisma, Next.js, daemon)... >> "%LOG_FILE%"
call npm run build >> "%LOG_FILE%" 2>&1
set BUILD_EXIT=%errorLevel%

if %BUILD_EXIT% neq 0 (
    echo [%DATE% %TIME%] [ERROR] Build failed with exit code %BUILD_EXIT% >> "%LOG_FILE%"
) else (
    echo [%DATE% %TIME%] [OK] Production build completed successfully. >> "%LOG_FILE%"
)

:: 8. Restart Services
if %HAS_NSSM% equ 1 (
    echo [%DATE% %TIME%] [5/5] Starting services... >> "%LOG_FILE%"
    "%NSSM_EXE%" start "%WEB_SVC%" >> "%LOG_FILE%" 2>&1
    "%NSSM_EXE%" start "%SYNC_SVC%" >> "%LOG_FILE%" 2>&1
) else (
    echo [%DATE% %TIME%] [5/5] No NSSM services to restart. >> "%LOG_FILE%"
)

echo [%DATE% %TIME%] [COMPLETE] Automated update finished. >> "%LOG_FILE%"
exit /b 0
