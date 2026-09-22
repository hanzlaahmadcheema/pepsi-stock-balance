<#
.SYNOPSIS
    Master Automated Installation Orchestrator for Pepsi Depot Server (Windows 10/11 64-bit).

.DESCRIPTION
    Executes the complete depot workstation preparation suite in strict order:
        Phase 1: 01-install-chocolatey.ps1
        Phase 2: 02-install-dependencies.ps1 (Git & Node.js LTS)
        Phase 3: 03-install-postgresql.ps1 (PostgreSQL 18 & Service)
        Phase 4: 04-configure-postgresql.ps1 (pepsi_depot & pepsi_admin)
        Phase 5: 05-setup-application.ps1 (Directory Layout, npm ci, Build, Daemon Bundle)
        Phase 6: 06-validate-installation.ps1 (Read-Only Validation Audit)

    Invariants:
    - Stops immediately on any failure.
    - Idempotent and safe to re-run.
    - Zero remote connections (No SSH, No Cloud Production calls).
    - NSSM service installation is intentionally deferred to configuration phase.
    - Passwords and secrets are never committed or logged in plaintext.

.PARAMETER AppDir
    Target depot application directory. Default: 'C:\PepsiDepot\app'.

.PARAMETER SkipChoco
    Skip Chocolatey installation if already verified.

.PARAMETER SkipDeps
    Skip Git and Node.js dependency installation.

.PARAMETER SkipPostgres
    Skip PostgreSQL 18 engine installation.

.PARAMETER SkipDbConfig
    Skip local database/user creation.

.PARAMETER SkipAppSetup
    Skip application copy, npm ci, and build.

.EXAMPLE
    Set-ExecutionPolicy -Scope Process Bypass
    .\deploy\windows\install\install-all.ps1
#>

[CmdletBinding()]
param(
    [string]$AppDir = "C:\PepsiDepot\app",
    [switch]$SkipChoco,
    [switch]$SkipDeps,
    [switch]$SkipPostgres,
    [switch]$SkipDbConfig,
    [switch]$SkipAppSetup,
    [string]$SuperUserPassword,
    [System.Security.SecureString]$AppPassword
)

$ErrorActionPreference = "Stop"

function Write-Banner {
    param([string]$Title)
    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-PhaseHeader {
    param([int]$Step, [int]$Total, [string]$Name)
    Write-Host ""
    Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host " [PHASE $Step/$Total] $Name" -ForegroundColor Yellow
    Write-Host "------------------------------------------------------------------------------" -ForegroundColor DarkCyan
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$identity
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

$startTime = Get-Date

Write-Banner "PEPSI DEPOT SERVER - AUTOMATED INSTALLATION SUITE (WINDOWS 64-BIT)"

# 0. Administrator Privileges Check
if (-not (Test-IsAdmin)) {
    Write-Host "[ERROR] Elevated Administrator privileges are required to run this installer." -ForegroundColor Red
    Write-Host "Please start PowerShell with 'Run as administrator' and execute:" -ForegroundColor Red
    Write-Host "  Set-ExecutionPolicy -Scope Process Bypass" -ForegroundColor White
    Write-Host "  .\deploy\windows\install\install-all.ps1" -ForegroundColor White
    exit 1
}
Write-Host "[OK] Elevated Administrator privileges confirmed." -ForegroundColor Green

$installDir = $PSScriptRoot

# ------------------------------------------------------------------------------
# Phase 1: Chocolatey Package Manager
# ------------------------------------------------------------------------------
Write-PhaseHeader 1 6 "Chocolatey Package Manager"
if (-not $SkipChoco) {
    $p1 = Join-Path $installDir "01-install-chocolatey.ps1"
    & "$p1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FATAL] Phase 1 (Chocolatey) failed with code $LASTEXITCODE. Aborting." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[SKIP] Phase 1 skipped per operator parameter." -ForegroundColor Gray
}

# ------------------------------------------------------------------------------
# Phase 2: Runtime Dependencies (Git & Node.js)
# ------------------------------------------------------------------------------
Write-PhaseHeader 2 6 "Runtime Dependencies (Git & Node.js)"
if (-not $SkipDeps) {
    $p2 = Join-Path $installDir "02-install-dependencies.ps1"
    & "$p2"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FATAL] Phase 2 (Dependencies) failed with code $LASTEXITCODE. Aborting." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[SKIP] Phase 2 skipped per operator parameter." -ForegroundColor Gray
}

# ------------------------------------------------------------------------------
# Phase 3: PostgreSQL 18 Engine & Windows Service
# ------------------------------------------------------------------------------
Write-PhaseHeader 3 6 "PostgreSQL 18 Engine & Windows Service"
if (-not $SkipPostgres) {
    $p3 = Join-Path $installDir "03-install-postgresql.ps1"
    if ($SuperUserPassword) {
        & "$p3" -SuperUserPassword $SuperUserPassword
    } else {
        & "$p3"
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FATAL] Phase 3 (PostgreSQL 18) failed with code $LASTEXITCODE. Aborting." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[SKIP] Phase 3 skipped per operator parameter." -ForegroundColor Gray
}

# ------------------------------------------------------------------------------
# Phase 4: Local Database Configuration (pepsi_depot & pepsi_admin)
# ------------------------------------------------------------------------------
Write-PhaseHeader 4 6 "Local Database & Role Configuration"
if (-not $SkipDbConfig) {
    $p4 = Join-Path $installDir "04-configure-postgresql.ps1"
    if ($AppPassword) {
        & "$p4" -AppPassword $AppPassword
    } else {
        & "$p4"
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FATAL] Phase 4 (Database Configuration) failed with code $LASTEXITCODE. Aborting." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[SKIP] Phase 4 skipped per operator parameter." -ForegroundColor Gray
}

# ------------------------------------------------------------------------------
# Phase 5: Application Deployment, npm ci & Build
# ------------------------------------------------------------------------------
Write-PhaseHeader 5 6 "Application Deployment & Production Build"
if (-not $SkipAppSetup) {
    $p5 = Join-Path $installDir "05-setup-application.ps1"
    & "$p5" -AppDir $AppDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[FATAL] Phase 5 (Application Setup) failed with code $LASTEXITCODE. Aborting." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[SKIP] Phase 5 skipped per operator parameter." -ForegroundColor Gray
}

# ------------------------------------------------------------------------------
# Phase 6: Read-Only Validation Audit
# ------------------------------------------------------------------------------
Write-PhaseHeader 6 6 "Read-Only Validation Audit"
$p6 = Join-Path $installDir "06-validate-installation.ps1"
& "$p6" -AppDir $AppDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Phase 6 Validation reported one or more issues." -ForegroundColor Yellow
}

$elapsed = (Get-Date) - $startTime
Write-Banner "DEPOT INSTALLATION SUITE COMPLETED IN $($elapsed.Minutes)m $($elapsed.Seconds)s"

Write-Host "Next Steps for the System Administrator:" -ForegroundColor White
Write-Host "  1. Review .env.production at: $AppDir\.env.production" -ForegroundColor Gray
Write-Host "     - Set your local pepsi_admin database password in DATABASE_URL." -ForegroundColor Gray
Write-Host "     - Set provisioned SYNC_DEVICE_ID and SYNC_DEVICE_TOKEN." -ForegroundColor Gray
Write-Host "  2. Apply local Prisma migrations:" -ForegroundColor Gray
Write-Host "     cd $AppDir; npx prisma migrate deploy" -ForegroundColor Gray
Write-Host "  3. Configure Windows Firewall (Port 3000 LAN access):" -ForegroundColor Gray
Write-Host "     .\deploy\windows\configure-firewall.bat" -ForegroundColor Gray
Write-Host "  4. Register Windows Services via NSSM:" -ForegroundColor Gray
Write-Host "     .\deploy\windows\install-services.bat" -ForegroundColor Gray
Write-Host ""
Write-Host "Detailed instructions available at: deploy\windows\INSTALL.md" -ForegroundColor Cyan
Write-Host ""
exit 0
