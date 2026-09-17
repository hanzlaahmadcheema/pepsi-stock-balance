@echo off
setlocal enabledelayedexpansion

echo ==============================================================================
echo  Pepsi Stock Balance - Windows Depot Service Installer (NSSM)
echo ==============================================================================
echo.

:: 1. Verify Administrative Privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This installer requires Administrator privileges.
    echo Please right-click on install-services.bat and select "Run as administrator".
    pause
    exit /b 1
)

:: 2. Resolve Paths
:: Default application root is two directories up from this script (or C:\PepsiDepot\app)
set "APP_DIR=%~dp0..\.."
pushd "%APP_DIR%"
set "APP_DIR=%CD%"
popd

set "LOGS_DIR=C:\PepsiDepot\logs"
if not exist "%LOGS_DIR%" (
    mkdir "%LOGS_DIR%"
    echo [OK] Created log directory at %LOGS_DIR%
)

:: 3. Locate NSSM (Non-Sucking Service Manager)
set "NSSM_EXE=C:\nssm\win64\nssm.exe"
if not exist "%NSSM_EXE%" (
    set "NSSM_EXE=nssm.exe"
    where nssm.exe >nul 2>&1
    if %errorLevel% neq 0 (
        echo [ERROR] NSSM not found at C:\nssm\win64\nssm.exe or in system PATH.
        echo Please download NSSM from https://nssm.cc/download and place nssm.exe in C:\nssm\win64\
        pause
        exit /b 1
    )
)
echo [OK] Using NSSM at: %NSSM_EXE%

:: 4. Locate Node.js & NPM
where node.exe >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js is not found in system PATH.
    echo Please install Node.js LTS (v20+ or v22+) from https://nodejs.org/
    pause
    exit /b 1
)

for /f "delims=" %%i in ('where node.exe') do set "NODE_EXE=%%i" & goto :found_node
:found_node

for /f "delims=" %%i in ('where npm.cmd') do set "NPM_CMD=%%i" & goto :found_npm
:found_npm

echo [OK] Using Node.js at: %NODE_EXE%
echo [OK] Using NPM at:     %NPM_CMD%
echo [OK] Application directory: %APP_DIR%

:: 5. Validate environment file existence
if not exist "%APP_DIR%\.env.production" (
    if not exist "%APP_DIR%\.env" (
        echo [WARNING] Neither .env.production nor .env found in %APP_DIR%
        echo Please copy deploy\windows\.env.depot.example to %APP_DIR%\.env.production
        echo and configure your local PostgreSQL database and sync credentials before starting services.
    )
)

:: ==============================================================================
:: 6. Install "Pepsi Depot Web" Service (Next.js Application)
:: ==============================================================================
set "WEB_SERVICE=Pepsi Depot Web"
echo.
echo Installing service: "%WEB_SERVICE%"...

:: Stop and remove if already exists
"%NSSM_EXE%" stop "%WEB_SERVICE%" >nul 2>&1
"%NSSM_EXE%" remove "%WEB_SERVICE%" confirm >nul 2>&1

"%NSSM_EXE%" install "%WEB_SERVICE%" "%NPM_CMD%" "run serve:depot"
"%NSSM_EXE%" set "%WEB_SERVICE%" AppDirectory "%APP_DIR%"
"%NSSM_EXE%" set "%WEB_SERVICE%" DisplayName "Pepsi Depot Web"
"%NSSM_EXE%" set "%WEB_SERVICE%" Description "Pepsi Stock Balance - Local Depot Web Server (Next.js)"
"%NSSM_EXE%" set "%WEB_SERVICE%" Start SERVICE_AUTO_START
"%NSSM_EXE%" set "%WEB_SERVICE%" AppStdout "%LOGS_DIR%\web.log"
"%NSSM_EXE%" set "%WEB_SERVICE%" AppStderr "%LOGS_DIR%\web-error.log"
"%NSSM_EXE%" set "%WEB_SERVICE%" AppRotateFiles 1
"%NSSM_EXE%" set "%WEB_SERVICE%" AppRotateOnline 1
"%NSSM_EXE%" set "%WEB_SERVICE%" AppRotateSeconds 86400
"%NSSM_EXE%" set "%WEB_SERVICE%" AppRotateBytes 10485760
"%NSSM_EXE%" set "%WEB_SERVICE%" AppRestartDelay 5000

echo [SUCCESS] "%WEB_SERVICE%" successfully installed.

:: ==============================================================================
:: 7. Install "Pepsi Depot Sync" Service (Synchronization Daemon)
:: ==============================================================================
set "SYNC_SERVICE=Pepsi Depot Sync"
echo.
echo Installing service: "%SYNC_SERVICE%"...

"%NSSM_EXE%" stop "%SYNC_SERVICE%" >nul 2>&1
"%NSSM_EXE%" remove "%SYNC_SERVICE%" confirm >nul 2>&1

"%NSSM_EXE%" install "%SYNC_SERVICE%" "%NPM_CMD%" "run sync:daemon"
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppDirectory "%APP_DIR%"
"%NSSM_EXE%" set "%SYNC_SERVICE%" DisplayName "Pepsi Depot Sync"
"%NSSM_EXE%" set "%SYNC_SERVICE%" Description "Pepsi Stock Balance - Local Depot Sync Daemon (Cloud Synchronization)"
"%NSSM_EXE%" set "%SYNC_SERVICE%" Start SERVICE_AUTO_START
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppStdout "%LOGS_DIR%\sync.log"
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppStderr "%LOGS_DIR%\sync-error.log"
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppRotateFiles 1
"%NSSM_EXE%" set "%WEB_SERVICE%" AppRotateOnline 1
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppRotateSeconds 86400
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppRotateBytes 10485760
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppRestartDelay 5000

echo [SUCCESS] "%SYNC_SERVICE%" successfully installed.

echo.
echo ==============================================================================
echo  INSTALLATION COMPLETE!
echo ==============================================================================
echo  To start the services now, run:
echo    deploy\windows\start-services.bat
echo.
echo  Or use Windows Services management (services.msc) to verify:
echo    - "Pepsi Depot Web"
echo    - "Pepsi Depot Sync"
echo ==============================================================================

pause
exit /b 0
