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

:: 6. Verify Compiled Production Sync Daemon Artifact
if not exist "%APP_DIR%\dist\daemon\service-entrypoint.js" (
    echo [ERROR] Compiled production sync daemon artifact not found:
    echo   %APP_DIR%\dist\daemon\service-entrypoint.js
    echo Please run 'npm run build' or 'npm run build:daemon' before installing services.
    pause
    exit /b 1
)

:: 7. Resolve PostgreSQL Windows Service Dependency
:: Default Windows PostgreSQL service name is typically postgresql-x64-16 or postgresql-x64-15
:: Can be specified as command argument (e.g. install-services.bat postgresql-x64-15)
set "PG_SERVICE_NAME=postgresql-x64-16"
if "%~1" neq "" set "PG_SERVICE_NAME=%~1"

set "PG_SERVICE_FOUND=0"
sc query "%PG_SERVICE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    set "PG_SERVICE_FOUND=1"
    echo [OK] Detected PostgreSQL service: %PG_SERVICE_NAME%
) else (
    echo [NOTICE] PostgreSQL service "%PG_SERVICE_NAME%" not detected in Windows Service Manager.
    echo If your PostgreSQL service uses a different name (e.g., postgresql-x64-15 or postgresql),
    echo specify it as an argument: deploy\windows\install-services.bat ^<service-name^>
    echo Proceeding without Service Control Manager dependency (application-level database retry active).
)

:: ==============================================================================
:: 8. Install "Pepsi Depot Web" Service (Next.js Application)
:: ==============================================================================
set "WEB_SERVICE=Pepsi Depot Web"
echo.
echo Installing service: "%WEB_SERVICE%"...

:: Stop and remove if already exists
"%NSSM_EXE%" stop "%WEB_SERVICE%" >nul 2>&1
"%NSSM_EXE%" remove "%WEB_SERVICE%" confirm >nul 2>&1

"%NSSM_EXE%" install "%WEB_SERVICE%" "%NODE_EXE%" "node_modules\next\dist\bin\next start -p 3000 -H 0.0.0.0"
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

if %PG_SERVICE_FOUND% equ 1 (
    "%NSSM_EXE%" set "%WEB_SERVICE%" DependOnService "%PG_SERVICE_NAME%"
    echo [OK] Configured "%WEB_SERVICE%" dependency on "%PG_SERVICE_NAME%".
)

echo [SUCCESS] "%WEB_SERVICE%" successfully installed.

:: ==============================================================================
:: 9. Install "Pepsi Depot Sync" Service (Synchronization Daemon)
:: ==============================================================================
set "SYNC_SERVICE=Pepsi Depot Sync"
echo.
echo Installing service: "%SYNC_SERVICE%"...

"%NSSM_EXE%" stop "%SYNC_SERVICE%" >nul 2>&1
"%NSSM_EXE%" remove "%SYNC_SERVICE%" confirm >nul 2>&1

:: Runs Node directly against the compiled JavaScript bundle (zero tsx/TypeScript dependency)
"%NSSM_EXE%" install "%SYNC_SERVICE%" "%NODE_EXE%" "dist\daemon\service-entrypoint.js"
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppDirectory "%APP_DIR%"
"%NSSM_EXE%" set "%SYNC_SERVICE%" DisplayName "Pepsi Depot Sync"
"%NSSM_EXE%" set "%SYNC_SERVICE%" Description "Pepsi Stock Balance - Local Depot Sync Daemon (Cloud Synchronization)"
"%NSSM_EXE%" set "%SYNC_SERVICE%" Start SERVICE_AUTO_START
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppStdout "%LOGS_DIR%\sync.log"
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppStderr "%LOGS_DIR%\sync-error.log"
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppRotateFiles 1
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppRotateOnline 1
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppRotateSeconds 86400
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppRotateBytes 10485760
"%NSSM_EXE%" set "%SYNC_SERVICE%" AppRestartDelay 5000

:: Service Dependency: Depends ONLY on PostgreSQL. Web and Sync remain independently restartable!
if %PG_SERVICE_FOUND% equ 1 (
    "%NSSM_EXE%" set "%SYNC_SERVICE%" DependOnService "%PG_SERVICE_NAME%"
    echo [OK] Configured "%SYNC_SERVICE%" dependency on "%PG_SERVICE_NAME%".
)

echo [SUCCESS] "%SYNC_SERVICE%" successfully installed.

echo.
echo ==============================================================================
echo  INSTALLATION COMPLETE!
echo ==============================================================================
echo  Services Installed:
echo    1. "%WEB_SERVICE%"  (Node -> Next.js)
echo    2. "%SYNC_SERVICE%" (Node -> dist\daemon\service-entrypoint.js)
echo.
echo  Service Dependency Relationship:
echo    PostgreSQL (%PG_SERVICE_NAME%)
echo      ├──^> %WEB_SERVICE%
echo      └──^> %SYNC_SERVICE%
echo    (Web and Sync are completely independent and independently restartable)
echo.
echo  To start the services now, run:
echo    deploy\windows\start-services.bat
echo.
echo  Or use Windows Services management (services.msc) to verify.
echo ==============================================================================

pause
exit /b 0
