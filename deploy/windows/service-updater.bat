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

set "WEB_SVC=PepsiDepotWeb"
set "SYNC_SVC=PepsiDepotSync"
"%NSSM_EXE%" status "%WEB_SVC%" >nul 2>&1
if %errorLevel% neq 0 (
    set "WEB_SVC=Pepsi Depot Web"
    set "SYNC_SVC=Pepsi Depot Sync"
)

:: 3. Delay 2 seconds to allow the Web UI HTTP response to return cleanly
timeout /t 2 /nobreak >nul

:: 4. Stop Services to release file locks
echo [%DATE% %TIME%] [1/4] Stopping services to release file locks... >> "%LOG_FILE%"
"%NSSM_EXE%" stop "%WEB_SVC%" >> "%LOG_FILE%" 2>&1
"%NSSM_EXE%" stop "%SYNC_SVC%" >> "%LOG_FILE%" 2>&1

:: 5. Pull latest code from GitHub
echo [%DATE% %TIME%] [2/4] Pulling latest code from origin main... >> "%LOG_FILE%"
git fetch origin main >> "%LOG_FILE%" 2>&1
git reset --hard origin/main >> "%LOG_FILE%" 2>&1
echo [%DATE% %TIME%] Head is now at: >> "%LOG_FILE%"
git log -1 --oneline >> "%LOG_FILE%" 2>&1

:: 6. Build Next.js app and daemon
echo [%DATE% %TIME%] [3/4] Running production build (Prisma, Next.js, daemon)... >> "%LOG_FILE%"
call npm run build >> "%LOG_FILE%" 2>&1
set BUILD_EXIT=%errorLevel%

if %BUILD_EXIT% neq 0 (
    echo [%DATE% %TIME%] [ERROR] Build failed with exit code %BUILD_EXIT% >> "%LOG_FILE%"
) else (
    echo [%DATE% %TIME%] [OK] Production build completed successfully. >> "%LOG_FILE%"
)

:: 7. Restart Services
echo [%DATE% %TIME%] [4/4] Starting services... >> "%LOG_FILE%"
"%NSSM_EXE%" start "%WEB_SVC%" >> "%LOG_FILE%" 2>&1
"%NSSM_EXE%" start "%SYNC_SVC%" >> "%LOG_FILE%" 2>&1

echo [%DATE% %TIME%] [COMPLETE] Automated update finished. >> "%LOG_FILE%"
exit /b 0
