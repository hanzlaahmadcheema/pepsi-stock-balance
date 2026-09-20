# Pepsi Stock & Sales — Development Environment Guide

This document describes the environment selection workflow for the Pepsi Stock & Sales application on Linux workstations.

---

## 1. Environment Architecture & Targets

| Environment | Identifier | Primary Database Target | Supabase Auth / Project Ref | Intended Use |
| :--- | :--- | :--- | :--- | :--- |
| **Local** | `LOCAL` | `localhost:5433/pepsi_local` (PostgreSQL 16) | Dev Supabase Auth (`obtoonfhcwwhanvqtkio`) or Local Mock | Daily feature development, offline testing, isolated debugging |
| **Cloud Dev** | `CLOUD_DEV` | Supabase Pooler (`obtoonfhcwwhanvqtkio:6543`) | Dev / UAT Project (`obtoonfhcwwhanvqtkio`) | Cloud staging, integration verification, multi-device UAT |
| **Cloud Prod** | `CLOUD_PROD` | Supabase Pooler (`arntflxuoalstwdryykh:6543`) | Live Production (`arntflxuoalstwdryykh`) | Production deployment & monitored runtime diagnostics |

---

## 2. Environment Selection Commands

The project provides an explicit command-line switcher that manages the active `.env` configuration safely.

### Switch to Local
```bash
npm run env:local
```
- Activates `LOCAL` environment.
- Configures `DATABASE_URL` and `DIRECT_URL` to local PostgreSQL (`localhost:5433/pepsi_local`).
- Guarantees zero network calls to cloud databases for data storage.
- Automatically cleans up any lingering root `.env.local` that could override `.env`.

### Switch to Cloud Dev
```bash
npm run env:dev
```
- Activates `CLOUD_DEV` environment.
- Configures connection to DEV/UAT Supabase project (`obtoonfhcwwhanvqtkio`).
- Strictly prohibited from resolving to Production.

### Switch to Cloud Prod (Guarded)
```bash
npm run env:prod -- --confirm
```
- **Safety Guard:** Running `npm run env:prod` without `--confirm` will be **rejected**.
- Activates `CLOUD_PROD` environment targeting production project `arntflxuoalstwdryykh`.
- Displays prominent terminal warnings indicating that all subsequent operations affect live infrastructure.

---

## 3. Checking Active Environment Status

To inspect the currently active environment and verify database targets without executing mutations:

```bash
npm run env:status
```

Example output:
```text
================================================================================
             PEPSI STOCK & SALES — ACTIVE ENVIRONMENT STATUS
================================================================================
Environment:           LOCAL (LOCAL WORKSTATION DEVELOPMENT)
Database (Masked):     postgresql://postgres:********@localhost:5433/pepsi_local?schema=public
Direct URL (Masked):   postgresql://postgres:********@localhost:5433/pepsi_local?schema=public
Supabase URL:          https://obtoonfhcwwhanvqtkio.supabase.co
Supabase Project Ref:  obtoonfhcwwhanvqtkio
Cloud Sync Base URL:   http://localhost:3000
Sync Device ID:        local-dev-device
--------------------------------------------------------------------------------
Safety Audits:
✅ Local Database Isolation: Target verified as local host.
--------------------------------------------------------------------------------
Testing Database Connectivity (read-only)... ✅ Connected successfully (read-only ping OK)
================================================================================
```

*Note: All passwords, bearer tokens, and service role keys are masked (`********`). Secrets are never logged or exposed.*

---

## 4. Production Safety Rules & Guardrails

To prevent accidental production data modification, schema drift, or database resets, the following guards are enforced:

1. **Prisma Command Interception (`scripts/prisma-guard.ts`):**
   - Destructive commands (`prisma migrate dev`, `prisma db push`, `prisma db reset`) are **HARD-BLOCKED** when `CLOUD_PROD` is active.
   - Schema deployments (`prisma migrate deploy`) against Production require explicit confirmation:
     ```bash
     npm run prisma:deploy -- --confirm
     ```
2. **Strict Environment Cross-Contamination Checks:**
   - Switching to `LOCAL` validates that `DATABASE_URL` does NOT match production ref `arntflxuoalstwdryykh`.
   - Switching to `CLOUD_DEV` validates that `DATABASE_URL` points to `obtoonfhcwwhanvqtkio` and NOT `arntflxuoalstwdryykh`.
   - Switching to `CLOUD_PROD` validates that `DATABASE_URL` points to `arntflxuoalstwdryykh` and NOT `obtoonfhcwwhanvqtkio`.
3. **No Production Data in Dev/Local:**
   - Production database dumps or live data must never be imported into Local or Cloud Dev databases.

---

## 5. Secrets Management & Git Tracking

### Tracked Templates (Safe to Commit)
These files use placeholders (`REPLACE_WITH_*` or `YOUR_*`) and contain zero secrets:
- `.env.example`
- `.env.local.example`
- `.env.cloud-dev.example`
- `.env.cloud-prod.example`
- `deploy/windows/.env.depot.example`

### Untracked Private Files (NEVER COMMIT)
These files contain real passwords/tokens and are strictly ignored by `.gitignore`:
- `.env` (The currently active configuration)
- `environments/.env.local` (Local credentials)
- `environments/.env.cloud-dev` (Dev/UAT credentials)
- `environments/.env.cloud-prod` (Production credentials)
- Any `.env*.local` or `.env.production`

If you create or edit secrets in `environments/`, verify with `git status` before committing.
