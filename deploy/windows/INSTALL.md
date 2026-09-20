# Pepsi Depot Server — Automated Windows Installation Guide

This guide provides complete instructions for provisioning a fresh **Windows 10 Pro 64-bit** or **Windows 11 64-bit** machine as a Pepsi Distribution Depot Server using the automated PowerShell installation suite.

---

## 1. What the Installer Installs & Configures

The automated installation suite prepares the physical server with all necessary toolchains, databases, application code, and build artifacts:

| Component | Target Version | Installation Method | Purpose |
| :--- | :--- | :--- | :--- |
| **Chocolatey** | Latest (v2.x) | Official TLS 1.2 script | Windows package manager |
| **Git** | Latest (v2.x) | Chocolatey (`git`) | Version control & source deployment |
| **Node.js LTS** | v20+ / v22+ / v24+ | Chocolatey (`nodejs`) | Next.js and daemon runtime engine |
| **PostgreSQL 18** | v18.x (or existing v16/18) | Chocolatey (`postgresql18`) | Local depot operational database |
| **PostgreSQL Service** | `postgresql-x64-18` (or detected) | Windows Service Manager | Configured for Automatic system startup |
| **pepsi_admin Role** | PostgreSQL Role | Idempotent SQL | Application database user with login rights |
| **pepsi_depot DB** | PostgreSQL Database | Idempotent SQL | Operational database owned by `pepsi_admin` |
| **Application Tree** | `C:\PepsiDepot\app` | Filesystem Layout | Next.js web service, sync daemon, logs, backups |
| **Node Dependencies**| Production lockfile | `npm ci` | Installs all required packages |
| **Build Artifacts** | `.next` & `dist/daemon` | `npm run build` | Next.js production build and compiled daemon bundle |
| **Prisma Client** | Validated Schema | `npx prisma validate` | Type-safe database access layer |

---

## 2. Administrator Requirement

All installer scripts modify system-level components (PATH environment variables, Windows Services, `ProgramData`, and `Program Files`). Therefore, **elevated Administrator privileges are strictly required**.

If run from a non-administrative shell, each script halts immediately with an explicit error.

---

## 3. How to Run the Complete Installer

Open an **Administrative PowerShell** window (Right-click Start → *Windows PowerShell (Admin)* or *Terminal (Admin)*) and run:

```powershell
# Set execution policy for the current PowerShell process only (does NOT alter permanent system security)
Set-ExecutionPolicy -Scope Process Bypass

# Run the master installer from the repository root
.\deploy\windows\install\install-all.ps1
```

*(If you are running the script from a cloned repository located at a different path, specify the target directory via `-AppDir "C:\PepsiDepot\app"`).*

---

## 4. How to Run Individual Installation Phases

The installer is modular. You can execute individual phases independently for step-by-step verification or troubleshooting:

### Phase 1: Chocolatey Package Manager
```powershell
.\deploy\windows\install\01-install-chocolatey.ps1
```
*Detects existing `choco.exe`. If missing, installs Chocolatey over TLS 1.2 and updates session PATH.*

### Phase 2: Runtime Dependencies (Git & Node.js)
```powershell
.\deploy\windows\install\02-install-dependencies.ps1
```
*Checks if `git.exe`, `node.exe`, and `npm.cmd` exist. Installs missing packages via Chocolatey and refreshes PATH.*

### Phase 3: PostgreSQL 18 Engine & Service
```powershell
.\deploy\windows\install\03-install-postgresql.ps1
```
*Detects registered PostgreSQL Windows services. If missing, installs PostgreSQL 18 via Chocolatey, sets service startup to Automatic, starts the service, and verifies loopback connectivity on port 5432.*

### Phase 4: Local Database & Role Configuration
```powershell
.\deploy\windows\install\04-configure-postgresql.ps1
```
*Idempotently creates role `pepsi_admin` and database `pepsi_depot`. Prompts interactively for a secure password if role creation is required.*

### Phase 5: Application Deployment & Production Build
```powershell
.\deploy\windows\install\05-setup-application.ps1 -AppDir "C:\PepsiDepot\app"
```
*Creates `C:\PepsiDepot\{app, logs, backups}`, deploys code, copies `.env.production` template, runs `npm ci`, compiles Next.js production build, and compiles the standalone sync daemon artifact.*

### Phase 6: Read-Only Validation Audit
```powershell
.\deploy\windows\install\06-validate-installation.ps1 -AppDir "C:\PepsiDepot\app"
```
*Performs a strictly read-only audit across 15 validation checkpoints and prints an `[OK]` / `[FAIL]` status table.*

---

## 5. What PostgreSQL Database & User Are Created

- **Role Name:** `pepsi_admin`
  - Privileges: `LOGIN`, `CREATEDB`
  - Scope: Restricted to local connections (`127.0.0.1`)
- **Database Name:** `pepsi_depot`
  - Encoding: `UTF8`
  - Owner: `pepsi_admin`
  - Schema: `public` with full rights granted to `pepsi_admin`

---

## 6. How Passwords & Secrets Are Handled

Security is enforced at every layer:

1. **No Hardcoded Passwords:** Neither superuser (`postgres`) nor application user (`pepsi_admin`) passwords are hardcoded in any script.
2. **Interactive Secure Input:** If `pepsi_admin` needs to be created, PowerShell prompts the operator using `Read-Host -AsSecureString` with masked typing and confirmation.
3. **No Password Logging:** Scripts avoid logging connection strings or passwords to console output or log files.
4. **Session Cleanup:** Environment variables like `PGPASSWORD` used during temporary psql checks are removed from process memory immediately upon completion.
5. **Git Ignored:** `.env.production` is strictly git-ignored and never committed.

---

## 7. What the Installer Does NOT Configure

To maintain clear operational boundaries and prevent premature or accidental execution:

- **Does NOT configure production cloud credentials:** Real production secrets, device tokens, and Supabase keys must be populated manually by the authorized administrator.
- **Does NOT connect to Cloud Production:** The installer does not invoke cloud sync APIs or fetch cloud data.
- **Does NOT create business or test transactions:** Inventory, sales, customers, and financial ledgers remain completely untouched.
- **Does NOT run production database migrations:** Database schema creation is performed during post-installation configuration.
- **Does NOT install NSSM Windows services:** NSSM service registration is intentionally separated into the configuration phase.

---

## 8. Why NSSM Installation Is Intentionally Separate

Windows services should only be registered **after** the operator has:
1. Configured `.env.production` with valid local database passwords and device tokens.
2. Executed `npx prisma migrate deploy` to create the schema tables.
3. Verified the Windows Firewall settings.

Installing services prematurely would cause the background services to start against an unmigrated database or fail repeatedly with invalid credentials, creating log noise and service recovery flapping.

---

## 9. Next Steps: Post-Installation Configuration

Once `install-all.ps1` finishes successfully:

1. Follow [`deploy/windows/configure/README.md`](file:///home/hanzlaahmad/Projects/pepsi-stock-balance/deploy/windows/configure/README.md).
2. Configure `.env.production` at `C:\PepsiDepot\app\.env.production`.
3. Run local database migrations:
   ```powershell
   cd C:\PepsiDepot\app
   npx prisma migrate deploy
   ```
4. Open the Windows Firewall:
   ```cmd
   deploy\windows\configure-firewall.bat
   ```
5. Register and start NSSM services:
   ```cmd
   deploy\windows\install-services.bat
   ```
6. Verify service health via `http://localhost:3000/health`.
