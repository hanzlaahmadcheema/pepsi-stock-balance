@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrator privileges required. Right-click and Run as administrator.
    pause
    exit /b 1
)

echo ==============================================================================
echo  Configuring Windows Defender Firewall for Pepsi Depot Server
echo ==============================================================================
echo.
echo Rules being applied:
echo 1. Allow inbound TCP port 3000 (Pepsi Depot Web UI / API) from local LAN subnet.
echo 2. Explicitly block external / LAN connections to PostgreSQL (port 5432).
echo.

:: 1. Add inbound rule for Next.js web application (Port 3000)
netsh advfirewall firewall delete rule name="Pepsi Depot Web Application" >nul 2>&1
netsh advfirewall firewall add rule name="Pepsi Depot Web Application" dir=in action=allow protocol=TCP localport=3000 profile=private,domain description="Allows cashier devices on the local depot network to access the web POS interface"

:: 2. Ensure PostgreSQL port 5432 is strictly blocked from external/LAN
netsh advfirewall firewall delete rule name="Block External PostgreSQL 5432" >nul 2>&1
netsh advfirewall firewall add rule name="Block External PostgreSQL 5432" dir=in action=block protocol=TCP localport=5432 description="Blocks all incoming external and LAN traffic to local PostgreSQL database"

echo [SUCCESS] Windows Defender Firewall rules successfully configured!
echo.
echo Next.js Web UI is now accessible from cashier PCs at http://[DEPOT-IP]:3000
echo Local PostgreSQL is strictly isolated to 127.0.0.1.
echo.
pause
