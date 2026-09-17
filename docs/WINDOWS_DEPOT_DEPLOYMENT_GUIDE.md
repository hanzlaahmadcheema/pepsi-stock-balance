# Windows Depot Server Deployment & NSSM Operations Guide
**Pepsi Stock Balance & Delivery Ledger**
**Document Version:** 1.0 (Phase 5 Step 4 Production Release)

---

## 1. Architectural Overview & Process Model

The Pepsi Stock Balance system operates as a hybrid cloud-local platform designed for high availability and offline operational resilience at the physical distribution depot:

```text
┌─────────────────────────────────────────────────────────────┐
│                       DEPOT LOCAL AREA NETWORK               │
│                                                             │
│   [Cashier PC 1]          [Cashier PC 2]      [Tablet/POS]   │
│         │                        │                 │        │
│         └────────────────────────┼─────────────────┘        │
│                                  │ HTTP Port 3000           │
│                                  ▼                          │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              WINDOWS DEPOT SERVER                   │   │
│   │                                                     │   │
│   │   [Service: Pepsi Depot Web]                        │   │
│   │   - Next.js Production Runtime                      │   │
│   │   - Serves POS, Customer Ledger, Inventory UI       │   │
│   │                                                     │   │
│   │   [Service: Pepsi Depot Sync]                       │   │
│   │   - Background synchronization daemon               │   │
│   │   - Independent single-flight pull & push loop      │   │
│   │   - Advisory lock-protected execution               │   │
│   │                                                     │   │
│   │   [Local PostgreSQL 15/16]                          │   │
│   │   - Listening strictly on 127.0.0.1:5432            │   │
│   │   - Single source of truth for depot operations     │   │
│   └──────────────────────────┬──────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────┘
                               │ HTTPS Outbound (Port 443)
                               ▼
        ┌──────────────────────────────────────────────┐
        │               CLOUD ENVIRONMENT              │
        │                                              │
        │   Vercel Production / Supabase PostgreSQL    │
        │   - Master catalog authority                 │
        │   - Centralized reconciliation & reports     │
        └──────────────────────────────────────────────┘
```

### Why Two Separate Windows Services?
We deploy two distinct Windows services managed via **NSSM (Non-Sucking Service Manager)**:
1. **`Pepsi Depot Web`**: Next.js HTTP server.
2. **`Pepsi Depot Sync`**: Continuous cloud sync daemon.

**Key Rationale:**
- **Fault Isolation:** If network disruption causes the sync daemon to back off or an external connection times out, the local point-of-sale interface used by cashiers remains completely unaffected. Cashiers continue recording sales and payments offline without latency or disruption.
- **Independent Maintenance:** A network administrator can restart the sync daemon after repairing an internet connection without killing active cashier checkout sessions. Conversely, deploying a UI hotfix does not abort in-flight database advisory locks or active sync transactions.
- **Log Segregation:** Web server logs (`web.log`) and background sync protocol telemetry (`sync.log`) are stored in separate files with independent size-based rotation.

---

## 2. Environment Strategy & Separation

To prevent catastrophic configuration mistakes (such as pointing a live depot at a testing database), all environments are strictly isolated:

| Parameter | DEV Workstation | DEPOT PRODUCTION (Windows Server) | CLOUD PRODUCTION |
| :--- | :--- | :--- | :--- |
| **Purpose** | Developer coding & unit tests | Physical depot server runtime | Centralized cloud management |
| **Operating System** | Linux / macOS / Windows | Windows Server 2019/2022 or Win 10/11 Pro | Linux / Vercel Serverless |
| **Database** | Local dev Postgres / Dev Supabase | **Local PostgreSQL (`127.0.0.1:5432`)** | Cloud Supabase Managed Postgres |
| **Sync Endpoint** | `http://localhost:3000` | **`https://pepsi-stock-balance.vercel.app`** | N/A (Server-side) |
| **`NODE_ENV`** | `development` / `test` | **`production`** | `production` |
| **Credentials** | Development test keys | **Dedicated Depot Device Token & Local DB PW** | Cloud Production Secrets |

> [!CAUTION]
> **Zero Secrets in Source Control:**
> Never commit `.env.production` or plaintext passwords to Git. The `.env.depot.example` template provided in `deploy/windows/` must be copied to `.env.production` on the Windows server and populated with production credentials locally.

---

## 3. Step-by-Step Installation Procedure

### Section A: System Prerequisites
- **Hardware:** 64-bit CPU (4+ cores recommended), 8 GB RAM minimum, 50 GB SSD free space.
- **Operating System:** Windows Server 2019/2022 or Windows 10/11 Pro (64-bit).
- **Network:** Static LAN IP address assigned (e.g. `192.168.1.50`).
- **Privileges:** Local Administrator account required for installation.

### Section B: Node.js Installation
1. Download the official **Node.js LTS** (v20.x or v22.x 64-bit MSI) from [https://nodejs.org](https://nodejs.org).
2. Run the installer with default settings, ensuring **"Add to PATH"** is checked.
3. Open an administrative PowerShell prompt and verify:
   ```powershell
   node -v   # Must report v20.x or v22.x
   npm -v    # Must report v10.x+
   ```

### Section C: Local PostgreSQL Setup
1. Download **PostgreSQL 15 or 16 for Windows** from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/).
2. Run the installer:
   - Port: `5432`
   - Set a strong password for `postgres` (e.g., generate a 24-character random password).
3. Open `pgAdmin` or `psql` and create the dedicated database:
   ```sql
   CREATE DATABASE pepsi_depot;
   CREATE USER pepsi_admin WITH ENCRYPTED PASSWORD 'YourStrongPasswordHere';
   GRANT ALL PRIVILEGES ON DATABASE pepsi_depot TO pepsi_admin;
   ```
4. **Security Hardening (Local Binding):**
   Open `C:\Program Files\PostgreSQL\16\data\postgresql.conf` and confirm:
   ```text
   listen_addresses = '127.0.0.1, localhost'
   ```
   Open `C:\Program Files\PostgreSQL\16\data\pg_hba.conf` and verify that only `127.0.0.1/32` and `::1/128` have access:
   ```text
   host    all             all             127.0.0.1/32            scram-sha-256
   ```
   Restart the PostgreSQL Windows service (`postgresql-x64-16`).

### Section D: Directory Layout
Set up the official application folder structure on the `C:` drive:
```powershell
mkdir C:\PepsiDepot
mkdir C:\PepsiDepot\app
mkdir C:\PepsiDepot\logs
mkdir C:\PepsiDepot\backups
```

Clone or extract the application source into `C:\PepsiDepot\app`.

### Section E: Environment Configuration
1. In `C:\PepsiDepot\app`, copy the template:
   ```powershell
   copy deploy\windows\.env.depot.example .env.production
   ```
2. Edit `.env.production` using Notepad:
   ```env
   NODE_ENV=production
   PORT=3000
   HOSTNAME=0.0.0.0

   # Local database
   DATABASE_URL="postgresql://pepsi_admin:YourStrongPasswordHere@127.0.0.1:5432/pepsi_depot?schema=public"

   # Cloud synchronization
   CLOUD_SYNC_BASE_URL="https://pepsi-stock-balance.vercel.app"
   SYNC_DEVICE_ID="depot-main-01"
   SYNC_DEVICE_TOKEN="your-cryptographic-token-provisioned-in-cloud"

   # Supabase Auth
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGci..."
   SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."
   ```

### Section F: Database Migrations
Run the production database migrations to build the schema:
```powershell
cd C:\PepsiDepot\app
npx prisma migrate deploy
```
> [!IMPORTANT]
> Always use `prisma migrate deploy` on production depots. Never use `prisma migrate dev`, which risks dropping data or attempting interactive prompts.

### Section G: Production Build
Compile the optimized Next.js production build:
```powershell
cd C:\PepsiDepot\app
npm run build
```
Ensure the build outputs `✓ Compiled successfully`.

### Section H: NSSM Installation
1. Download **NSSM 2.24** (or latest) from [https://nssm.cc/download](https://nssm.cc/download).
2. Extract the zip file and copy `win64\nssm.exe` to:
   ```text
   C:\nssm\win64\nssm.exe
   ```
3. Add `C:\nssm\win64` to the Windows System `PATH` variable.

### Section I & J: Service Installation via Automation Script
Open an **Administrative Command Prompt** in `C:\PepsiDepot\app` and run:
```cmd
deploy\windows\install-services.bat
```
This automated script registers both services:
1. **`Pepsi Depot Web`**
   - Executable: `npm.cmd run serve:depot`
   - Working Directory: `C:\PepsiDepot\app`
   - Startup: Automatic (`SERVICE_AUTO_START`)
   - Logs: `C:\PepsiDepot\logs\web.log` (Rotated daily or at 10 MB)
2. **`Pepsi Depot Sync`**
   - Executable: `npm.cmd run sync:daemon`
   - Working Directory: `C:\PepsiDepot\app`
   - Startup: Automatic (`SERVICE_AUTO_START`)
   - Logs: `C:\PepsiDepot\logs\sync.log` (Rotated daily or at 10 MB)

### Section K: Windows Firewall Configuration
Run the automated firewall script as Administrator:
```cmd
deploy\windows\configure-firewall.bat
```
This rule:
- Opens inbound TCP port `3000` for LAN computers (`private` & `domain` profiles).
- Blocks incoming port `5432` from all external LAN connections to keep PostgreSQL fully isolated.

---

## 4. Service Management & Operations

The following control scripts are available in `C:\PepsiDepot\app\deploy\windows\`:

| Task | Script Command | Windows GUI Equivalent |
| :--- | :--- | :--- |
| **Start Services** | `deploy\windows\start-services.bat` | `services.msc` → Start |
| **Stop Services** | `deploy\windows\stop-services.bat` | `services.msc` → Stop |
| **Restart Services** | `deploy\windows\restart-services.bat` | `services.msc` → Restart |
| **Check Status & Health**| `deploy\windows\status-services.bat` | Health check endpoint |
| **Uninstall Services** | `deploy\windows\uninstall-services.bat` | `nssm remove ...` |

### Verifying Service Operation via CLI:
```powershell
nssm status "Pepsi Depot Web"    # Should return SERVICE_RUNNING
nssm status "Pepsi Depot Sync"   # Should return SERVICE_RUNNING
```

---

## 5. Health Check & Diagnostics

The application provides a comprehensive JSON health check endpoint:
```text
GET http://localhost:3000/health
```

### Healthy Response Example:
```json
{
  "status": "healthy",
  "timestamp": "2026-09-17T11:00:00.000Z",
  "application": {
    "name": "pepsi-stock-balance",
    "version": "1.0.0",
    "nodeEnv": "production",
    "uptimeSeconds": 1420
  },
  "database": {
    "status": "connected",
    "latencyMs": 3
  },
  "sync": {
    "currentCursor": "142",
    "lastSyncedAt": "2026-09-17T10:59:45.120Z",
    "activeQuarantineCount": 0,
    "pendingOutboxCount": 0,
    "scheduler": {
      "inProcess": false
    }
  }
}
```

### Diagnostic Statuses:
- **`healthy`**: Local PostgreSQL is connected, low latency, and 0 quarantined sync changes.
- **`degraded`**: Local PostgreSQL is connected, but `activeQuarantineCount > 0`. Sync stream is halted at cursor sequence. Owner review required at `http://[DEPOT-IP]:3000/sync/quarantine`.
- **`unhealthy`**: Local PostgreSQL connection failed (HTTP status 503).

---

## 6. Backup & Recovery Considerations

### Automated Daily Database Backup
Create a scheduled task running daily at 02:00 AM using `pg_dump`:
```powershell
# Script: C:\PepsiDepot\backups\daily-backup.bat
@echo off
set "TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "PGPASSWORD=YourStrongPasswordHere"

"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U pepsi_admin -h 127.0.0.1 -p 5432 -F c -b -v -f "C:\PepsiDepot\backups\pepsi_depot_%TIMESTAMP%.dump" pepsi_depot
```

### Full Disaster Recovery Sequence:
1. Re-install PostgreSQL 15/16 and recreate empty `pepsi_depot` database.
2. Restore database from latest `.dump` file:
   ```powershell
   pg_restore -U pepsi_admin -h 127.0.0.1 -d pepsi_depot -v "C:\PepsiDepot\backups\pepsi_depot_latest.dump"
   ```
3. Verify `SyncCursor` and `SyncOutbox`:
   - All unpushed outbox rows with `status = 'PENDING'` will be automatically pushed upon next sync cycle.
   - The sync cursor prevents re-pulling historical records that were already processed.
4. Restart services via `start-services.bat`.

---

## 7. Safe Upgrade Procedure

When a new software version is released, follow this strict upgrade sequence:

1. **Stop Services:**
   ```cmd
   deploy\windows\stop-services.bat
   ```
2. **Perform Manual Database Backup:**
   Run `daily-backup.bat` to create a pre-upgrade snapshot.
3. **Pull Code Updates:**
   ```powershell
   git pull origin main
   npm install --omit=dev
   ```
4. **Deploy Database Migrations:**
   ```powershell
   npx prisma migrate deploy
   ```
5. **Compile Production Build:**
   ```powershell
   npm run build
   ```
6. **Start Services:**
   ```cmd
   deploy\windows\start-services.bat
   ```
7. **Verify Health:**
   Run `deploy\windows\status-services.bat` and ensure `status: healthy`.

---

## 8. Rollback Procedure

If an upgrade fails:
1. Stop services: `deploy\windows\stop-services.bat`.
2. Check out previous commit: `git checkout <previous-commit-hash>`.
3. If database changes occurred, restore pre-upgrade dump via `pg_restore`.
4. Rebuild: `npm run build`.
5. Start services: `deploy\windows\start-services.bat`.
