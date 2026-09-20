<#
.SYNOPSIS
    Performs a comprehensive read-only validation audit of the Pepsi Depot installation.

.DESCRIPTION
    Phase 6 of Pepsi Depot Automated Installation Suite.
    - Strictly read-only: No data mutations or schema changes.
    - Validates Administrator status.
    - Validates toolchains: Chocolatey, Git, Node.js, npm, PostgreSQL.
    - Validates PostgreSQL Windows service state and port binding.
    - Validates pepsi_admin role and pepsi_depot database existence.
    - Validates directory structure, dependencies, build artifacts, and sync daemon bundle.
    - Outputs clear [OK] / [FAIL] checklist.

.PARAMETER AppDir
    Target application directory. Default: 'C:\PepsiDepot\app'.

.PARAMETER DatabaseName
    Depot database name. Default: 'pepsi_depot'.

.PARAMETER AppUser
    Application user role. Default: 'pepsi_admin'.

.EXAMPLE
    .\06-validate-installation.ps1
#>

[CmdletBinding()]
param(
    [string]$AppDir = "C:\PepsiDepot\app",
    [string]$DatabaseName = "pepsi_depot",
    [string]$AppUser = "pepsi_admin",
    [int]$DbPort = 5432
)

$ErrorActionPreference = "Continue"

function Write-LogHeader {
    param([string]$Title)
    Write-Host ""
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor Cyan
    Write-Host ""
}

$passedCount = 0
$failedCount = 0

function Record-Check {
    param(
        [string]$Name,
        [bool]$Success,
        [string]$Details
    )
    if ($Success) {
        $script:passedCount++
        Write-Host "  [OK]   " -NoNewline -ForegroundColor Green
        Write-Host "$Name " -NoNewline -ForegroundColor White
        if ($Details) {
            Write-Host "($Details)" -ForegroundColor Gray
        } else {
            Write-Host ""
        }
    } else {
        $script:failedCount++
        Write-Host "  [FAIL] " -NoNewline -ForegroundColor Red
        Write-Host "$Name " -NoNewline -ForegroundColor White
        if ($Details) {
            Write-Host "($Details)" -ForegroundColor Yellow
        } else {
            Write-Host ""
        }
    }
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$identity
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Refresh-Path {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"

    $extraPaths = @(
        "C:\Program Files\Git\cmd",
        "C:\Program Files\nodejs",
        "$env:ProgramData\chocolatey\bin"
    )
    foreach ($p in $extraPaths) {
        if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
            $env:Path = "$p;" + $env:Path
        }
    }
}

Write-LogHeader "PEPSI DEPOT INSTALLER — PHASE 6: READ-ONLY VALIDATION AUDIT"
Refresh-Path

# 1. Administrator Privileges
Record-Check "Administrator Privileges" (Test-IsAdmin) "Elevated process execution"

# 2. Chocolatey Package Manager
$chocoCmd = Get-Command "choco.exe" -ErrorAction SilentlyContinue
if ($chocoCmd) {
    $cVer = (& choco --version 2>&1) -join ""
    Record-Check "Chocolatey" ($LASTEXITCODE -eq 0) "v$cVer"
} else {
    Record-Check "Chocolatey" $false "choco.exe not found in PATH"
}

# 3. Git
$gitCmd = Get-Command "git.exe" -ErrorAction SilentlyContinue
if ($gitCmd) {
    $gVer = (& git --version 2>&1) -join ""
    Record-Check "Git" ($LASTEXITCODE -eq 0) "$gVer"
} else {
    Record-Check "Git" $false "git.exe not found in PATH"
}

# 4. Node.js
$nodeCmd = Get-Command "node.exe" -ErrorAction SilentlyContinue
if ($nodeCmd) {
    $nVer = (& node -v 2>&1) -join ""
    Record-Check "Node.js" ($LASTEXITCODE -eq 0) "$nVer"
} else {
    Record-Check "Node.js" $false "node.exe not found in PATH"
}

# 5. npm
$npmCmd = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if ($npmCmd) {
    $npmVer = (& npm -v 2>&1) -join ""
    Record-Check "npm" ($LASTEXITCODE -eq 0) "v$npmVer"
} else {
    Record-Check "npm" $false "npm.cmd not found in PATH"
}

# 6. PostgreSQL Utility (psql.exe)
$psqlCmd = Get-Command "psql.exe" -ErrorAction SilentlyContinue
if (-not $psqlCmd) {
    $paths = @("C:\Program Files\PostgreSQL\18\bin\psql.exe", "C:\Program Files\PostgreSQL\*\bin\psql.exe")
    foreach ($p in $paths) {
        $res = Resolve-Path $p -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($res) {
            $binDir = Split-Path $res.Path -Parent
            $env:Path = "$binDir;" + $env:Path
            $psqlCmd = Get-Command "psql.exe" -ErrorAction SilentlyContinue
            break
        }
    }
}
if ($psqlCmd) {
    $pVer = (& psql --version 2>&1) -join ""
    Record-Check "PostgreSQL 18" ($LASTEXITCODE -eq 0) "$pVer"
} else {
    Record-Check "PostgreSQL 18" $false "psql.exe not found in PATH"
}

# 7. PostgreSQL Windows Service
$pgServices = Get-Service | Where-Object { $_.Name -like "*postgres*" -or $_.DisplayName -like "*PostgreSQL*" }
if ($pgServices) {
    $activeSvc = $pgServices | Where-Object { $_.Status -eq "Running" } | Select-Object -First 1
    if ($activeSvc) {
        Record-Check "PostgreSQL Service" $true "Service '$($activeSvc.Name)' is RUNNING (Startup: $($activeSvc.StartType))"
    } else {
        $firstSvc = $pgServices | Select-Object -First 1
        Record-Check "PostgreSQL Service" $false "Service '$($firstSvc.Name)' is found but status is '$($firstSvc.Status)'"
    }
} else {
    Record-Check "PostgreSQL Service" $false "No Windows service matching '*postgres*' found"
}

# 8. Local TCP Port 5432 Reachability
$tcp = Test-NetConnection -ComputerName 127.0.0.1 -Port $DbPort -WarningAction SilentlyContinue
Record-Check "Local Port $DbPort (Loopback)" ($tcp.TcpTestSucceeded) "Listening on 127.0.0.1:$DbPort"

# 9. Database pepsi_depot & Role pepsi_admin Verification
if ($psqlCmd -and $tcp.TcpTestSucceeded) {
    # Check role
    $roleRes = (& psql -h 127.0.0.1 -p $DbPort -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$AppUser';" 2>&1) -join ""
    if ($roleRes.Trim() -eq "1") {
        Record-Check "pepsi_admin" $true "Database role '$AppUser' exists"
    } else {
        Record-Check "pepsi_admin" $false "Role '$AppUser' not found in PostgreSQL metadata"
    }

    # Check database
    $dbRes = (& psql -h 127.0.0.1 -p $DbPort -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';" 2>&1) -join ""
    if ($dbRes.Trim() -eq "1") {
        Record-Check "pepsi_depot" $true "Database '$DatabaseName' exists"
    } else {
        Record-Check "pepsi_depot" $false "Database '$DatabaseName' not found in PostgreSQL metadata"
    }
} else {
    Record-Check "pepsi_admin" $false "Skipped: psql or port 5432 unavailable"
    Record-Check "pepsi_depot" $false "Skipped: psql or port 5432 unavailable"
}

# 10. Depot Directory Structure
$baseDir = Split-Path $AppDir -Parent
$logsDir = Join-Path $baseDir "logs"
$backupsDir = Join-Path $baseDir "backups"

$dirsOk = (Test-Path $AppDir) -and (Test-Path $logsDir) -and (Test-Path $backupsDir)
Record-Check "Application Directory Layout" $dirsOk "$baseDir (app, logs, backups)"

# 11. Node Modules & Dependencies
$nodeModules = Join-Path $AppDir "node_modules"
$prismaClient = Join-Path $AppDir "node_modules\@prisma\client"
$depsOk = (Test-Path $nodeModules) -and (Test-Path $prismaClient)
Record-Check "Node Dependencies" $depsOk "node_modules installed with Prisma Client"

# 12. Prisma Schema Validation
if (Test-Path $AppDir) {
    Push-Location $AppDir
    $valOutput = (& npx prisma validate 2>&1) -join " "
    Pop-Location
    $schemaOk = ($LASTEXITCODE -eq 0) -and ($valOutput -match "valid")
    Record-Check "Prisma Schema" $schemaOk "prisma/schema.prisma validation passed"
} else {
    Record-Check "Prisma Schema" $false "App directory not found"
}

# 13. Next.js Production Build
$nextDir = Join-Path $AppDir ".next"
$buildOk = Test-Path $nextDir
Record-Check "Next.js Build" $buildOk "Production bundle present in .next"

# 14. Sync Daemon Standalone Bundle
$daemonBundle = Join-Path $AppDir "dist\daemon\service-entrypoint.js"
$daemonOk = Test-Path $daemonBundle
Record-Check "Sync Daemon Artifact" $daemonOk "dist\daemon\service-entrypoint.js compiled"

# 15. Environment Template Check
$envProd = Join-Path $AppDir ".env.production"
$envOk = Test-Path $envProd
Record-Check "Environment Config Template" $envOk ".env.production present at $envProd"

Write-Host ""
Write-Host "------------------------------------------------------------------------------" -ForegroundColor Cyan
Write-Host " VALIDATION SUMMARY: $passedCount PASSED, $failedCount FAILED" -ForegroundColor $(if ($failedCount -eq 0) { "Green" } else { "Yellow" })
Write-Host "------------------------------------------------------------------------------" -ForegroundColor Cyan

if ($failedCount -eq 0) {
    Write-Host ""
    Write-Host "  >>> [OK] ALL VALIDATIONS PASSED <<<" -ForegroundColor Green
    Write-Host "  The depot workstation environment is fully installed and verified." -ForegroundColor Green
    Write-Host "  Next Step: Configure .env.production credentials and register NSSM services." -ForegroundColor White
    Write-Host "  Refer to: deploy\windows\configure\README.md" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host ""
    Write-Host "  >>> [WARN] SOME VALIDATION CHECKS FAILED <<<" -ForegroundColor Yellow
    Write-Host "  Review the checklist above to identify missing components." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
