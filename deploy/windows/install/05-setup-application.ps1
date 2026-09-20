<#
.SYNOPSIS
    Deploys the application codebase, dependencies, build artifacts, and environment template.

.DESCRIPTION
    Phase 5 of Pepsi Depot Automated Installation Suite.
    - Requires Administrator privileges.
    - Verifies Git and Node.js.
    - Prepares directory layout:
        C:\PepsiDepot
        C:\PepsiDepot\app
        C:\PepsiDepot\logs
        C:\PepsiDepot\backups
    - Installs production dependencies via npm ci.
    - Compiles Next.js production build and standalone sync daemon bundle.
    - Creates .env.production template from .env.depot.example if missing.
    - Validates Prisma schema.
    - Strictly avoids connecting to Cloud Production or creating business data.

.PARAMETER AppDir
    Target application directory. Default: 'C:\PepsiDepot\app'.

.PARAMETER BaseDir
    Base depot directory. Default: 'C:\PepsiDepot'.

.PARAMETER RepoUrl
    Optional Git repository URL if cloning onto a fresh machine from remote.

.EXAMPLE
    .\05-setup-application.ps1
#>

[CmdletBinding()]
param(
    [string]$AppDir = "C:\PepsiDepot\app",
    [string]$BaseDir = "C:\PepsiDepot",
    [string]$RepoUrl = ""
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

Write-LogHeader "PEPSI DEPOT INSTALLER — PHASE 5: APPLICATION SETUP & BUILD"

# 1. Administrator Privileges Check
if (-not (Test-IsAdmin)) {
    Write-LogError "This script requires elevated Administrator privileges."
    Write-LogError "Please relaunch PowerShell as Administrator and retry."
    exit 1
}
Write-LogSuccess "Administrator privileges verified."

# 2. Check Node.js and Git Availability
if (-not (Get-Command "node.exe" -ErrorAction SilentlyContinue)) {
    Write-LogError "Node.js (node.exe) not found in PATH. Please run 02-install-dependencies.ps1 first."
    exit 1
}
if (-not (Get-Command "npm.cmd" -ErrorAction SilentlyContinue)) {
    Write-LogError "npm (npm.cmd) not found in PATH. Please run 02-install-dependencies.ps1 first."
    exit 1
}
if (-not (Get-Command "git.exe" -ErrorAction SilentlyContinue)) {
    Write-LogError "Git (git.exe) not found in PATH. Please run 02-install-dependencies.ps1 first."
    exit 1
}

# 3. Create Standard Depot Directory Structure
Write-LogInfo "Ensuring depot directory structure at $BaseDir..."
$directoriesToEnsure = @(
    $BaseDir,
    $AppDir,
    (Join-Path $BaseDir "logs"),
    (Join-Path $BaseDir "backups")
)

foreach ($dir in $directoriesToEnsure) {
    if (-not (Test-Path $dir)) {
        New-Item -Path $dir -ItemType Directory -Force | Out-Null
        Write-LogSuccess "Created directory: $dir"
    } else {
        Write-LogInfo "Directory already exists: $dir"
    }
}

# 4. Source Tree Placement
$scriptSourceDir = Resolve-Path (Join-Path $PSScriptRoot "..\..\..") -ErrorAction SilentlyContinue
$currentIsTarget = $false

if ($scriptSourceDir -and (Test-Path (Join-Path $scriptSourceDir.Path "package.json"))) {
    if ($scriptSourceDir.Path.TrimEnd('\') -eq $AppDir.TrimEnd('\')) {
        $currentIsTarget = $true
        Write-LogSuccess "Installer is running directly inside target application directory: $AppDir"
    }
}

if (-not $currentIsTarget) {
    $targetPackageJson = Join-Path $AppDir "package.json"
    if (-not (Test-Path $targetPackageJson)) {
        if ($RepoUrl) {
            Write-LogInfo "Cloning repository from $RepoUrl into $AppDir..."
            & git clone $RepoUrl $AppDir
        } elseif ($scriptSourceDir -and (Test-Path (Join-Path $scriptSourceDir.Path "package.json"))) {
            Write-LogInfo "Copying source from $($scriptSourceDir.Path) into $AppDir..."
            robocopy $scriptSourceDir.Path $AppDir /E /XD node_modules .next dist /XF .env .env.local /NFL /NDL /NJH /NJS /nc /ns
        } else {
            Write-LogError "Application files not found in $AppDir and no source directory/repo URL available."
            exit 1
        }
    } else {
        Write-LogSuccess "Application package.json found at $targetPackageJson."
    }
}

# 5. Environment Template Deployment (.env.production)
$envProdPath = Join-Path $AppDir ".env.production"
$envExamplePath = Join-Path $AppDir "deploy\windows\.env.depot.example"

if (-not (Test-Path $envProdPath)) {
    if (Test-Path $envExamplePath) {
        Copy-Item -Path $envExamplePath -Destination $envProdPath -Force
        Write-LogSuccess "Created .env.production template from .env.depot.example"
        Write-Host ""
        Write-Host "------------------------------------------------------------------------------" -ForegroundColor Yellow
        Write-Host " ACTION REQUIRED BY OPERATOR:" -ForegroundColor Yellow
        Write-Host " Created fresh template at: $envProdPath" -ForegroundColor Yellow
        Write-Host " Before running the depot services, you must edit this file to configure:" -ForegroundColor Yellow
        Write-Host "   1. Local pepsi_admin database password in DATABASE_URL" -ForegroundColor Yellow
        Write-Host "   2. Provisioned SYNC_DEVICE_ID and SYNC_DEVICE_TOKEN" -ForegroundColor Yellow
        Write-Host "   3. NEXT_PUBLIC_SUPABASE_URL and Auth Keys" -ForegroundColor Yellow
        Write-Host "------------------------------------------------------------------------------" -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-LogWarning "Template $envExamplePath was not found. Please create .env.production manually."
    }
} else {
    Write-LogSuccess "Existing .env.production found at $envProdPath. Preserving configuration."
}

# 6. Install Dependencies
Push-Location $AppDir
try {
    Write-LogInfo "Installing Node.js dependencies in $AppDir..."
    $lockFile = Join-Path $AppDir "package-lock.json"

    if (Test-Path $lockFile) {
        Write-LogInfo "Executing 'npm ci'..."
        & npm ci
    } else {
        Write-LogInfo "package-lock.json not found. Executing 'npm install'..."
        & npm install
    }

    if ($LASTEXITCODE -ne 0) {
        Write-LogError "'npm ci / install' failed with exit code $LASTEXITCODE."
        exit 1
    }
    Write-LogSuccess "Node dependencies installed successfully."

    # 7. Validate Prisma Schema
    Write-LogInfo "Validating Prisma schema (read-only)..."
    & npx prisma validate
    if ($LASTEXITCODE -ne 0) {
        Write-LogError "Prisma schema validation failed."
        exit 1
    }
    Write-LogSuccess "Prisma schema is valid."

    # 8. Compile Production Application & Sync Daemon
    Write-LogInfo "Building production application and sync daemon bundle..."
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-LogError "Production build ('npm run build') failed."
        exit 1
    }
    Write-LogSuccess "Production build compiled successfully."

    # Verify build artifacts
    $nextBuild = Join-Path $AppDir ".next"
    $daemonBundle = Join-Path $AppDir "dist\daemon\service-entrypoint.js"

    if (-not (Test-Path $nextBuild)) {
        Write-LogError ".next production build folder was not generated."
        exit 1
    }
    if (-not (Test-Path $daemonBundle)) {
        Write-LogError "Compiled daemon artifact $daemonBundle was not found."
        exit 1
    }
    Write-LogSuccess "Verified Next.js build and standalone daemon bundle ($daemonBundle)."
} finally {
    Pop-Location
}

Write-LogHeader "PHASE 5 COMPLETED SUCCESSFULLY: APPLICATION DEPLOYED & BUILT"
exit 0
