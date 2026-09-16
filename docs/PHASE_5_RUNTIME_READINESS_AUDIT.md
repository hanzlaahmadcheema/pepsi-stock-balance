# Phase 5 Pre-Implementation Architecture & Runtime Readiness Audit

> **Status:** AUDIT COMPLETE — ANALYSIS ONLY  
> **Commit Reference:** `449ced86b90260771b05bdbfcd4106b0b25e335b` (`449ced8`)  
> **Branch:** `main`  
> **Date:** September 16, 2026  
> **Target:** Local Depot Server (Windows Server / Desktop) ↔ Cloud (Vercel + Supabase PostgreSQL)  

---

## 1. Executive Summary

This pre-implementation architecture and runtime readiness audit evaluates the current state of the Pepsi Stock & Sales synchronization system before writing any Phase 5 code. Phases 1 through 4 are **Closed and Approved**, having established:
- **Phase 1:** Core schema, contracts, and idempotency foundation (`SyncOutbox`, `SyncCursor`, `ProcessedSyncOperation`, `SyncChangeLog`, `SyncDevice`).
- **Phase 2:** Cloud push batch processing and local push client services with stop-on-first-error semantics and sequence continuity.
- **Phase 3:** Full business domain push handlers across Sales, Receiving, Payments, Returns, Damage, and Master Data, hardened against actor identity fallback and sequence ambiguity.
- **Phase 4:** Cloud → Local incremental pull synchronization with deterministic block and quarantine semantics (`LocalProcessedChange`, `LocalSyncQuarantine`), preventing head-of-line blocking and infinite retry loops.

Phase 5 encompasses three deferred implementation streams:
1. **Background Sync Daemon** (Automated push/pull scheduling, single-flight locking, crash recovery, and health monitoring on the local Windows depot server).
2. **Quarantine / Conflict UI** (Management interface for inspecting, retrying, and discarding quarantined changes).
3. **Customer Authority Decision** (Resolving master catalog vs. offline credit customer ownership).

### Primary Audit Findings
1. **Core Synchronization Mechanics are Production-Ready:** Push and pull algorithms, sequence validation, interactive transactions, replay idempotency, and deterministic quarantine containment are robust, fully tested, and sound.
2. **Critical Daemon Blockers Identified:**
   - **Network Failure Retry Exhaustion:** In `src/lib/sync/client/push.ts` (lines 288–300), transient network disconnections consume retry counts up to `MAX_RETRY_COUNT = 10`. A 60-second network outage during automated polling would permanently mark pending outbox operations as `FAILED`, halting the entire push queue.
   - **Lack of Mutex / Single-Flight Protection:** Neither `push.ts` nor `pull.ts` possesses process-level or database-level mutual exclusion. Concurrent executions (e.g., overlapping timer ticks or competing worker processes) will produce race conditions and spurious sequence errors.
   - **Platform-Specific Watchdog Incompatibility:** The current watchdog script (`run-server.sh`) relies entirely on Linux-specific bash utilities (`fuser`, `setsid`, `nohup`) and cannot supervise the application or daemon on native Windows Server.
3. **Customer Authority Pipeline Block:** The customer authority decision remains unresolved. Currently, any cloud customer update pulled by a depot halts the pull pipeline with code `CUSTOMER_AUTHORITY_DECISION_REQUIRED`, requiring manual intervention.

---

## 2. Current Architecture Observed

```
┌─────────────────────────────────────────────────────────┐
│                    CLOUD ENVIRONMENT                    │
│             (Vercel + Supabase PostgreSQL)              │
│                                                         │
│  - POST /api/sync/push (Batch Push Endpoint)            │
│  - POST /api/sync/pull (Incremental Pull Endpoint)      │
│  - Authority: Products, Prices, Suppliers, Users        │
│  - Journal: SyncChangeLog (Global Sequence Order)       │
│  - Registry: SyncDevice (Device Identity & Hash)        │
└────────────────────────────┬────────────────────────────┘
                             ▲
                             │ Outbound HTTPS (Bearer Token)
                             ▼
┌─────────────────────────────────────────────────────────┐
│               LOCAL WINDOWS DEPOT SERVER                │
│                 (Depot Head Office LAN)                 │
│                                                         │
│  - Local Next.js ERP Server (Port 3000)                 │
│  - Local PostgreSQL Service (Port 5432)                 │
│  - Local Outbox: SyncOutbox (Strict Client Sequence)    │
│  - High-Water Mark: SyncCursor (id="cloud_cursor")      │
│  - Replay Store: LocalProcessedChange                   │
│  - Quarantine: LocalSyncQuarantine                      │
│  - Authority: Sales, Payments, Receiving, Stock,        │
│               Containers, Returns, Damage Records       │
└────────────────────────────┬────────────────────────────┘
                             ▲
                             │ Local LAN (HTTP / WebSocket)
                             ▼
            ┌─────────────────────────────────┐
            │      Cashier PCs & Tablets      │
            └─────────────────────────────────┘
```

### Authority Partition Rules
| Domain Entity | Authoritative Location | Conflict / Overwrite Rule |
| :--- | :--- | :--- |
| **Product & Catalog** | **Cloud** | Depot accepts updates via Pull; cannot modify catalog offline. |
| **Price Schedules** | **Cloud** | Depot accepts active prices via Pull; cannot change prices. |
| **Suppliers** | **Cloud** | Cloud-authoritative; master supplier registry. |
| **User & Roles** | **Cloud** | Cloud manages credentials and role promotions (`OWNER`). |
| **Sales & Invoices** | **Local Depot** | Depot creates, edits, and cancels. Cloud Owner CANNOT cancel/edit depot invoices while disconnected. |
| **Payments** | **Local Depot** | Cash and local ledger collections are authoritative at the depot. |
| **Stock Ledger** | **Local Depot** | Physical stock movements, counts, and adjustments originate locally. |
| **Receiving Intake** | **Local Depot** | Physical delivery intake and crate checks originate locally. |
| **Containers / Returns** | **Local Depot** | Empty crate balances, return intakes, and inspections are depot-managed. |
| **Customer Master** | **UNRESOLVED** | Ambiguous; held in quarantine if mutated on Cloud. |

---

## 3. Sync Implementation Readiness (Phases 1–4 Review)

### Schema & Entity Verification (`prisma/schema.prisma`)
- **`SyncOutbox`** (`prisma/schema.prisma` lines 561–577):
  - Invariants: Unique `operationId` (UUID), contiguous `clientSequence` (`BigInt` autoincrement), status enum (`PENDING`, `IN_FLIGHT`, `SYNCED`, `FAILED`).
  - Read/Write Paths: Indexed by `[status, clientSequence]` and `[operationId]`.
  - Behavior: Safely sequences outbox queue; strictly blocks subsequent sequences if any operation is `FAILED`.
- **`SyncCursor`** (`prisma/schema.prisma` lines 579–583):
  - Invariants: High-water mark cursor row (`id = "cloud_cursor"`), tracks `lastSequence` (`BigInt`).
  - Behavior: Advances only upon successful local commit of cloud change batches.
- **`ProcessedSyncOperation`** (`prisma/schema.prisma` lines 585–599):
  - Invariants: Unique constraint on `[deviceId, clientSequence]`, unique `operationId`.
  - Behavior: Provides strict replay protection on Cloud.
- **`SyncChangeLog`** (`prisma/schema.prisma` lines 601–616):
  - Invariants: Autoincrementing `changeSequence` (`BigInt` PK), immutable `operationId` (`UUID`), `sourceDeviceId`, `action`, and `payload`.
  - Behavior: Authoritative global feed for incremental pull.
- **`SyncDevice`** (`prisma/schema.prisma` lines 618–628):
  - Invariants: `deviceId` PK, `tokenHash` (SHA-256 hex), `isRevoked` flag, `lastSeenAt`.
  - Behavior: Authenticates client devices independently of user sessions.
- **`LocalProcessedChange`** (`prisma/schema.prisma` lines 630–641):
  - Invariants: Unique `operationId`, unique `changeSequence`.
  - Behavior: Prevents duplicate execution on pull replay and handles self-originated change reconciliation.
- **`LocalSyncQuarantine`** (`prisma/schema.prisma` lines 648–670):
  - Invariants: Unique `changeSequence`, unique `operationId`, status (`QUARANTINED`, `RESOLVED`), resolution audit tracking.
  - Behavior: Captures deterministic pull failures, preventing rollback thrashing.

### Service Layer Verification
- **Push Engine** (`src/lib/sync/client/push.ts`):
  - `pushPendingOperations()`: Loads batch up to first `FAILED` operation; marks `IN_FLIGHT`; sends HTTP POST to Cloud; processes ACK/rejections; resets transient failures.
  - `recoverOrphanedInFlightOps()`: Resets `IN_FLIGHT` rows older than 5 minutes to `PENDING`.
  - `retryFailedOperation()`: Resets `FAILED` operations back to `PENDING` preserving sequence and UUID.
- **Pull Engine** (`src/lib/sync/client/pull.ts`):
  - `applyLocalPullBatch()`: Validates sequence continuity and detects gaps; detects self-originated changes (`isSelfOriginated`); enforces authority partition; quarantines deterministic errors while committing previous valid sequences; updates `SyncCursor` only up to last valid sequence.
  - `resolveQuarantineChange()`: Evaluates `RETRY` (with optional `overridePayload`) or `DISCARD`, updating `LocalProcessedChange` and advancing `SyncCursor`.
- **Architectural Invariants to Preserve**:
  - No sequence skipping in either direction.
  - Interactive transaction atomicity for all database updates.
  - Explicit actor attribution (`resolveRequiredActorUser`) with zero fallback to arbitrary users.

---

## 4. Background Daemon Readiness

| Audit Aspect | Current Repository State | Code Reference | Evaluation & Consequence |
| :--- | :--- | :--- | :--- |
| **Independent Callability** | Functions accept plain strings/URLs, with no Next.js HTTP context dependency. | `src/lib/sync/client/push.ts#L121`<br>`src/lib/sync/client/pull.ts#L919` | **READY**. Both `pushPendingOperations` and `executePullCycle` can be called from any Node.js loop or worker. |
| **Repeated Execution** | Services can be called in a loop, but rely on caller to manage intervals. | `src/lib/sync/client/push.ts` | **PARTIAL**. No interval loop, scheduler, or self-triggering worker exists in the repository. |
| **Overlap / Concurrency** | **No single-flight lock or mutex exists.** | `src/lib/sync/client/push.ts#L146`<br>`src/lib/sync/client/pull.ts#L170` | **BLOCKER**. Overlapping timer ticks will launch concurrent pushes or pulls, causing sequence collisions and database lock contention. |
| **Push Sequence Corruption** | Query `findMany` followed by `updateMany` has a race window. | `src/lib/sync/client/push.ts#L146-L180` | **BLOCKER**. Two concurrent push invocations could select identical rows, scramble batches, and trigger `SEQUENCE_GAP` or `SEQUENCE_REUSE_FORBIDDEN` rejections from Cloud. |
| **Pull Cursor Collision** | Pull reads cursor and executes transaction without global lock. | `src/lib/sync/client/pull.ts#L173-L186` | Two concurrent pull invocations will receive identical batches, causing duplicate insert errors or deadlocks in `LocalProcessedChange`. |
| **Concurrent Push & Pull** | Push and pull touch `SyncOutbox` and `Product` tables concurrently. | `src/lib/sync/client/pull.ts#L249`<br>`src/lib/sync/server/handlers/sales.ts#L133` | Simultaneous pull product updates and push sales locks can cause PostgreSQL deadlock or serialization failures. Sequential execution (Push then Pull) is necessary. |
| **Process Crash During Push** | Rows remain `IN_FLIGHT`. Timeout recovery exists but uses `createdAt`. | `src/lib/sync/client/push.ts#L82-L94` | `recoverOrphanedInFlightOps` checks `createdAt < cutoff` rather than `updatedAt`. Newly created records in-flight will be stuck for 5 minutes before recovery. |
| **Process Crash During Pull** | Executed inside Prisma interactive transaction. | `src/lib/sync/client/pull.ts#L170-L443` | **SAFE**. PostgreSQL rolls back uncommitted batch; `SyncCursor` remains at last committed sequence. Clean crash recovery. |
| **PostgreSQL Disconnect** | Throws raw Prisma/Node exception (`P1001`, `ECONNREFUSED`). | `src/lib/sync/client/push.ts#L233` | If unhandled in worker loop, process terminates abruptly. Daemon requires connection recovery loop. |
| **Offline / Network Outage** | Network catch block increments `retryCount` towards `MAX_RETRY_COUNT = 10`. | `src/lib/sync/client/push.ts#L236-L242`<br>`src/lib/sync/client/push.ts#L290-L298` | **CRITICAL BLOCKER**. When offline, 10 consecutive poll attempts will mark all outbox records as `FAILED` (permanent quarantine), halting the queue until manual manager reset. |
| **Retry / Backoff State** | No exponential backoff, jitter, or offline sleep exists in the code. | `src/lib/sync/client/push.ts` | **REQUIRED IMPLEMENTATION**. Daemon must implement backoff (e.g., 5s → 10s → 30s → 60s → 300s max) and circuit-breaking when offline. |
| **Daemon Health / State** | No local daemon heartbeat, lock table, or status tracking exists. | Whole codebase | **REQUIRED IMPLEMENTATION**. A local tracking mechanism (in-memory or DB table) is needed for "Last sync at", "Sync status", and "Is syncing". |

---

## 5. Windows Depot Server Runtime

### Deployment Architecture Options
The local depot server runs on Windows Server or Windows 10/11 Pro at the regional distribution office. The following supervision models are evaluated:

| Model | Description | Pros | Cons / Risks |
| :--- | :--- | :--- | :--- |
| **Option A: Embedded Next.js Worker** | Sync loop runs inside Next.js via `instrumentation.ts` or `setInterval`. | Single command to run; no external process manager. | **UNVIABLE**. Next.js in production can run multiple cluster workers, spawning multiple competing sync loops. Web server crashes kill the daemon. Hot-reloading in dev causes duplicate loops. |
| **Option B: Standalone Node Daemon supervised by PM2** | Standalone Node.js CLI process (`tsx src/daemon/index.ts`) managed by PM2 on Windows. | Independent process lifecycle; Next.js web traffic does not block sync; built-in restart and logging. | Requires PM2 installed globally on Windows; PM2 Windows service integration requires `pm2-windows-service` wrapper. |
| **Option C: Native Windows Service via NSSM** | Standalone Node script installed as a native Windows Service using NSSM (Non-Sucking Service Manager). | **RECOMMENDED FOR PRODUCTION**. Starts automatically on Windows boot before user login; native Windows Service Control Manager (`services.msc`) integration; automatic recovery on crash. | Requires administrator installation script (`.bat` or `.ps1`) and binary deployment. |
| **Option D: Windows Task Scheduler** | Scheduled task triggering sync every 1 minute. | Native Windows feature, no third-party tools. | Spawns a new Node.js process every minute, causing high CPU overhead, connection churn, and lack of persistent in-memory backoff. |

### Windows Runtime Audit
- **Startup after Reboot:** Next.js and PostgreSQL must start on boot without requiring a user to log into the Windows desktop. PostgreSQL does this natively as a Windows Service. The web app and sync daemon must be configured as Windows Services (via NSSM or PM2).
- **Bash Script Incompatibility:** `run-server.sh` is Linux-only. It uses `fuser -k 3000/tcp`, `setsid nohup`, and bash traps. Running `npm run serve:loop` on native Windows fails. A Windows-native PowerShell equivalent (`run-server.ps1` or Windows Service) is required.
- **LAN Access & Firewall:** Windows Defender Firewall blocks inbound traffic on port 3000 by default. An inbound firewall rule for TCP 3000 must be provisioned during setup to allow cashier tablets to access the depot server.
- **Static IP / Hostname:** Depot server must have a static local IP (e.g., `192.168.1.50`) or local DNS/mDNS resolution (`pepsi-depot.local`) so client devices maintain uninterrupted connectivity.
- **Outbound HTTPS:** The depot server requires outbound HTTPS (port 443) connectivity to `https://*.supabase.co` and `https://*.vercel.app`. No inbound ports from the Internet are required (NAT/firewall safe).

---

## 6. DEV / PROD Separation Audit

### Current Configuration Analysis
- **`.env.example`** (`.env.example` lines 4–8):
  ```ini
  DATABASE_URL="postgresql://postgres.[DEV_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
  DIRECT_URL="postgresql://postgres.[DEV_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
  ```
- **Active `.env` Configuration:**
  In the current development environment, `DATABASE_URL` points directly to the remote Supabase PostgreSQL database.
- **Identified Gaps & Risks:**
  1. **Direct Remote Connection Risk:** If a depot server is deployed using default documentation or an unedited `.env`, it will connect directly to the remote cloud database as its local database, bypassing local offline storage entirely!
  2. **Missing Local vs. Cloud Variables:** There are currently no standardized environment variables defining:
     - `LOCAL_DATABASE_URL` vs `REMOTE_DATABASE_URL`
     - `CLOUD_SYNC_URL` (Base URL for Cloud push/pull)
     - `SYNC_DEVICE_ID`
     - `SYNC_DEVICE_TOKEN`
     - `APP_ROLE` (`CLOUD` vs `DEPOT`)
  3. **No Application Role Guard:** The Next.js application codebase currently has no guard checking whether it is executing as a Cloud Server or a Local Depot Server. Consequently:
     - The Cloud endpoints (`/api/sync/push`, `/api/sync/pull`) are accessible on the local depot server.
     - The local sync client could theoretically attempt to push to `http://localhost:3000/api/sync/push`, creating circular synchronization loops.

---

## 7. Device Identity & Credential Audit

### SyncDevice Analysis (`src/lib/sync/server/authentication.ts`)
- **Identity Representation:** `SyncDevice.deviceId` (VarChar 64) represents the registered device. In requests, passed via header `X-Device-Id`.
- **Token Storage & Hashing:**
  - Cloud Database: Stores `tokenHash = SHA-256(rawToken)` (`authentication.ts` line 42). Tokens are verified using `crypto.timingSafeEqual` (line 56).
  - Local Depot Server: The raw token MUST be stored locally on the depot server so it can be sent in the `Authorization: Bearer <token>` header.
- **Plaintext Storage on Depot:**
  - The raw bearer token must reside in `.env` (e.g. `SYNC_DEVICE_TOKEN`) or a configuration file on the Windows filesystem.
  - Windows file permissions (`icacls`) must restrict access to the service account running the daemon to prevent unauthorized staff access.
- **Lost Token Recovery:**
  - SHA-256 is a one-way hash; lost tokens cannot be recovered.
  - Recovery requires generating a new raw token, updating `SyncDevice.tokenHash` on Cloud, and updating `.env` on the depot server.
- **Cloned Server Risk:**
  - If a Windows depot server disk image is cloned to a second depot server, both servers will push under the same `deviceId`.
  - Cloud enforces unique `[deviceId, clientSequence]` (`schema.prisma` line 596). When Server B attempts to push sequence 101 after Server A pushed sequence 101, Cloud rejects with `SEQUENCE_REUSE_FORBIDDEN` (`push.ts` line 172). Both servers will lock each other out.
  - Rule: Each physical depot server must have a strictly unique `deviceId`.
- **Revocation:**
  - When `SyncDevice.isRevoked = true`, Cloud immediately rejects with HTTP 403 `DEVICE_REVOKED`.
  - Safe, verified, and functioning as intended.

---

## 8. Push/Pull Scheduling Requirements

To safely operate in production, a future background daemon must adhere to the following scheduling principles:

1. **Execution Order (Sequential Interleaving):**
   - Push and pull MUST NOT run concurrently in the same depot process.
   - Cycle: **Push Pending Operations → Wait for completion → Pull Incremental Changes → Wait for completion → Idle Sleep**.
2. **Timing & Frequency:**
   - **Normal Connected State:**
     - Push: Debounced event trigger on local transaction commit (immediate push within 2 seconds) + periodic poll every 30 seconds.
     - Pull: Periodic poll every 30 to 60 seconds.
   - **Backoff on Network Outage (Circuit Breaker):**
     - Initial failure: Retry after 5s.
     - Successive failures: Exponential backoff (10s, 20s, 40s, 80s, 160s, max 300s / 5 minutes).
     - **Critical Rule:** Transient network failures (HTTP 5xx, timeout, fetch error) MUST NOT increment `SyncOutbox.retryCount`.
3. **Queue Halt Invariants:**
   - If `SyncOutbox` has any record with `status = 'FAILED'`, push execution must PAUSE and notify the operator.
   - If `LocalSyncQuarantine` has any record with `status = 'QUARANTINED'`, pull execution must PAUSE and notify the operator.
4. **Advisory Locking / Single-Flight:**
   - The daemon must acquire a database-level lock (e.g., PostgreSQL advisory lock `SELECT pg_try_advisory_lock(884920)`) at the start of each cycle to guarantee that only one sync worker runs at any time across the server.

---

## 9. Quarantine / Conflict UI Readiness

### Audit of Service Layer (`src/lib/sync/client/pull.ts`)
The underlying data structures and service methods for handling quarantine are already implemented:
- **`LocalSyncQuarantine` Entity:** Exposes `changeSequence`, `operationId`, `operationType`, `entityId`, `action`, `payload`, `errorCode`, `errorMessage`, `status`, `createdAt`, `resolvedAt`, `resolutionAction`, `resolutionReason`, `resolvedByUserId`.
- **`getActiveQuarantinedChanges()`** (`pull.ts` line 907): Fetches active unresolved items ordered by `changeSequence ASC`.
- **`resolveQuarantineChange()`** (`pull.ts` line 768): Implements strict resolution logic:
  - Validates sequential resolution (must resolve `currentCursor + 1`).
  - Supports `action: "RETRY"` (re-attempts mutation with optional `overridePayload`).
  - Supports `action: "DISCARD"` (records in `LocalProcessedChange` as discarded, advances cursor).
  - Requires mandatory auditable reason and records `resolvedByUserId`.

### Gaps for UI Implementation
1. **No API Routes / Server Actions:** There are currently **no HTTP API routes or Next.js Server Actions** to expose `getActiveQuarantinedChanges()` or execute `resolveQuarantineChange()` from the frontend.
2. **No UI Screen:** No user interface exists in `src/app` for viewing or resolving quarantined changes.
3. **Authorization:** Quarantine resolution must be strictly restricted to `Role.OWNER`. Staff accounts must not be able to discard or override changes.

---

## 10. Customer Authority Dependency

### Current Behavior in Code
In `src/lib/sync/client/pull.ts` lines 306–312:
```ts
if (change.operationType === "UPSERT_CUSTOMER") {
  throw new PullApplyError(
    `CUSTOMER AUTHORITY DECISION REQUIRED: Customer authority is ambiguous between Cloud and Depot in frozen architecture. Cloud change '${change.operationId}' held.`,
    "CUSTOMER_AUTHORITY_DECISION_REQUIRED",
    { sequence: change.changeSequence, operationId: change.operationId }
  );
}
```

### Impact & Downstream Consequences
1. **Push Side:** `handleUpsertCustomer` is implemented on Cloud (`master-data.ts` line 76) and can receive customer creates/updates pushed by depots.
2. **Pull Side:** When Cloud records a `UPSERT_CUSTOMER` change in `SyncChangeLog`, any pulling depot encounters `CUSTOMER_AUTHORITY_DECISION_REQUIRED`.
3. **Quarantine Halting:** Because this error is classified as deterministic (`pull.ts` line 97), the change is quarantined in `LocalSyncQuarantine`, and `SyncCursor` halts at that sequence.
4. **System Consequence:** Until Customer Authority is resolved by architectural decision, **ANY customer change originating on Cloud freezes incremental pull synchronization on all depots**.

### Required Decision Options
- **Option 1: Cloud-Authoritative Customer Master.** Cloud owns customer catalog, price tier assignments, and credit limits. Depot creates customers as drafts or requests; Cloud validates and distributes them.
- **Option 2: Depot-Authoritative Customers.** The depot that creates the customer owns the customer. Other depots or Cloud cannot mutate customer balances or credit limits.
- **Option 3: Hybrid Partitioning (Recommended).** Customer Identity (UUID, Name, Phone, Address, Price Tier) is created with client-generated UUIDs on Depot or Cloud and synchronized bidirectionally. Financial ledger balances (Debit/Credit) are calculated purely from immutable Sale and Payment transactions, eliminating balance conflicts.

---

## 11. Failure & Recovery Matrix

| # | Failure Scenario | Current Behavior | Persistent State Affected | Recovery Mechanism | Daemon Implication |
| :- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Internet Offline** | Push fetch throws `TypeError`; catches and marks PENDING with `retryCount++`. Pull fetch throws HTTP error. | `SyncOutbox.retryCount`, `SyncOutbox.lastError` | When network returns, next poll attempts push/pull. | **FLAW**: 10 retries during outage permanently fails outbox. Daemon must suspend retries on network error. |
| **2** | **Cloud API 502/503** | Server returns non-200. Push resets to PENDING with `retryCount++`. Pull throws `PullApplyError`. | `SyncOutbox.retryCount` | Retries on subsequent intervals. | Daemon must apply exponential backoff on HTTP 5xx responses. |
| **3** | **Local PostgreSQL Down** | Prisma queries fail (`P1001` connection refused). Uncaught exception if not wrapped. | None (DB is unreachable). | Daemon crashes unless wrapped in top-level try/catch with reconnection loop. | Daemon must catch DB disconnects, sleep, and re-check connection before running cycles. |
| **4** | **Crash During Push** | Process terminates mid-HTTP call after marking candidate rows `IN_FLIGHT`. | `SyncOutbox.status = 'IN_FLIGHT'` | `recoverOrphanedInFlightOps` resets to `PENDING` after 5 min timeout. | Daemon must run `recoverOrphanedInFlightOps` immediately on startup. |
| **5** | **Crash During Pull** | Process terminates mid-batch application. | Transaction rolls back in PostgreSQL. | No persistent state corrupted. `SyncCursor` remains at previous sequence. | Safe. Next pull re-fetches from unchanged cursor; idempotent replay protection handles any partial state. |
| **6** | **Windows Reboot** | Operating system restarts abruptly. | Active transactions roll back; `IN_FLIGHT` outbox records remain. | On boot, Windows Service Manager restarts daemon; daemon recovers `IN_FLIGHT` records. | Daemon must be registered as an auto-start Windows Service. |
| **7** | **Duplicate Push Batch** | Network dropped ACK; local client re-sends same batch. | None (Cloud checks `ProcessedSyncOperation`). | Cloud identifies duplicate `operationId`, skips execution, returns original success ACK. | Safe. Fully idempotent. |
| **8** | **Duplicate Pull Batch** | Local client re-requests batch already processed. | `LocalProcessedChange` records exist. | Engine detects `changeSeq <= cursor` or `LocalProcessedChange` exists; skips mutation safely. | Safe. Fully idempotent. |
| **9** | **Sequence Gap in Pull** | Batch starts at seq > `cursor + 1` (missing changes). | None. Transaction throws `CURSOR_GAP_DETECTED`. | Batch rolls back. Cursor does not advance. | Daemon logs error and pauses; administrator must inspect Cloud sequence log. |
| **10** | **FAILED Outbox Operation** | Cloud rejected an operation with deterministic failure. | `SyncOutbox.status = 'FAILED'`, `SyncOutbox.lastError` set. | Queue halts. Subsequent operations remain `PENDING`. | Daemon stops pushing. Requires manager to call `retryFailedOperation` after correcting payload. |
| **11** | **Deterministic Pull Quarantine** | Cloud change violates authority or schema (e.g. `CUSTOMER_AUTHORITY`). | `LocalSyncQuarantine` row created with `QUARANTINED`. Cursor advances to N-1. | Pull halts at sequence N. Previous valid changes committed. | Daemon detects `blocked: true` and enters dormant state for pull until resolved. |
| **12** | **Quarantine Resolved RETRY** | Manager fixes issue and clicks Retry. | `LocalSyncQuarantine.status = 'RESOLVED'`, `SyncCursor` advances to N. | Engine executes mutation, marks `LocalProcessedChange`, advances cursor. | Pull queue unblocks automatically; daemon resumes incremental pull. |
| **13** | **Quarantine Resolved DISCARD** | Manager rejects change with audit reason. | `LocalSyncQuarantine.status = 'RESOLVED'`, `SyncCursor` advances to N. | Engine records `DISCARDED_*` in `LocalProcessedChange`, advances cursor without mutation. | Pull queue unblocks; change is permanently skipped with full audit trail. |
| **14** | **Device Revoked** | Cloud admin marks `SyncDevice.isRevoked = true`. | Cloud marks revoked. | Cloud returns HTTP 403 `DEVICE_REVOKED`. | Daemon must detect 403, stop sync cycles completely, and log an alert. |
| **15** | **Invalid Auth / Bad Token** | Token in `.env` is incorrect or rotated. | None. | Cloud returns HTTP 401 `TOKEN_MISMATCH`. | Daemon halts sync cycles to avoid authentication spam; logs token configuration error. |
| **16** | **Cloud DB Failure** | Supabase connection pool exhausted or down. | Transaction rolls back on Cloud. | Cloud returns HTTP 500 / 503. Local client treats as transient. | Daemon backs off exponentially until Cloud recovers. |
| **17** | **Local DB Transaction Failure** | Local disk full or constraint error during pull. | Entire batch rolls back. | Cursor remains unchanged; error thrown. | Daemon logs error and retries next cycle after error condition is resolved. |

---

## 12. Security Findings

1. **Local Bearer Token Exposure:**
   - The depot server must store the raw unhashed device token to authenticate outbound HTTPS requests (`authentication.ts` line 77).
   - *Risk:* Anyone with filesystem access to the depot server can read `.env`.
   - *Requirement:* Restrict Windows NTFS file permissions on `.env` to the service account running the daemon.
2. **Actor Attribution Hardening (Phase 3 Verified):**
   - Business handlers strictly enforce `resolveRequiredActorUser` (`common.ts` line 56).
   - Payloads missing an active actor fail with `MISSING_ACTOR_IDENTITY`. Payloads cannot falsely claim Owner permissions unless the actor record in the database is an active Owner (`master-data.ts` line 383).
   - Zero fallback to earliest user or arbitrary user exists.
3. **Header-Based Device Identity:**
   - Device identity is taken strictly from `X-Device-Id` HTTP header (`authentication.ts` line 70), never from the request body. Body `deviceId` is cross-checked against header (`push/route.ts` line 97).
4. **LAN Web Interface Security:**
   - Next.js web application running on port 3000 will be accessible to all devices on the depot LAN.
   - User authentication (PIN or Supabase session) must guard all sensitive routes.

---

## 13. Observability & Telemetry Findings

### Existing Logging & Audit Features
- **Transaction Audit Trail:** `AuditLog` table records significant business operations (`action`, `entityType`, `entityId`, `oldValues`, `newValues`, `reason`, `deviceId`, `userId`).
- **Push Failures:** Persisted in `SyncOutbox.lastError` and `SyncOutbox.status`.
- **Pull Failures:** Persisted in `LocalSyncQuarantine.errorCode` and `errorMessage`.

### Missing Telemetry Required for Phase 5 Daemon
To answer the operational question: *"Why isn't this depot syncing?"*, the system requires a persistent local sync telemetry record:
- **Last Successful Push Timestamp**
- **Last Successful Pull Timestamp**
- **Last Cloud Contact Attempt Timestamp**
- **Current Sync Status:** `IDLE` | `SYNCING` | `OFFLINE` | `BLOCKED_PUSH` | `BLOCKED_PULL` | `AUTH_ERROR`
- **Active Quarantine Count**
- **Pending Outbox Count**
- **Consecutive Network Failure Count**

---

## 14. Database & Migration Readiness

### Migration Status Inspection
All 5 existing migrations in `prisma/migrations` are applied and verified:
1. `20260907105853_init_distribution_schema`: Core ERP schema (Products, Sales, Receivings, Movements, Daily Closing, Users).
2. `20260915221800_sync_foundation`: Initial sync tables (`SyncOutbox`, `SyncCursor`, `ProcessedSyncOperation`, `SyncChangeLog`, `SyncDevice`).
3. `20260916053000_sync_change_operation_id`: Added immutable `operationId` UUID to `SyncChangeLog`.
4. `20260916154500_local_processed_change`: Added `LocalProcessedChange` table for pull replay protection.
5. `20260916180000_local_sync_quarantine`: Added `LocalSyncQuarantine` table for deterministic pull block protection.

### Type & Integrity Verification
- **BigInt Sequences:** `clientSequence` and `changeSequence` are `BigInt`, converted to/from strings in JSON payloads (`types.ts`).
- **Monetary Precision:** All currency fields use PostgreSQL `Decimal(12, 2)`.
- **Prisma Deploy Readiness:** A new local depot PostgreSQL database can cleanly initialize by executing `npx prisma migrate deploy` without errors.

---

## 15. Performance & Scale Assessment

The intended scale is **1 local depot server, 2–3 concurrent users, and 50–200 catalog products**.
- **Batch Sizes:** Outbox push is capped at 50 operations (`push.ts` line 38). Pull is capped at 50–100 changes (`pull.ts` line 26). This generates payloads under 100 KB, easily fitting within Vercel’s 4.5 MB request body limit and Next.js memory limits.
- **Database Locks:** Row-level locks (`SELECT ... FOR UPDATE`) are applied in sorted product ID order in `sales.ts` (line 133) and `stock.ts` (line 265), preventing deadlocks while maintaining inventory integrity.
- **Verdict:** No premature optimization is necessary. The current architecture will effortlessly handle the target scale.

---

## 16. Dependency Graph

```mermaid
flowchart TD
    subgraph Decisions [Required Architectural Decisions]
        D1["Customer Authority Decision (Cloud vs Depot vs Hybrid)"]
        D2["Windows Execution Model (NSSM Windows Service vs PM2)"]
        D3["Network Retry Policy (Decouple network errors from MAX_RETRY)"]
        D4["Scheduling & Interval Configuration"]
    end

    subgraph Phase5Core [Phase 5 Core Implementation]
        M1["Push Engine Hardening (Fix retry exhaustion & add DB mutex)"]
        M2["Sync Telemetry / Status Model (LocalSyncStatus table)"]
        M3["Background Sync Daemon (Sequential loop, backoff, lock)"]
    end

    subgraph Phase5UI [Phase 5 Management UI]
        U1["Quarantine Server Actions / API Routes"]
        U2["Quarantine Management Screen (Inspect, Retry, Discard)"]
        U3["Sync Health Status Indicator (Header / Settings)"]
    end

    subgraph WindowsDeploy [Deployment Packaging]
        W1["PowerShell Startup & Windows Service Script (NSSM)"]
        W2[".env.depot Configuration Template"]
    end

    D1 --> M1
    D3 --> M1
    D2 --> M3
    D4 --> M3
    M1 --> M3
    M2 --> M3
    M2 --> U3
    U1 --> U2
    M3 --> W1
```

---

## 17. Categorized Findings & Blockers

### A. BLOCKERS (Must be resolved before Phase 5 implementation)
1. **Network Failure Retry Exhaustion:** `src/lib/sync/client/push.ts` lines 288–300 increments `retryCount` on network failures up to `MAX_RETRY_COUNT = 10`, which permanently marks outbox items `FAILED` during a temporary internet drop. Network failures must not consume semantic retry counts.
2. **Missing Mutex / Single-Flight Lock:** No mechanism prevents overlapping daemon sync runs. An advisory lock or database lock table is mandatory before running sync on a timer.
3. **Linux-Only Server Watchdog:** `run-server.sh` fails on Windows. A native Windows service or PowerShell supervision model must be established.

### B. REQUIRED DECISIONS (Requires explicit architectural decision)
1. **Customer Authority Decision:** Establish whether Customer master is Cloud-authoritative, Depot-authoritative, or Hybrid.
2. **Windows Server Deployment Model:** Formally approve Option C (NSSM Windows Service) or Option B (PM2).
3. **Polling Intervals:** Formally approve default sync intervals (e.g. 30s connected push/pull, 5s–300s backoff).
4. **Local Credential Storage:** Approve plaintext `.env` storage with NTFS file restrictions.

### C. REQUIRED IMPLEMENTATION (Planned Phase 5 Work)
1. Daemon worker script (`src/daemon/index.ts`) implementing sequential push/pull, advisory lock, and exponential backoff.
2. Server Actions / API routes for listing and resolving quarantined items.
3. Quarantine management page in the Next.js UI (`/admin/sync/quarantine`).
4. Local sync status telemetry table (`LocalSyncStatus`).

### D. NICE TO HAVE
1. Visual sync status indicator badge (green/yellow/red) in the navigation bar.
2. Automated PowerShell installer script for the Windows depot server.

### E. NO ISSUE (Already Handled Correctly)
1. Push and pull idempotency and replay protection.
2. Stop-on-first-error and gap detection on both Cloud and Depot.
3. Deterministic quarantine containment and cursor preservation.
4. Hardened actor attribution and role hierarchy checks.

---

## 18. Required Decisions

Before implementing Phase 5, the following 4 decisions must be approved:

1. **Customer Authority Resolution:**
   - *Recommendation:* Adopt **Hybrid Partitioning**. Customer identity (UUID, Name, Phone) can be created on either Cloud or Depot and synchronized bidirectionally. Financial balances are calculated purely from sales and payments.
2. **Windows Runtime Model:**
   - *Recommendation:* Adopt **Option C: Native Windows Service via NSSM** for both Next.js and the Sync Daemon.
3. **Network Failure Policy:**
   - *Recommendation:* Decouple transient network errors from `MAX_RETRY_COUNT`. Network errors should trigger exponential backoff without marking outbox operations as `FAILED`.
4. **Daemon Polling Frequency:**
   - *Recommendation:* 30-second interval when connected; backoff to 5m when offline; immediate debounced push on sale creation.

---

## 19. Required Future Implementation

When Phase 5 implementation begins, the scope of work will be:
1. **Push Engine Hardening:** Modify `src/lib/sync/client/push.ts` to separate network errors from business rejection retries, and implement `pg_try_advisory_lock`.
2. **Sync Telemetry Schema:** Add a lightweight local status table (`LocalSyncStatus`) to record sync timestamps and operational state.
3. **Daemon Worker:** Create `src/daemon/sync-worker.ts` with graceful shutdown, signal handling, and sequential push/pull loops.
4. **Quarantine UI & Server Actions:** Create Server Actions for `getActiveQuarantinedChanges()` and `resolveQuarantineChange()`, and a management page at `/admin/sync/quarantine`.
5. **Windows Service Packaging:** Provide `scripts/install-windows-service.ps1` using NSSM.

---

## 20. Recommended Phase 5 Implementation Order

```text
Step 1: Formal Approval of Architectural Decisions (Customer Authority, Windows Runtime Model)
   ↓
Step 2: Push Engine Hardening & Advisory Lock (Fix network retry bug, add single-flight lock)
   ↓
Step 3: Customer Authority Rule Implementation (Update pull engine to handle customer changes)
   ↓
Step 4: Local Sync Status Schema & Telemetry (Prisma migration for LocalSyncStatus)
   ↓
Step 5: Background Sync Daemon Implementation (CLI worker with sequential cycle & backoff)
   ↓
Step 6: Quarantine Management UI (Server Actions + UI screen for Owner review/resolution)
   ↓
Step 7: Windows Runtime Packaging & End-to-End Verification
```

---

## 21. Explicit "NOT IMPLEMENTED" Section

In accordance with strict audit constraints, the following were **NOT** implemented during this task:
- ❌ No application source code was modified.
- ❌ No database schema changes were made.
- ❌ No Prisma migrations were generated or applied.
- ❌ No background daemon or worker scripts were created.
- ❌ No Windows services were created.
- ❌ No Quarantine UI or API routes were created.
- ❌ Customer Authority was NOT decided or changed in code.
- ❌ Offline PIN authentication was NOT implemented.
- ❌ Inventory anomaly systems were NOT implemented.
- ❌ No production databases were accessed.

---

## Phase 5 Readiness Verdict

### **READY WITH REQUIRED DECISIONS**

**Verdict Explanation:**  
The underlying data structures, transactional integrity, replay idempotency, sequence verification, deterministic quarantine, and actor authorization mechanisms implemented in Phases 1 through 4 are **robust, complete, and fully verified**. 

However, Phase 5 implementation cannot proceed blindly. Proceeding requires **explicit architectural sign-off on 4 decisions**:
1. **Customer Authority Resolution Policy** (to prevent cloud customer updates from permanently quarantining depot pulls).
2. **Windows Server Deployment Model** (NSSM Windows Service vs. PM2).
3. **Network Retry Policy Refinement** (fixing the `MAX_RETRY_COUNT` exhaustion bug during offline periods).
4. **Scheduling & Polling Intervals** (confirming connected vs. disconnected backoff frequencies).

Once these decisions are formally selected, Phase 5 implementation can proceed immediately following the recommended order.
