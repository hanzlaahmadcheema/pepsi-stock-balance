<#
.SYNOPSIS
    Installs Git and Node.js dependencies on Windows 10/11 depot servers.

.DESCRIPTION
    Phase 2 of Pepsi Depot Automated Installation Suite.
    - Requires Administrator privileges.
    - Verifies or installs Git using Chocolatey.
    - Verifies or installs Node.js LTS using Chocolatey.
    - Refreshes session PATH dynamically.
    - Idempotent: Skips re-installation if valid versions already exist.

.EXAMPLE
    .\02-install-dependencies.ps1
#>

[CmdletBinding()]
param()

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

function Refresh-SessionPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"

    $knownPaths = @(
        "C:\Program Files\Git\cmd",
        "C:\Program Files\Git\bin",
        "C:\Program Files\nodejs",
        "$env:APPDATA\npm"
    )
    foreach ($p in $knownPaths) {
        if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
            $env:Path = "$p;" + $env:Path
        }
    }
}

Write-LogHeader "PEPSI DEPOT INSTALLER — PHASE 2: RUNTIME DEPENDENCIES (GIT & NODE.JS)"

# 1. Administrator Privileges Check
if (-not (Test-IsAdmin)) {
    Write-LogError "This script requires elevated Administrator privileges."
    Write-LogError "Please relaunch PowerShell as Administrator and retry."
    exit 1
}
Write-LogSuccess "Administrator privileges verified."

# 2. Verify Chocolatey Availability
if (-not (Get-Command "choco.exe" -ErrorAction SilentlyContinue)) {
    $chocoBin = "$env:ProgramData\chocolatey\bin"
    if (Test-Path $chocoBin) {
        $env:Path = "$chocoBin;" + $env:Path
    } else {
        Write-LogError "Chocolatey (choco.exe) is not available. Please run 01-install-chocolatey.ps1 first."
        exit 1
    }
}

# 3. Git Installation & Verification
Write-LogInfo "Checking Git status..."
Refresh-SessionPath

$gitCmd = Get-Command "git.exe" -ErrorAction SilentlyContinue
if ($gitCmd) {
    $gitVer = (& git --version) -join " "
    Write-LogSuccess "Git is already installed: $gitVer (at $($gitCmd.Source))"
} else {
    Write-LogInfo "Git not detected. Installing via Chocolatey (package: git)..."
    try {
        & choco install git -y --no-progress
        Refresh-SessionPath

        $gitCmd = Get-Command "git.exe" -ErrorAction SilentlyContinue
        if ($gitCmd) {
            $gitVer = (& git --version) -join " "
            Write-LogSuccess "Git installed successfully: $gitVer"
        } else {
            Write-LogError "Git installation completed but git.exe was not found in PATH."
            exit 1
        }
    } catch {
        Write-LogError "Failed to install Git: $($_.Exception.Message)"
        exit 1
    }
}

# 4. Node.js & npm Installation & Verification
Write-LogInfo "Checking Node.js status..."
Refresh-SessionPath

$nodeCmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
$npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue

$needNodeInstall = $false
if ($nodeCmd -and $npmCmd) {
    try {
        $nodeVer = (& node -v)
        $npmVer = (& npm -v)
        Write-LogSuccess "Node.js is already installed: $nodeVer (at $($nodeCmd.Source))"
        Write-LogSuccess "npm is already installed: v$npmVer (at $($npmCmd.Source))"
    } catch {
        $needNodeInstall = $true
    }
} else {
    $needNodeInstall = $true
}

if ($needNodeInstall) {
    Write-LogInfo "Node.js not detected. Installing via Chocolatey (package: nodejs)..."
    try {
        & choco install nodejs -y --no-progress
        Refresh-SessionPath

        $nodeCmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
        $npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue

        if ($nodeCmd -and $npmCmd) {
            $nodeVer = (& node -v)
            $npmVer = (& npm -v)
            Write-LogSuccess "Node.js installed successfully: $nodeVer"
            Write-LogSuccess "npm installed successfully: v$npmVer"
        } else {
            Write-LogError "Node.js installation completed but node.exe or npm.cmd was not found in PATH."
            exit 1
        }
    } catch {
        Write-LogError "Failed to install Node.js: $($_.Exception.Message)"
        exit 1
    }
}

Write-LogHeader "PHASE 2 COMPLETED SUCCESSFULLY: ALL RUNTIME DEPENDENCIES VERIFIED"
exit 0
