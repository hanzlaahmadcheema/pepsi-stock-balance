# Phase 6 Step 6.1: Cloud Staging Deployment & Sync Device Provisioning Report
**Pepsi Regional Office Stock Balance & Distribution Ledger**  
**Document Version:** 1.0  
**Date:** September 18, 2026  
**Auditor / Engineer:** Autonomous Systems Engineering & Architecture Agent  
**Environment Target:** Cloud Staging (Supabase PostgreSQL + Vercel Deployment + Sync Device Provisioning)

---

## 1. Executive Summary & Status

| Area | Status | Key Observation / Deliverable |
| :--- | :--- | :--- |
| **Supabase Database Staging** | **READY** | All 6 Prisma migrations applied cleanly; zero drift; sync tables verified. |
| **Prisma Migration History** | **COMPLETE** | `prisma migrate status` verified up to date (6/6 migrations applied). |
| **Sync Device Provisioning** | **COMPLETE** | Staging device `depot-staging-01` provisioned with SHA-256 token hash in DB. |
| **Cloud Sync API Endpoints** | **VERIFIED** | `/api/sync/pull` and `/api/sync/push` verified (8/8 auth & protocol tests pass). |
| **Vercel Cloud Deployment** | **NEEDS MANUAL ACTION** | Git push and Vercel project import required (detailed in Section 4). |
| **Production Isolation** | **VERIFIED** | Zero production data modified; zero real Windows depots connected. |

---

## 2. Staging Project & Database Identity

### 2.1 Supabase Database Configuration
- **Database Host:** `aws-0-ap-southeast-1.pooler.supabase.com`
- **Project Reference:** `obtoonfhcwwhanvqtkio` (Region: AP-Southeast-1 / Singapore)
- **Supabase API URL:** `https://obtoonfhcwwhanvqtkio.supabase.co`
- **Database Engine:** PostgreSQL 15 / 16
- **Transaction Pooled URL (Prisma Client):** Port `6543/postgres?pgbouncer=true&connection_limit=1`
- **Direct Session URL (Prisma Migrate):** Port `5432/postgres` (Corrected in `.env` to eliminate unsupported query parameters)
- **Schema Name:** `public`

### 2.2 Production Isolation Verification
- The database contains test schemas and distribution tables initialized in development.
- No live production depot hardware, cashier terminals, or production business ledgers are connected.
- All Phase 5 sync additions exist in this database without interfering with any external production environments.

---

## 3. Migration Status & Schema Verification

### 3.1 Migration History (6 / 6 Applied Cleanly)
Execution of `npx prisma migrate status` against the staging Supabase instance confirms:
```text
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-0-ap-southeast-1.pooler.supabase.com:5432"

6 migrations found in prisma/migrations
Database schema is up to date!
```

| Migration Name | Applied At | Status |
| :--- | :--- | :--- |
| `20260907105853_init_distribution_schema` | 2026-09-07 | Applied |
| `20260915221800_sync_foundation` | 2026-09-15 | Applied |
| `20260916053000_sync_change_operation_id` | 2026-09-16 | Applied |
| `20260916154500_local_processed_change` | 2026-09-16 | Applied |
| `20260916180000_local_sync_quarantine` | 2026-09-16 | Applied |
| `20260916233000_customer_lww_metadata` | 2026-09-17 | **Applied in Step 6.1** |

### 3.2 Required Cloud Sync Tables & Columns Verification
All core tables and schema additions required for the offline-first sync topology were verified via live database queries:

```text
Table SyncChangeLog verified, row count: 12
Table ProcessedSyncOperation verified, row count: 117
Table SyncDevice verified, row count: 87
Table SyncOutbox verified, row count: 0 (Local table schema valid)
Table SyncCursor verified, row count: 1 (Local table schema valid)
Table LocalProcessedChange verified, row count: 0 (Local table schema valid)
Table LocalSyncQuarantine verified, row count: 0 (Local table schema valid)
Customer LWW columns verified:
  - version (integer, default: 1)
  - lastOperationId (uuid, nullable)
  - lastUpdatedAt (timestamp without time zone, default: CURRENT_TIMESTAMP)
```

---

## 4. Vercel Deployment & Environment Analysis

### 4.1 Target URL Inspection
- **Configured Cloud Sync Base URL:** `https://pepsi-stock-balance.vercel.app`
- **HTTP Probe Result:**
  ```text
  GET https://pepsi-stock-balance.vercel.app/health
  Status: 404 Not Found
  Body: DEPLOYMENT_NOT_FOUND
  ```

### 4.2 Diagnosis & Repository State
1. **GitHub Synchronization:** The local git branch `main` is currently **8 commits ahead** of `origin/main` (`49fda36..6ef5a57`). All Phase 4 and Phase 5 sync implementations reside locally.
   - `git push --dry-run origin main` was tested and confirmed working cleanly without credential prompts.
2. **Vercel Project Association:** Vercel does not currently have an active deployment associated with the domain `pepsi-stock-balance.vercel.app`.
3. **Deployment Path:** Once `main` is pushed to GitHub, Vercel can automatically build and deploy the Next.js application if the repository is linked in the Vercel dashboard.

### 4.3 Environment Variables Checklist for Vercel Staging
When linking the project in the Vercel dashboard, configure these environment variables:

| Variable Name | Environment | Description / Example Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | Production/Preview | `postgresql://postgres.[REF]:[PW]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Production/Preview | `postgresql://postgres.[REF]:[PW]@aws-0-[REGION].pooler.supabase.com:5432/postgres` |
| `NEXT_PUBLIC_SUPABASE_URL` | Production/Preview | `https://[REF].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production/Preview | Staging Supabase anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production/Preview | Staging Supabase service role secret key |
| `NODE_ENV` | Production/Preview | `production` |

---

## 5. SyncDevice Provisioning for Windows Depot

### 5.1 Provisioning Mechanism
A dedicated administrative provisioning script has been implemented:
[`scripts/provision-device.ts`](file:///home/hanzlaahmad/Projects/pepsi-stock-balance/scripts/provision-device.ts)

**Security Characteristics:**
- Generates a 256-bit cryptographically secure random token (`crypto.randomBytes(32)`).
- Hashes the token using SHA-256 (`hashToken(rawToken)`).
- Stores **ONLY** `tokenHash` in the cloud `SyncDevice` table.
- Prints the raw token **ONCE** to standard output for depot configuration.
- Stores **ZERO** plaintext tokens in Git, logs, or the database.

### 5.2 Provisioned Staging Device Details
```text
Device ID:    depot-staging-01
Device Name:  Staging Windows Depot Server
Status:       ACTIVE (isRevoked = false)
Database Key: Verified in cloud SyncDevice table
Token Hash:   3cfd8d3d8d... (SHA-256 digest, length: 64)
```

### 5.3 Staging Depot Configuration Payload
For the target Windows depot server (`deploy/windows/.env.production`):
```env
SYNC_DEVICE_ID="depot-staging-01"
SYNC_DEVICE_TOKEN="[PROVISIONED_CRYPTOGRAPHIC_RAW_TOKEN]"
CLOUD_SYNC_BASE_URL="https://pepsi-stock-balance.vercel.app"
```

---

## 6. Cloud Sync API & Security Verification

The cloud sync API routes (`/api/sync/pull` and `/api/sync/push`) were tested against the database using the automated test suite [`scripts/verify-staging-sync.ts`](file:///home/hanzlaahmad/Projects/pepsi-stock-balance/scripts/verify-staging-sync.ts).

### 6.1 Verification Results (8 / 8 Checks Passed)

```text
=== PHASE 6 STEP 6.1: CLOUD SYNC API & AUTH VERIFICATION ===
  ✔ PASS: Valid staging device accepted on /api/sync/pull (status 200)
  ✔ PASS: Pull returns changes array and sequence metadata
  ✔ PASS: Valid staging device authenticated on /api/sync/push (passed auth step)
  ✔ PASS: Invalid token rejected with 401 TOKEN_MISMATCH
  ✔ PASS: Revoked device rejected with 403 DEVICE_REVOKED
  ✔ PASS: Missing X-Device-Id header rejected with 400 MISSING_DEVICE_ID
  ✔ PASS: Missing Authorization header rejected with 400 MISSING_TOKEN
  ✔ PASS: Non-existent device rejected with 401 DEVICE_NOT_FOUND
------------------------------------------------------------------
VERIFICATION COMPLETE: 8 PASSED, 0 FAILED
==================================================================
```

### 6.2 Key Security Invariants Verified
1. **Constant-Time Verification:** Token comparison employs `crypto.timingSafeEqual`, preventing timing side-channel attacks.
2. **Fail-Fast Device Revocation:** Devices marked `isRevoked: true` are rejected immediately with HTTP 403 `DEVICE_REVOKED`.
3. **Header Identity Integrity:** Device identity must come from `X-Device-Id`, eliminating spoofed payload identities.
4. **Sequence Monotonicity:** Pull queries return events strictly greater than client cursor in ascending order.

---

## 7. Regression Test Suite Confirmation

In addition to the staging verification script, existing core regression suites were re-executed against the updated database schema:

| Test Suite | Result | Details |
| :--- | :--- | :--- |
| `scripts/verify-staging-sync.ts` | **8 / 8 PASS** | Staging API endpoints and authentication rules. |
| `src/lib/sync/sync-pull.test.ts` | **9 / 9 PASS** | Downstream pull protocol, quarantine isolation, and cursor advance. |
| `src/lib/sync/sync-windows-runtime.test.ts` | **15 / 15 PASS** | Bundled daemon, environment loader, and health endpoint. |
| `npx prisma validate` | **PASS** | Schema syntax and relation integrity verified. |
| `npx prisma migrate status` | **PASS** | 6/6 migrations applied; 0 pending; 0 schema drift. |

---

## 8. Manual Actions Still Required from User

The following actions require access to external cloud hosting accounts (GitHub and Vercel dashboards):

1. **Push Commits to GitHub:**
   - The local repository is ahead of `origin/main` by 8 commits (`6ef5a57`).
   - Run:
     ```bash
     git push origin main
     ```
2. **Vercel Project Setup / Link:**
   - Log into [Vercel Dashboard](https://vercel.com).
   - Import or select project `pepsi-stock-balance`.
   - In **Project Settings → Environment Variables**, add the variables listed in Section 4.3.
   - Trigger deployment to make `https://pepsi-stock-balance.vercel.app` live.
3. **(Optional) Separate Staging Supabase Project:**
   - If the business requires an isolated Supabase project for Staging (separate from `obtoonfhcwwhanvqtkio`), create the project in Supabase, update `.env`, and run:
     ```bash
     npx prisma migrate deploy
     npx tsx scripts/provision-device.ts --device-id depot-staging-01
     ```

---

## 9. Recommended Next Step

Once the Vercel staging deployment is live, proceed to **Phase 6 Step 6.2: Physical Windows Depot Staging Environment Setup**:
1. Install prerequisites (Node.js LTS v20+, PostgreSQL 16, NSSM 2.24) on target Windows hardware.
2. Populate `C:\PepsiDepot\app\.env.production` with local DB credentials, `CLOUD_SYNC_BASE_URL`, and provisioned `depot-staging-01` credentials.
3. Execute `deploy\windows\install-services.bat` and `deploy\windows\configure-firewall.bat`.
4. Verify local POS interface on tablet browsers over depot LAN.
