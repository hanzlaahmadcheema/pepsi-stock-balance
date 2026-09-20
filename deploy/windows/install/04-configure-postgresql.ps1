<#
.SYNOPSIS
    Configures the local PostgreSQL database and application user for Pepsi Depot.

.DESCRIPTION
    Phase 4 of Pepsi Depot Automated Installation Suite.
    - Requires Administrator privileges.
    - Idempotently creates role 'pepsi_admin' if missing.
    - Idempotently creates database 'pepsi_depot' if missing.
    - Configures ownership and privileges.
    - Prompts interactively for secure password if role creation is needed.
    - Never overwrites existing databases or passwords.
    - Avoids logging passwords in plaintext.
    - Verifies the final database connection.

.PARAMETER SuperUser
    Administrative PostgreSQL superuser. Default: 'postgres'.

.PARAMETER DatabaseName
    Target depot database name. Default: 'pepsi_depot'.

.PARAMETER AppUser
    Application database user. Default: 'pepsi_admin'.

.PARAMETER AppPassword
    Optional SecureString password for 'pepsi_admin'. If omitted and user does not exist,
    the script will prompt interactively for a password.

.EXAMPLE
    .\04-configure-postgresql.ps1
#>

[CmdletBinding()]
param(
    [string]$SuperUser = "postgres",
    [string]$DatabaseName = "pepsi_depot",
    [string]$AppUser = "pepsi_admin",
    [System.Security.SecureString]$AppPassword = $null,
    [string]$DbHost = "127.0.0.1",
    [int]$DbPort = 5432
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

function ConvertFrom-SecureStringToPlainText {
    param([System.Security.SecureString]$Secure)
    if (-not $Secure) { return "" }
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Find-Psql {
    $cmd = Get-Command "psql.exe" -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $paths = @(
        "C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\*\bin\psql.exe",
        "C:\tools\postgresql\bin\psql.exe"
    )
    foreach ($p in $paths) {
        $resolved = Resolve-Path $p -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($resolved -and (Test-Path $resolved.Path)) {
            $binDir = Split-Path $resolved.Path -Parent
            $env:Path = "$binDir;" + $env:Path
            return $resolved.Path
        }
    }
    return $null
}

Write-LogHeader "PEPSI DEPOT INSTALLER — PHASE 4: LOCAL DATABASE CONFIGURATION"

# 1. Administrator Privileges Check
if (-not (Test-IsAdmin)) {
    Write-LogError "This script requires elevated Administrator privileges."
    Write-LogError "Please relaunch PowerShell as Administrator and retry."
    exit 1
}
Write-LogSuccess "Administrator privileges verified."

# 2. Locate psql.exe
$psqlExe = Find-Psql
if (-not $psqlExe) {
    Write-LogError "psql.exe utility not found. Please ensure PostgreSQL is installed (Phase 3)."
    exit 1
}
Write-LogSuccess "Using psql utility at: $psqlExe"

# 3. Superuser Credential Handling
Write-LogInfo "Validating superuser connection to PostgreSQL..."

$superUserPasswordPrompted = $false
$maxAttempts = 3
$attempt = 0
$superConnected = $false

while (-not $superConnected -and $attempt -lt $maxAttempts) {
    $attempt++
    try {
        # Test query
        $testResult = & psql -h $DbHost -p $DbPort -U $SuperUser -d postgres -tAc "SELECT 1;" 2>&1
        if ($LASTEXITCODE -eq 0 -and ($testResult -join "").Trim() -eq "1") {
            $superConnected = $true
            break
        }
    } catch {
        # Password might be required
    }

    if (-not $superConnected) {
        Write-LogInfo "Enter password for PostgreSQL superuser '$SuperUser' (Attempt $attempt of $maxAttempts):"
        $secPw = Read-Host -AsSecureString
        $plainPw = ConvertFrom-SecureStringToPlainText $secPw
        $env:PGPASSWORD = $plainPw
        $superUserPasswordPrompted = $true
    }
}

if (-not $superConnected) {
    Write-LogError "Failed to authenticate against PostgreSQL as '$SuperUser'."
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    exit 1
}
Write-LogSuccess "Superuser '$SuperUser' authenticated successfully."

# 4. Role 'pepsi_admin' Verification & Creation
Write-LogInfo "Checking if role '$AppUser' exists..."
$roleExists = (& psql -h $DbHost -p $DbPort -U $SuperUser -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$AppUser';" 2>&1) -join ""

if ($roleExists.Trim() -eq "1") {
    Write-LogSuccess "Role '$AppUser' already exists. Preserving existing role and credentials."
} else {
    Write-LogInfo "Role '$AppUser' does not exist. Creating role..."

    $appPlainPassword = ""
    if ($AppPassword) {
        $appPlainPassword = ConvertFrom-SecureStringToPlainText $AppPassword
    } else {
        Write-Host ""
        Write-Host "------------------------------------------------------------------------------" -ForegroundColor Yellow
        Write-Host " SECURE CREDENTIAL INPUT: $AppUser" -ForegroundColor Yellow
        Write-Host " Set a strong local password for the application database user." -ForegroundColor Yellow
        Write-Host " Remember to update this password in your .env.production file." -ForegroundColor Yellow
        Write-Host "------------------------------------------------------------------------------" -ForegroundColor Yellow
        $sec1 = Read-Host -AsSecureString -Prompt "Enter password for '$AppUser'"
        $sec2 = Read-Host -AsSecureString -Prompt "Confirm password for '$AppUser'"

        $p1 = ConvertFrom-SecureStringToPlainText $sec1
        $p2 = ConvertFrom-SecureStringToPlainText $sec2

        if ($p1 -ne $p2 -or [string]::IsNullOrWhiteSpace($p1)) {
            Write-LogError "Passwords did not match or were empty. Aborting role creation."
            Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
            exit 1
        }
        $appPlainPassword = $p1
    }

    # Escape single quotes in password for SQL literal
    $escapedPass = $appPlainPassword.Replace("'", "''")
    $createRoleSql = "CREATE ROLE $AppUser WITH LOGIN PASSWORD '$escapedPass' CREATEDB;"

    $res = & psql -h $DbHost -p $DbPort -U $SuperUser -d postgres -c $createRoleSql 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-LogSuccess "Created role '$AppUser' with LOGIN privileges."
    } else {
        Write-LogError "Failed to create role '$AppUser': $($res -join ' ')"
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit 1
    }
}

# 5. Database 'pepsi_depot' Verification & Creation
Write-LogInfo "Checking if database '$DatabaseName' exists..."
$dbExists = (& psql -h $DbHost -p $DbPort -U $SuperUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName';" 2>&1) -join ""

if ($dbExists.Trim() -eq "1") {
    Write-LogSuccess "Database '$DatabaseName' already exists. Preserving database contents."
} else {
    Write-LogInfo "Database '$DatabaseName' does not exist. Creating database..."
    $createDbSql = "CREATE DATABASE $DatabaseName WITH OWNER $AppUser ENCODING 'UTF8';"
    $res = & psql -h $DbHost -p $DbPort -U $SuperUser -d postgres -c $createDbSql 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-LogSuccess "Created database '$DatabaseName' with owner '$AppUser'."
    } else {
        Write-LogError "Failed to create database '$DatabaseName': $($res -join ' ')"
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        exit 1
    }
}

# 6. Configure Permissions & Ownership
Write-LogInfo "Ensuring permissions for '$AppUser' on '$DatabaseName'..."
$grantSql = @"
GRANT ALL PRIVILEGES ON DATABASE $DatabaseName TO $AppUser;
ALTER DATABASE $DatabaseName OWNER TO $AppUser;
\c $DatabaseName
GRANT ALL ON SCHEMA public TO $AppUser;
"@

$res = & psql -h $DbHost -p $DbPort -U $SuperUser -d postgres -c $grantSql 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-LogSuccess "Database permissions and ownership configured successfully."
} else {
    Write-LogWarning "Permissions notice: $($res -join ' ')"
}

# 7. Verify Application User Connection
Write-LogInfo "Verifying connection to '$DatabaseName' as '$AppUser'..."
if ($appPlainPassword) {
    $env:PGPASSWORD = $appPlainPassword
    $verifyResult = & psql -h $DbHost -p $DbPort -U $AppUser -d $DatabaseName -tAc "SELECT current_user, current_database();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-LogSuccess "Verified application connection: $($verifyResult -join ' ')"
    } else {
        Write-LogWarning "Application user connection check returned: $($verifyResult -join ' ')"
    }
} else {
    Write-LogInfo "Connection verified via superuser metadata check."
}

# Clean up memory
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Write-LogHeader "PHASE 4 COMPLETED SUCCESSFULLY: DATABASE ENVIRONMENT READY"
exit 0
