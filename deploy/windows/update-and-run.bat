@echo off
setlocal enabledelayedexpansion

rem ==============================================================================
rem  Pepsi Stock Balance - Update & Run Everything (Windows)
rem ==============================================================================

rem 1. Verify Administrative Privileges (auto-request elevation if needed)
net session >nul 2>&1
if not errorlevel 0 goto :do_elevate
if errorlevel 1 goto :do_elevate
goto :is_elevated

:do_elevate
echo [INFO] Administrative privileges required. Requesting elevation...
powershell -NoProfile -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
exit /b

:is_elevated
title Pepsi Stock Balance - Update and Run

rem 2. Resolve Application Directory
set "APP_DIR=%~1"
if "%APP_DIR%"=="" set "APP_DIR=%~dp0..\.."
if not exist "%APP_DIR%" set "APP_DIR=C:\PepsiDepot\app"
pushd "%APP_DIR%"
set "APP_DIR=%CD%"
popd
cd /d "%APP_DIR%"

echo.
echo ==============================================================================
echo   PEPSI STOCK BALANCE - UPDATE AND RUN EVERYTHING
echo ==============================================================================
echo [INFO] Target Directory: %APP_DIR%
echo [INFO] Time: %DATE% %TIME%
echo ==============================================================================
echo.

rem 3. Detect Registered Windows Services
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

rem Locate NSSM if present
set "NSSM_EXE=nssm.exe"
if exist "C:\ProgramData\chocolatey\bin\nssm.exe" set "NSSM_EXE=C:\ProgramData\chocolatey\bin\nssm.exe"
if exist "C:\nssm\win64\nssm.exe" set "NSSM_EXE=C:\nssm\win64\nssm.exe"
if exist "C:\nssm\nssm.exe" set "NSSM_EXE=C:\nssm\nssm.exe"

set "HAS_NSSM=0"
where "%NSSM_EXE%" >nul 2>&1
if not errorlevel 1 set "HAS_NSSM=1"
if exist "%NSSM_EXE%" set "HAS_NSSM=1"

rem 4. Stop Services / Processes to release file locks on .next and node_modules
if "!IS_SERVICE!"=="1" (
    echo [1/6] Stopping running Windows services (!WEB_SVC!, !SYNC_SVC!)...
    net stop "!WEB_SVC!" /y >nul 2>&1
    net stop "!SYNC_SVC!" /y >nul 2>&1
    if "!HAS_NSSM!"=="1" (
        "%NSSM_EXE%" stop "!WEB_SVC!" >nul 2>&1
        "%NSSM_EXE%" stop "!SYNC_SVC!" >nul 2>&1
    )
    echo [OK] Services stopped.
) else (
    echo [1/6] No installed Windows services detected. Checking standalone processes...
)

rem Release port 3000 listeners if any
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo [INFO] Releasing port 3000 from lingering process PID %%a...
    taskkill /f /pid %%a >nul 2>&1
)
ping 127.0.0.1 -n 3 >nul

rem 5. Pull latest code from GitHub
echo.
echo [2/6] Pulling latest code from origin main...
git fetch origin main
if errorlevel 1 (
    echo [ERROR] git fetch origin main failed. Checking network connection...
    goto :handle_build_error
)
git reset --hard origin/main
if errorlevel 1 (
    echo [ERROR] git reset --hard origin/main failed.
    goto :handle_build_error
)
echo [OK] Code updated to latest commit:
git log -1 --oneline

rem 6. Verify and install Node packages
echo.
echo [3/6] Verifying Node packages...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo [WARNING] npm install reported issues, continuing...
)

rem 7. Generate Prisma Client
echo.
echo [4/6] Generating database client (Prisma)...
call npx prisma generate
if errorlevel 1 (
    echo [ERROR] Prisma generate failed.
    goto :handle_build_error
)

rem 8. Production Build (Next.js & Standalone Sync Daemon)
echo.
echo [5/6] Building application and sync daemon...
call npm run build
if errorlevel 1 (
    echo [ERROR] Production build failed. Check output above.
    goto :handle_build_error
)
echo [OK] Production build succeeded.

rem 9. Start / Restart Everything
echo.
echo [6/6] Starting services and running application...

if "!IS_SERVICE!"=="1" (
    echo [INFO] Starting Windows service: !WEB_SVC!...
    net start "!WEB_SVC!" >nul 2>&1
    if "!HAS_NSSM!"=="1" "%NSSM_EXE%" start "!WEB_SVC!" >nul 2>&1

    echo [INFO] Starting Windows service: !SYNC_SVC!...
    net start "!SYNC_SVC!" >nul 2>&1
    if "!HAS_NSSM!"=="1" "%NSSM_EXE%" start "!SYNC_SVC!" >nul 2>&1

    echo.
    echo ==============================================================================
    echo  CURRENT WINDOWS SERVICE STATUS
    echo ==============================================================================
    sc query "!WEB_SVC!"
    echo.
    sc query "!SYNC_SVC!"
    echo ==============================================================================
) else (
    echo [INFO] Starting Next.js Web Server in standalone background window...
    start "Pepsi Depot Web" cmd /k "title Pepsi Depot Web && npm start"

    echo [INFO] Starting Standalone Sync Daemon in background window...
    if exist "dist\daemon\service-entrypoint.js" (
        start "Pepsi Depot Sync" cmd /k "title Pepsi Depot Sync && node dist\daemon\service-entrypoint.js"
    ) else (
        start "Pepsi Depot Sync" cmd /k "title Pepsi Depot Sync && npm run sync:daemon"
    )
)

echo.
echo [INFO] Opening Web UI at http://localhost:3000...
ping 127.0.0.1 -n 3 >nul
start http://localhost:3000

echo.
echo ==============================================================================
echo  ALL COMPONENTS ARE UPDATED AND RUNNING.
echo  Web Application: http://localhost:3000
echo ==============================================================================
echo.
pause
exit /b 0

:handle_build_error
echo.
echo ==============================================================================
echo  [ERROR] Update encountered an error before starting.
echo  Attempting to start existing services to keep depot operational...
echo ==============================================================================
if "!IS_SERVICE!"=="1" (
    net start "!WEB_SVC!" >nul 2>&1
    net start "!SYNC_SVC!" >nul 2>&1
)
pause
exit /b 1
