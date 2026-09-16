# Phase 5 — Step 1 Architecture & Implementation Report
## Sync Concurrency Hardening & Hybrid Customer Authority

**Status:** APPROVED & IMPLEMENTED (Step 1 Complete)  
**Date:** September 16, 2026  
**Target Commit:** `feat(sync): Phase 5 concurrency and hybrid customer authority`  
**Base Commit:** `449ced86b90260771b05bdbfcd4106b0b25e335b`  

---

## 1. Executive Summary

Phase 5 Step 1 implements critical single-flight concurrency hardening across push and pull synchronization pipelines, resolves customer authority with a strict hybrid model, and guarantees transactional isolation and non-blocking semantics without altering the frozen architecture.

Key Accomplishments:
1. **Advisory Lock Single-Flight Concurrency Protection**:
   - Push operations use PostgreSQL 64-bit transaction-level advisory locks (`pg_try_advisory_xact_lock(BigInt("88492001"))`).
   - Pull operations and manual quarantine resolutions share a distinct PostgreSQL 64-bit transaction-level advisory lock (`pg_try_advisory_xact_lock(BigInt("88492002"))`).
   - If an operation is already in progress, concurrent invocations immediately return `{ alreadyRunning: true }` without blocking, waiting, throwing errors, advancing cursors, or modifying outbox/quarantine state.
2. **Hybrid Customer Authority**:
   - Customer profile metadata (`id`, `name`, `phone`, `address`, `priceTier`, `creditAllowed`, `isActive`) is synchronized bidirectionally between Cloud and Local Depot.
   - Financial balances, sales, payments, and container movements remain strictly Depot-authoritative. Balance is dynamically computed from ledger records (`Sale`, `Payment`) and is never stored in or synchronized as authoritative customer state.
   - Removed obsolete `CUSTOMER_AUTHORITY_DECISION_REQUIRED` quarantine blocking code.
3. **Verification**:
   - 20 dedicated concurrency and hybrid customer tests implemented in `src/lib/sync/sync-concurrency-customer.test.ts` (100% pass rate).
   - Complete Phase 1–4 regression suites (87 tests) re-verified with 100% pass rate (total 107 sync tests passed).
   - Full TypeScript check (`npx tsc --noEmit`) and production Next.js build (`npm run build`) pass cleanly with 0 errors.

---

## 2. Concurrency Architecture & PostgreSQL Advisory Locks

### Single-Flight Guarantees
In local depot environments, multiple triggers (scheduled cron intervals, background daemon loops, manual user UI sync triggers, or concurrent API requests) could invoke `pushPendingOperations()` or `applyLocalPullBatch()` simultaneously.

Without single-flight protection:
- Concurrent pushes could attempt to send the same outbox items or advance sequence counters in conflicting orders.
- Concurrent pulls could retrieve overlapping batches, attempt duplicate mutations, or trigger deadlocks on `SyncCursor` and `LocalProcessedChange`.

### Advisory Lock Mechanism
We utilize PostgreSQL transaction-level advisory locks:
```sql
SELECT pg_try_advisory_xact_lock($1) AS acquired;
```

Advantages of `pg_try_advisory_xact_lock`:
1. **Non-blocking (`try`)**: Returns `true` if acquired, `false` immediately if already held.
2. **Transaction-scoped (`xact`)**: The lock is tied directly to the PostgreSQL transaction lifecycle. It is automatically released upon transaction commit, rollback, client disconnect, or failure. There is zero risk of lingering orphan locks after process crashes or unhandled exceptions.
3. **Lightweight**: Pure in-memory Postgres lock mechanism without table lock contention or disk I/O.

---

## 3. Lock ID Partitioning & Lock Scopes

Two disjoint 64-bit BigInt keys are allocated:

| Pipeline | Advisory Lock ID | Constant Name | Scope / Target Functions |
|---|---|---|---|
| **Push** | `88492001` (`BigInt("88492001")`) | `SYNC_PUSH_ADVISORY_LOCK_ID` | `pushPendingOperations()` |
| **Pull & Quarantine** | `88492002` (`BigInt("88492002")`) | `SYNC_PULL_ADVISORY_LOCK_ID` | `applyLocalPullBatch()`, `resolveQuarantineChange()` |

### Independence of Push and Pull
Push (`88492001`) and Pull (`88492002`) operate under independent locks. A long-running pull batch does NOT block an outgoing push batch, and an outgoing push does NOT block an incoming pull batch.

### Mutual Exclusion of Pull and Quarantine Resolution
`resolveQuarantineChange()` acquires `SYNC_PULL_ADVISORY_LOCK_ID` (`88492002`). This guarantees that an administrative user attempting to resolve or retry a quarantined change cannot race with an active pull batch executing on the local depot.

---

## 4. Lifecycle & Failure Mode Analysis

### Return Semantics When Lock is Held
When `pg_try_advisory_xact_lock` returns `false`:
- **Push**:
  ```ts
  return {
    success: true,
    alreadyRunning: true,
    syncedCount: 0,
    failedCount: 0,
    retryCount: 0,
    nothingToPush: false,
  };
  ```
- **Pull**:
  ```ts
  return {
    appliedCount: 0,
    newCursor: currentCursor.toString(),
    hasMore: false,
    blocked: false,
    alreadyRunning: true,
  };
  ```
- **Quarantine Resolution**:
  ```ts
  return {
    success: false,
    alreadyRunning: true,
    error: "A pull or quarantine operation is currently running. Please try again.",
  };
  ```

### Invariants Preserved
- No error is thrown on concurrent attempts; it is treated as a safe no-op.
- `SyncCursor.lastSequence` is never updated or incremented.
- `SyncOutbox.retryCount` is never incremented.
- `LocalSyncQuarantine` is not modified.
- No partial writes or race conditions occur.
- Process crash / sudden power loss immediately drops the TCP connection, releasing the transaction lock in Postgres.

---

## 5. Hybrid Customer Authority Model

### The Business Challenge
In beverage distribution depots:
- Depot cashiers must be able to create new customers on the fly during sales.
- Cloud managers / key account admins also create or update customer details (credit permissions, address, price tiers).
- However, cashiers record sales, collect cash, grant store credit, and manage empties (crates/bottles) locally. If balance or credit ledgers were Cloud-authoritative, network disconnection would paralyze depot checkout.

### Approved Hybrid Resolution
1. **Customer Master Metadata**:
   - `id`: UUID generated by the creating system (Local or Cloud). UUIDs remain immutable and never change.
   - `name`, `phone`, `address`, `priceTier`, `creditAllowed`, `isActive`: Bidirectionally synchronized.
   - Local can push `UPSERT_CUSTOMER`.
   - Cloud can generate `UPSERT_CUSTOMER` into `SyncChangeLog`.
   - Pull applies `UPSERT_CUSTOMER` directly into local depot database.
2. **Customer Financial & Container Ledger**:
   - Sales, payments, discounts, credit extensions, and container deposits remain strictly **Depot-authoritative**.
   - Customer balances are not columns in the `Customer` table. Balances are dynamically aggregated:
     $$\text{Balance} = \sum(\text{Sale.totalAmount}) - \sum(\text{Payment.amount})$$
   - Container balances are dynamically aggregated from `ContainerMovement` records.
   - Customer profile sync NEVER touches, modifies, resets, or overwrites sales, payments, or container records.

---

## 6. Schema & Ledger Boundary Verification

### Customer Table Definition
```prisma
model Customer {
  id            String      @id @default(uuid())
  name          String
  phone         String?
  address       String?
  priceTier     PriceTier   @default(RETAIL)
  creditAllowed Boolean     @default(false)
  isActive      Boolean     @default(true)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  sales              Sale[]
  payments           Payment[]
  containerMovements ContainerMovement[]

  @@index([name])
  @@index([phone])
}
```

### Ledger Invariance
- Verification confirmed that no `balance` or `outstandingBalance` column exists on `Customer`.
- Updating a customer's `name` or `creditAllowed` via pull or push modifies only the profile fields.
- Ledger integrity is preserved across repeated pull cycles.

---

## 7. Customer Upsert & Quarantine Semantics

### Local Pull Implementation
In `src/lib/sync/client/pull.ts`:
1. Added `"UPSERT_CUSTOMER"` to `CLOUD_AUTHORITATIVE_OPS`.
2. Handled `UPSERT_CUSTOMER` in `applyCloudAuthoritativeMutation`:
   - Validates required fields (`name` non-empty, `priceTier` valid enum if present).
   - If `action === "DELETE"`: performs soft-delete (`isActive: false`).
   - If `action === "UPSERT"`: performs `prisma.customer.upsert` on `id`, updating profile attributes without touching relational ledger records.
3. Invalid payload or malformed price tier deterministically routes to `LocalSyncQuarantine` with `INVALID_PAYLOAD` without halting other independent customer or product updates.

### Removal of Obsolete Quarantine Code
- Removed `CUSTOMER_AUTHORITY_DECISION_REQUIRED` from `applyCloudAuthoritativeMutation`.
- Updated test suites to use real authority violation errors (`CREATE_SALE` from Cloud).

---

## 8. Test Matrix & Results (All 20 Scenarios)

The comprehensive integration test suite `src/lib/sync/sync-concurrency-customer.test.ts` executes and passes all 20 specified scenarios:

| # | Test Scenario | Verified Behavior | Status |
|---|---|---|:---:|
| 1 | Push single-flight advisory lock | Second concurrent push returns `{ alreadyRunning: true }` immediately | PASS |
| 2 | Push advisory lock release on completion | Subsequent push executes normally after first transaction commits | PASS |
| 3 | Push advisory lock release on crash/error | Lock releases upon transaction rollback; subsequent push succeeds | PASS |
| 4 | Pull single-flight advisory lock | Second concurrent pull returns `{ alreadyRunning: true }` without advancing cursor | PASS |
| 5 | Pull advisory lock release on completion | Subsequent pull executes normally after first transaction commits | PASS |
| 6 | Pull advisory lock release on crash/error | Lock releases upon transaction rollback; subsequent pull succeeds | PASS |
| 7 | Concurrent Push + Pull independent locks | Push and pull run concurrently without deadlocking or blocking each other | PASS |
| 8 | Pull lock blocks quarantine resolution | `resolveQuarantineChange` returns `{ alreadyRunning: true }` while pull holds lock | PASS |
| 9 | Cloud customer upsert applies locally | New customer created on Cloud synchronizes cleanly to Depot via pull | PASS |
| 10 | Depot customer creation pushes to Cloud | Customer created locally pushes to Cloud and creates `SyncChangeLog` | PASS |
| 11 | Stable customer UUID | Same UUID remains identical across push, pull, and database queries | PASS |
| 12 | Customer profile update | Name, phone, address, priceTier update cleanly without altering ID | PASS |
| 13 | Credit allowed toggle | `creditAllowed` toggles true/false without affecting sales or payments | PASS |
| 14 | Customer ledger balance isolation | Customer balance ($\sum \text{Sales} - \sum \text{Payments}$) is untouched by profile pull | PASS |
| 15 | Customer container movement isolation | Container movements remain intact after customer profile pull | PASS |
| 16 | Customer soft delete via pull | `action === "DELETE"` sets `isActive: false` on local customer record | PASS |
| 17 | Customer reactivation via pull | Updating customer with `isActive: true` reactivates soft-deleted record | PASS |
| 18 | Customer invalid payload quarantine | Customer change missing `name` quarantines cleanly with `INVALID_PAYLOAD` | PASS |
| 19 | Two customers with identical names | Different UUIDs with identical names remain distinct records (no collision) | PASS |
| 20 | Push rejects revoked device | Revoked or unauthorized device attempting customer push is rejected (401) | PASS |

**Test Execution Time:** 174.7s  
**Results:** 20 passed, 0 failed, 0 skipped.

---

## 9. Regression Test Suite Verification

All Phase 1–4 test suites were re-run against remote Supabase database to guarantee zero regression:

| Test Suite File | Phase Tested | Tests | Passed | Failed | Duration |
|---|---|:---:|:---:|:---:|:---:|
| `src/lib/sync/sync-foundation.test.ts` | Phase 1 Foundation | 8 | 8 | 0 | 30.5s |
| `src/lib/sync/sync-push.test.ts` | Phase 2 Push Protocol | 24 | 24 | 0 | 170.5s |
| `src/lib/sync/sync-business.test.ts` | Phase 3 Business Handlers | 30 | 30 | 0 | 441.4s |
| `src/lib/sync/sync-actor-hardening.test.ts` | Phase 3 Actor Hardening | 11 | 11 | 0 | 115.8s |
| `src/lib/sync/sync-change-identity.test.ts` | Phase 3 Change Identity | 5 | 5 | 0 | 131.9s |
| `src/lib/sync/sync-pull.test.ts` | Phase 4 Pull Protocol & Quarantine | 9 | 9 | 0 | 117.5s |
| `src/lib/sync/sync-concurrency-customer.test.ts` | Phase 5 Step 1 Concurrency & Customer | 20 | 20 | 0 | 174.7s |
| **Total** | **All Phases** | **107** | **107** | **0** | **~1182s** |

---

## 10. Daemon / Windows Service Readiness & Boundaries

### Boundaries Strictly Maintained
- **No Background Daemon**: No `setInterval`, loop runner, or daemon worker process was created in this step.
- **No NSSM / Windows Service Setup**: Deployment scripts for Windows services remain deferred to subsequent deployment steps.
- **No Quarantine UI / Conflict UI**: UI screens for quarantine management remain deferred.
- **No Network Retry Behavior Changes**: `MAX_RETRY_COUNT` and exponential backoff semantics remain unchanged.

### Preparedness for Step 2 (Daemon Integration)
The advisory lock implementation directly solves the primary concurrency hazard of background synchronization. When the daemon is introduced, it can safely trigger `pushPendingOperations()` and `applyLocalPullBatch()` on scheduled intervals without risking overlap with manual user triggers or concurrent requests.

---

## 11. Files Modified / Created

### Modified Files:
- `src/lib/sync/client/push.ts`
  - Added `SYNC_PUSH_ADVISORY_LOCK_ID = BigInt("88492001")`.
  - Added transaction-level advisory locking with `pg_try_advisory_xact_lock`.
  - Implemented single-flight `{ alreadyRunning: true }` non-blocking return.
- `src/lib/sync/client/pull.ts`
  - Added `SYNC_PULL_ADVISORY_LOCK_ID = BigInt("88492002")`.
  - Added transaction-level advisory locking to `applyLocalPullBatch()` and `resolveQuarantineChange()`.
  - Added `"UPSERT_CUSTOMER"` to `CLOUD_AUTHORITATIVE_OPS`.
  - Implemented `UPSERT_CUSTOMER` mutation handler with validation and soft delete support.
  - Removed obsolete `CUSTOMER_AUTHORITY_DECISION_REQUIRED` code.
- `src/lib/sync/sync-pull.test.ts`
  - Updated Test G to use `CREATE_SALE` for deterministic `AUTHORITY_VIOLATION` verification.

### Created Files:
- `src/lib/sync/sync-concurrency-customer.test.ts`
  - Comprehensive 20-test integration test suite covering advisory locks and customer sync.
- `docs/PHASE_5_STEP_1_REPORT.md`
  - Complete architecture, concurrency, and customer authority report.

---

## 12. Verification Commands & Outputs

1. **TypeScript Validation**:
   ```bash
   npx tsc --noEmit
   # Exit Code: 0 (No type errors)
   ```

2. **Application Production Build**:
   ```bash
   npm run build
   # prisma generate && next build
   # Compiled successfully in 4.3s
   # Exit Code: 0
   ```

3. **Prisma Schema Validation**:
   ```bash
   npx prisma validate
   # The schema at prisma/schema.prisma is valid
   ```

4. **Integration Test Suite**:
   ```bash
   npx tsx src/lib/sync/sync-concurrency-customer.test.ts
   # ✔ Phase 5 Step 1: Concurrency Protection & Hybrid Customer Authority (174719.825443ms)
   # ℹ tests 20 | pass 20 | fail 0
   ```

---

**PHASE 5 STEP 1 COMPLETE — WAITING FOR REVIEW**
