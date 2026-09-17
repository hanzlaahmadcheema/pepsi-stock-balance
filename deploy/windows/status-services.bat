@echo off
setlocal enabledelayedexpansion

echo ==============================================================================
echo  Pepsi Stock Balance - Service & Runtime Health Check
echo ==============================================================================
echo.

set "NSSM_EXE=C:\nssm\win64\nssm.exe"
if not exist "%NSSM_EXE%" set "NSSM_EXE=nssm.exe"

echo [1] Checking NSSM Windows Service Status:
echo ----------------------------------------------------
echo Pepsi Depot Web:
"%NSSM_EXE%" status "Pepsi Depot Web"
echo.
echo Pepsi Depot Sync:
"%NSSM_EXE%" status "Pepsi Depot Sync"
echo.

echo [2] Querying Runtime Health Endpoint (http://localhost:3000/health):
echo ----------------------------------------------------
powershell -Command "try { $res = Invoke-RestMethod -Uri 'http://localhost:3000/health' -Method Get -TimeoutSec 5; Write-Output ($res | ConvertTo-Json -Depth 4) } catch { Write-Host '[ERROR] Health check failed to respond: ' $_.Exception.Message -ForegroundColor Red }"

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
