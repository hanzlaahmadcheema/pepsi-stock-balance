@echo off
setlocal enabledelayedexpansion

rem ==============================================================================
rem  Pepsi Stock Balance - Automated Windows Service Updater
rem ==============================================================================

rem 1. Resolve Application Directory
set "APP_DIR=%~1"
if "%APP_DIR%"=="" set "APP_DIR=%~dp0..\.."
if not exist "%APP_DIR%" set "APP_DIR=C:\PepsiDepot\app"
pushd "%APP_DIR%"
set "APP_DIR=%CD%"
popd
cd /d "%APP_DIR%"

rem 2. Ensure log directory exists
set "LOG_DIR=%APP_DIR%\logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" 2>nul
if not exist "%LOG_DIR%" (
    if not exist "C:\PepsiDepot\logs" mkdir "C:\PepsiDepot\logs" 2>nul
    if exist "C:\PepsiDepot\logs" (
        set "LOG_DIR=C:\PepsiDepot\logs"
    ) else (
        set "LOG_DIR=%TEMP%"
    )
)
set "LOG_FILE=%LOG_DIR%\update.log"

echo. >> "%LOG_FILE%"
echo ============================================================================== >> "%LOG_FILE%"
echo [%DATE% %TIME%] Automated System Update Triggered >> "%LOG_FILE%"
echo [TARGET DIR] %APP_DIR% >> "%LOG_FILE%"
echo ============================================================================== >> "%LOG_FILE%"

rem 3. Graceful Delay (Give Web UI HTTP response 3 seconds to complete transmission)
ping 127.0.0.1 -n 4 >nul

rem 4. Locate NSSM
set "NSSM_EXE=nssm.exe"
if exist "C:\ProgramData\chocolatey\bin\nssm.exe" set "NSSM_EXE=C:\ProgramData\chocolatey\bin\nssm.exe"
if exist "C:\nssm\win64\nssm.exe" set "NSSM_EXE=C:\nssm\win64\nssm.exe"
if exist "C:\nssm\nssm.exe" set "NSSM_EXE=C:\nssm\nssm.exe"

set "HAS_NSSM=0"
where "%NSSM_EXE%" >nul 2>&1
if not errorlevel 1 set "HAS_NSSM=1"
if exist "%NSSM_EXE%" set "HAS_NSSM=1"

rem 5. Detect Registered Services (supports "PepsiDepotWeb" or "Pepsi Depot Web")
set "WEB_SVC=PepsiDepotWeb"
set "SYNC_SVC=PepsiDepotSync"
set "IS_SERVICE=0"

sc query "PepsiDepotWeb" >nul 2>&1
if not errorlevel 1 (
    set "IS_SERVICE=1"
    set "WEB_SVC=PepsiDepotWeb"
    set "SYNC_SVC=PepsiDepotSync"
) else (
    sc query "Pepsi Depot Web" >nul 2>&1
    if not errorlevel 1 (
        set "IS_SERVICE=1"
        set "WEB_SVC=Pepsi Depot Web"
        set "SYNC_SVC=Pepsi Depot Sync"
    )
)

if "!IS_SERVICE!"=="0" (
    if "!HAS_NSSM!"=="1" (
        "%NSSM_EXE%" status "PepsiDepotWeb" >nul 2>&1
        if not errorlevel 1 (
            set "IS_SERVICE=1"
            set "WEB_SVC=PepsiDepotWeb"
            set "SYNC_SVC=PepsiDepotSync"
        ) else (
            "%NSSM_EXE%" status "Pepsi Depot Web" >nul 2>&1
            if not errorlevel 1 (
                set "IS_SERVICE=1"
                set "WEB_SVC=Pepsi Depot Web"
                set "SYNC_SVC=Pepsi Depot Sync"
            )
        )
    )
)

echo [%DATE% %TIME%] Service detected: !IS_SERVICE! (Web: "!WEB_SVC!", Sync: "!SYNC_SVC!") >> "%LOG_FILE%"

rem 6. Stop Services to release file locks on .next and node_modules
if "!IS_SERVICE!"=="0" (
    echo [%DATE% %TIME%] [1/5] No registered Windows services found. Continuing in standalone mode... >> "%LOG_FILE%"
    goto :after_stop_services
)

echo [%DATE% %TIME%] [1/5] Stopping services to release file locks... >> "%LOG_FILE%"
net stop "!WEB_SVC!" /y >> "%LOG_FILE%" 2>&1
net stop "!SYNC_SVC!" /y >> "%LOG_FILE%" 2>&1
if "!HAS_NSSM!"=="1" (
    "%NSSM_EXE%" stop "!WEB_SVC!" >> "%LOG_FILE%" 2>&1
    "%NSSM_EXE%" stop "!SYNC_SVC!" >> "%LOG_FILE%" 2>&1
)

rem Give OS 3 seconds to flush I/O handles and unload DLLs
ping 127.0.0.1 -n 4 >nul

rem Clean up any lingering process on port 3000 to guarantee clean restart
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo [%DATE% %TIME%] Terminating orphaned listener on port 3000 with PID %%a >> "%LOG_FILE%"
    taskkill /f /pid %%a >> "%LOG_FILE%" 2>&1
)

:after_stop_services

rem 7. Pull latest code from GitHub
echo [%DATE% %TIME%] [2/5] Pulling latest code from origin main... >> "%LOG_FILE%"
git fetch origin main >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [%DATE% %TIME%] [ERROR] git fetch origin main failed. Checking network connectivity. >> "%LOG_FILE%"
    goto :restart_services
)

git reset --hard origin/main >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [%DATE% %TIME%] [ERROR] git reset --hard origin/main failed. >> "%LOG_FILE%"
    goto :restart_services
)

echo [%DATE% %TIME%] Head is now at: >> "%LOG_FILE%"
git log -1 --oneline >> "%LOG_FILE%" 2>&1

rem 8. Verify and install Node packages
echo [%DATE% %TIME%] [3/5] Verifying Node packages... >> "%LOG_FILE%"
call npm install --no-audit --no-fund >> "%LOG_FILE%" 2>&1

rem 9. Build Application (Prisma Client, Next.js Production Build, Sync Daemon)
echo [%DATE% %TIME%] [4/5] Running production build (Prisma, Next.js, daemon)... >> "%LOG_FILE%"
call npm run build >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
    echo [%DATE% %TIME%] [WARNING] Initial build exited with error. Attempting recovery with prisma generate... >> "%LOG_FILE%"
    call npx prisma generate >> "%LOG_FILE%" 2>&1
    call npm run build >> "%LOG_FILE%" 2>&1
)

if errorlevel 1 (
    echo [%DATE% %TIME%] [ERROR] Production build failed. Check log output above. >> "%LOG_FILE%"
) else (
    echo [%DATE% %TIME%] [OK] Production build completed successfully. >> "%LOG_FILE%"
)

rem 10. Restart Services
:restart_services
if "!IS_SERVICE!"=="0" (
    echo [%DATE% %TIME%] [5/5] Standalone mode. If running in a terminal, please restart it to use the new build. >> "%LOG_FILE%"
    goto :updater_done
)

echo [%DATE% %TIME%] [5/5] Starting services... >> "%LOG_FILE%"
net start "!WEB_SVC!" >> "%LOG_FILE%" 2>&1
net start "!SYNC_SVC!" >> "%LOG_FILE%" 2>&1
if "!HAS_NSSM!"=="1" (
    "%NSSM_EXE%" start "!WEB_SVC!" >> "%LOG_FILE%" 2>&1
    "%NSSM_EXE%" start "!SYNC_SVC!" >> "%LOG_FILE%" 2>&1
)
echo [%DATE% %TIME%] Verifying service status: >> "%LOG_FILE%"
sc query "!WEB_SVC!" >> "%LOG_FILE%" 2>&1
sc query "!SYNC_SVC!" >> "%LOG_FILE%" 2>&1

:updater_done
echo [%DATE% %TIME%] [COMPLETE] Automated update finished. >> "%LOG_FILE%"
exit /b 0
