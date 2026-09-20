<#
.SYNOPSIS
    Installs and verifies PostgreSQL 18 on Windows 10/11 depot servers.

.DESCRIPTION
    Phase 3 of Pepsi Depot Automated Installation Suite.
    - Requires Administrator privileges.
    - Detects existing PostgreSQL service (PostgreSQL 18 / 16 / custom).
    - If missing, installs PostgreSQL 18 using Chocolatey.
    - Dynamically detects the registered Windows service name.
    - Configures the Windows service for Automatic startup.
    - Ensures the service is actively running.
    - Verifies local loopback connectivity on port 5432.
    - Idempotent: Safe to execute repeatedly without disrupting existing services.

.PARAMETER SuperUserPassword
    Optional initial password for the 'postgres' superuser if a fresh installation is needed.
    If omitted and a fresh install is required, a secure random password will be generated.

.EXAMPLE
    .\03-install-postgresql.ps1
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$SuperUserPassword
)

$ErrorActionPreference = "Stop"

function Write-LogHeader {
    param([string]$Title)
    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-LogInfo {
    param([string]$Message)
    Write-Host "[INFO]  $Message" -ForegroundColor Gray
}

function Write-LogSuccess {
    param([string]$Message)
    Write-Host "[OK]    $Message" -ForegroundColor Green
}

function Write-LogWarning {
    param([string]$Message)
    Write-Host "[WARN]  $Message" -ForegroundColor Yellow
}

function Write-LogError {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$identity
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Find-PostgresService {
    $services = Get-Service | Where-Object {
        $_.Name -like "*postgres*" -or $_.DisplayName -like "*PostgreSQL*"
    }
    # Prefer version 18 if multiple
    $v18 = $services | Where-Object { $_.Name -like "*18*" -or $_.DisplayName -like "*18*" } | Select-Object -First 1
    if ($v18) { return $v18 }
    return $services | Select-Object -First 1
}

function Find-PsqlExecutable {
    $cmd = Get-Command "psql.exe" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $searchRoots = @(
        "C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\*\bin\psql.exe",
        "C:\tools\postgresql\bin\psql.exe",
        "C:\tools\postgresql*\bin\psql.exe"
    )

    foreach ($pattern in $searchRoots) {
        $resolved = Resolve-Path $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved -and (Test-Path $resolved.Path)) {
            return $resolved.Path
        }
    }
    return $null
}

Write-LogHeader "PEPSI DEPOT INSTALLER — PHASE 3: POSTGRESQL 18 ENGINE & SERVICE"

# 1. Administrator Privileges Check
if (-not (Test-IsAdmin)) {
    Write-LogError "This script requires elevated Administrator privileges."
    Write-LogError "Please relaunch PowerShell as Administrator and retry."
    exit 1
}
Write-LogSuccess "Administrator privileges verified."

# 2. Check for existing PostgreSQL service and binaries
$existingService = Find-PostgresService
$psqlPath = Find-PsqlExecutable

if ($psqlPath) {
    $binDir = Split-Path $psqlPath -Parent
    if ($env:Path -notlike "*$binDir*") {
        $env:Path = "$binDir;" + $env:Path
    }
}

if ($existingService -and $psqlPath) {
    try {
        $ver = (& psql --version) -join " "
        Write-LogSuccess "PostgreSQL is already installed: $ver"
        Write-LogSuccess "Detected Windows service: '$($existingService.Name)' (Status: $($existingService.Status))"
    } catch {
        Write-LogWarning "PostgreSQL service detected but psql --version threw an error: $($_.Exception.Message)"
    }
} else {
    # 3. Install PostgreSQL 18 via Chocolatey
    Write-LogInfo "PostgreSQL 18 not detected. Preparing Chocolatey installation..."

    if (-not (Get-Command "choco.exe" -ErrorAction SilentlyContinue)) {
        Write-LogError "Chocolatey is required to install PostgreSQL 18. Please run 01-install-chocolatey.ps1 first."
        exit 1
    }

    # SuperUser Password Handling
    if ([string]::IsNullOrWhiteSpace($SuperUserPassword)) {
        Write-LogInfo "No superuser password provided. Generating a cryptographically random initial password..."
        $bytes = New-Object byte[] 24
        (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
        $SuperUserPassword = [Convert]::ToBase64String($bytes).Replace("+", "").Replace("/", "").Replace("=", "") + "P1!"
        Write-LogWarning "Initial postgres superuser password generated. Save this securely if needed for DBA management."
    }

    Write-LogInfo "Installing PostgreSQL 18 via Chocolatey (package: postgresql18)..."
    try {
        & choco install postgresql18 -y --no-progress --params "/Password:$SuperUserPassword"
    } catch {
        Write-LogWarning "Package 'postgresql18' failed or not available. Attempting fallback package 'postgresql'..."
        & choco install postgresql -y --no-progress --params "/Password:$SuperUserPassword"
    }

    # Re-discover service and binary
    $existingService = Find-PostgresService
    $psqlPath = Find-PsqlExecutable

    if ($psqlPath) {
        $binDir = Split-Path $psqlPath -Parent
        $env:Path = "$binDir;" + $env:Path
        $ver = (& psql --version) -join " "
        Write-LogSuccess "PostgreSQL installed successfully: $ver"
    } else {
        Write-LogError "PostgreSQL installation completed but psql.exe could not be located."
        exit 1
    }
}

# 4. Configure & Verify Windows Service
if (-not $existingService) {
    $existingService = Find-PostgresService
}

if (-not $existingService) {
    Write-LogError "Unable to locate a registered PostgreSQL Windows service."
    exit 1
}

$serviceName = $existingService.Name
Write-LogInfo "Configuring Windows Service '$serviceName'..."

# Ensure startup type is Automatic
try {
    Set-Service -Name $serviceName -StartupType Automatic
    Write-LogSuccess "Service '$serviceName' startup type set to Automatic."
} catch {
    Write-LogWarning "Could not set startup type for '$serviceName': $($_.Exception.Message)"
}

# Ensure service is Running
$currentStatus = (Get-Service -Name $serviceName).Status
if ($currentStatus -ne "Running") {
    Write-LogInfo "Starting service '$serviceName'..."
    Start-Service -Name $serviceName
    Start-Sleep -Seconds 3
    $currentStatus = (Get-Service -Name $serviceName).Status
}

if ($currentStatus -eq "Running") {
    Write-LogSuccess "Service '$serviceName' is currently RUNNING."
} else {
    Write-LogError "Service '$serviceName' is not running (Current state: $currentStatus)."
    exit 1
}

# 5. Verify Local TCP Reachability (Port 5432)
Write-LogInfo "Testing local loopback connectivity on port 5432..."
$tcpCheck = Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -WarningAction SilentlyContinue

if ($tcpCheck.TcpTestSucceeded) {
    Write-LogSuccess "PostgreSQL is actively listening on 127.0.0.1:5432."
} else {
    Write-LogError "PostgreSQL port 5432 is not reachable on 127.0.0.1."
    Write-LogError "Check postgresql.conf listen_addresses and Windows Service status."
    exit 1
}

Write-LogHeader "PHASE 3 COMPLETED SUCCESSFULLY: POSTGRESQL ENGINE READY"
exit 0
