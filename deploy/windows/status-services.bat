@echo off
setlocal enabledelayedexpansion

echo ==============================================================================
echo  Pepsi Stock Balance - Service & Runtime Health Check
echo ==============================================================================
echo.

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

echo [1] Checking NSSM Windows Service Status:
echo ----------------------------------------------------
echo %WEB_SVC%:
"%NSSM_EXE%" status "%WEB_SVC%"
echo.
echo %SYNC_SVC%:
"%NSSM_EXE%" status "%SYNC_SVC%"
echo.

echo [2] Querying Runtime Health Endpoint (http://localhost:3000/api/health):
echo ----------------------------------------------------
powershell -Command "try { $res = Invoke-RestMethod -Uri 'http://localhost:3000/api/health' -Method Get -TimeoutSec 5; Write-Output ($res | ConvertTo-Json -Depth 4) } catch { Write-Host '[ERROR] Health check failed to respond: ' $_.Exception.Message -ForegroundColor Red }"

echo.
echo [3] Log File Inspection (C:\PepsiDepot\logs):
echo ----------------------------------------------------
if exist "C:\PepsiDepot\logs\web.log" (
    for %%A in ("C:\PepsiDepot\logs\web.log") do echo Web Log Size: %%~zA bytes
) else (
    echo Web Log: Not found
)

if exist "C:\PepsiDepot\logs\sync.log" (
    for %%A in ("C:\PepsiDepot\logs\sync.log") do echo Sync Log Size: %%~zA bytes
) else (
    echo Sync Log: Not found
)

echo.
pause
