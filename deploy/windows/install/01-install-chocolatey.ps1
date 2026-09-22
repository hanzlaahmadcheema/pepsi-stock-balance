<#
.SYNOPSIS
    Installs Chocolatey package manager on Windows 10/11 64-bit depot servers.

.DESCRIPTION
    Phase 1 of Pepsi Depot Automated Installation Suite.
    - Verifies Administrator privileges.
    - Checks if Chocolatey is already installed.
    - If missing, installs Chocolatey safely via official installation script over TLS 1.2.
    - Refreshes process environment variables so choco is immediately usable.
    - Idempotent: Safe to run repeatedly.

.EXAMPLE
    .\01-install-chocolatey.ps1
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

Write-LogHeader "PEPSI DEPOT INSTALLER - PHASE 1: CHOCOLATEY PACKAGE MANAGER"

# 1. Administrator Privileges Check
if (-not (Test-IsAdmin)) {
    Write-LogError "This script requires elevated Administrator privileges."
    Write-LogError "Please relaunch PowerShell as Administrator and retry."
    exit 1
}
Write-LogSuccess "Administrator privileges verified."

# 2. Check if Chocolatey is already installed
$chocoCmd = Get-Command "choco.exe" -ErrorAction SilentlyContinue

if ($chocoCmd) {
    try {
        $version = & choco --version
        Write-LogSuccess "Chocolatey is already installed (v$version) at: $($chocoCmd.Source)"
        exit 0
    } catch {
        Write-LogWarning "choco.exe was found in PATH but failed to report version. Verifying installation path..."
    }
}

$chocoDir = [System.Environment]::GetEnvironmentVariable("ChocolateyInstall", "Machine")
if (-not $chocoDir -or -not (Test-Path $chocoDir)) {
    $chocoDir = "$env:ProgramData\chocolatey"
}

$chocoExe = Join-Path $chocoDir "bin\choco.exe"
if (Test-Path $chocoExe) {
    Write-LogSuccess "Chocolatey found at $chocoExe. Refreshing environment PATH..."
    $env:ChocolateyInstall = $chocoDir
    if ($env:Path -notlike "*$chocoDir\bin*") {
        $env:Path = "$chocoDir\bin;" + $env:Path
    }
    $version = & "$chocoExe" --version
    Write-LogSuccess "Chocolatey is installed and accessible (v$version)."
    exit 0
}

# 3. Install Chocolatey
Write-LogInfo "Chocolatey not detected. Initiating official Chocolatey installation..."

try {
    # Force TLS 1.2 minimum
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072

    $installScriptUrl = 'https://community.chocolatey.org/install.ps1'
    Write-LogInfo "Downloading installer from $installScriptUrl..."

    $installScript = (New-Object System.Net.WebClient).DownloadString($installScriptUrl)
    Invoke-Expression $installScript

    # Refresh process environment
    $env:ChocolateyInstall = [System.Environment]::GetEnvironmentVariable("ChocolateyInstall", "Machine")
    if (-not $env:ChocolateyInstall) {
        $env:ChocolateyInstall = "$env:ProgramData\chocolatey"
    }

    $binPath = Join-Path $env:ChocolateyInstall "bin"
    if (Test-Path $binPath) {
        $env:Path = "$binPath;" + $env:Path
    }

    # Verify installation
    if (Get-Command "choco.exe" -ErrorAction SilentlyContinue) {
        $installedVersion = & choco --version
        Write-LogSuccess "Chocolatey installed successfully (v$installedVersion)."
        exit 0
    } else {
        Write-LogError "Chocolatey installation completed but choco.exe was not found in PATH."
        exit 1
    }
} catch {
    Write-LogError "Failed to install Chocolatey: $($_.Exception.Message)"
    exit 1
}
