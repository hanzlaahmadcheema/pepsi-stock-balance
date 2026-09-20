# Pepsi Depot — Post-Installation Configuration Guide

This directory documents the post-installation configuration workflow that an administrator executes after running the automated installation suite (`install-all.ps1`).

---

## Configuration Workflow Overview

```text
Automated Installation (install-all.ps1)
       ↓
[1. Configure .env.production]
       ↓
[2. Run Local Prisma Migrations]
       ↓
[3. Configure Windows Firewall]
       ↓
[4. Register & Start NSSM Services]
       ↓
[5. Health Check & LAN Verification]
```

---

## Step 1: Configure `.env.production`

Navigate to `C:\PepsiDepot\app` and edit `.env.production` using Notepad or your preferred text editor:

```powershell
notepad C:\PepsiDepot\app\.env.production
```

Verify and supply the three configuration blocks:

### 1. Local Database URL
Set the password created during Phase 4 (`04-configure-postgresql.ps1`):
```env
DATABASE_URL="postgresql://pepsi_admin:YOUR_LOCAL_DB_PASSWORD@127.0.0.1:5432/pepsi_depot?schema=public"
```
*(Keep host set to `127.0.0.1:5432`. Never point this to Cloud Supabase!)*

### 2. Cloud Synchronization
Set the provisioned device identifier and cryptographic bearer token:
```env
CLOUD_SYNC_BASE_URL="https://pepsi-stock-management.vercel.app"
SYNC_DEVICE_ID="depot-production-01"
SYNC_DEVICE_TOKEN="tok_provisioned_token_here"
```

### 3. Supabase Authentication
Set the cloud project authentication keys used for cashier / staff logins:
```env
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOi..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
```

---

## Step 2: Apply Local Database Migrations

Apply all schema migrations to build the tables in `pepsi_depot`:

```powershell
cd C:\PepsiDepot\app
npx prisma migrate deploy
```

Verify migration status:
```powershell
npx prisma migrate status
```
*Expected output: `Database schema is up to date!`*

---

## Step 3: Configure Windows Firewall

Open an **Administrative Command Prompt** or PowerShell in `C:\PepsiDepot\app` and run:

```cmd
deploy\windows\configure-firewall.bat
```

This rule:
- Opens inbound TCP Port `3000` for LAN computers (Cashier PCs & Tablets).
- Explicitly blocks incoming Port `5432` from all external LAN connections to keep PostgreSQL fully isolated on loopback.

---

## Step 4: Register & Start Windows Services (NSSM)

Open an **Administrative Command Prompt** or PowerShell in `C:\PepsiDepot\app` and run:

```cmd
deploy\windows\install-services.bat
```

This script registers two independent Windows services:
1. **`Pepsi Depot Web`**: Next.js HTTP application server (Port 3000).
2. **`Pepsi Depot Sync`**: Standalone background cloud synchronization daemon.

Both services are configured with `Automatic` startup and depend on PostgreSQL.

### Manage Services via Scripts:
```cmd
deploy\windows\start-services.bat      # Start both services
deploy\windows\stop-services.bat       # Stop both services
deploy\windows\restart-services.bat    # Restart both services
deploy\windows\status-services.bat     # View service status & logs
```

---

## Step 5: Verify Health & LAN Access

### 1. Local Health Check
From the depot server PowerShell:
```powershell
Invoke-RestMethod http://localhost:3000/health
```
Verify:
- `status`: `"healthy"`
- `database.status`: `"connected"`
- `sync.scheduler.inProcess`: `true`

### 2. Cashier Workstation Check
From another computer or tablet on the same LAN:
```text
http://<DEPOT_SERVER_IP>:3000
```
Log in using cashier credentials and confirm the point-of-sale interface loads.
