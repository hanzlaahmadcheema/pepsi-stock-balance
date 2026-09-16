# Offline-First Synchronization Architecture — Phase Status

**Project**: Pepsi Regional Office Stock & Sales Software  
**Status as of**: September 16, 2026  

---

## Executive Phase Summary

| Phase | Description | Scope & Direction | Status | Verification Status |
| :--- | :--- | :--- | :---: | :---: |
| **Phase 1** | **Sync Foundation** | Database schema, `SyncOutbox`, `SyncCursor`, `ProcessedSyncOperation`, `SyncChangeLog`, `SyncDevice`, `AuditLog` | **APPROVED & CLOSED** | 8 / 8 Tests Passing |
| **Phase 2** | **Cloud Push + Idempotency** | Local $\to$ Cloud push pipeline (`/api/sync/push`), device auth, strict sequence ordering, idempotency, retry recovery | **APPROVED & CLOSED** | 24 / 24 Tests Passing |
| **Phase 3** | **Business Push Handlers** | Transactional Cloud domain handlers (16 ops), strict actor identity verification, audit trail, immutable `operationId` preservation | **APPROVED & CLOSED** | 22 / 22 Tests Passing |
| **Phase 4** | **Cloud $\to$ Local Pull & Quarantine** | Cloud $\to$ Local pull pipeline (`/api/sync/pull`), authority partition, deterministic block / quarantine (`LocalSyncQuarantine`), replay & crash safety | **APPROVED & CLOSED** | 9 / 9 Tests Passing |
| **Phase 5** | **Sync Daemon & Management** | Background polling daemon, Manager Quarantine Dashboard, formal Customer Authority partition | **PLANNED** | Not Started |

---

## Phase 4 Implementation Details (CLOSED & APPROVED)

### 1. Direction & Protocol
- **Direction**: Cloud (`SyncChangeLog`) $\to$ Local (`/api/sync/pull` $\to$ `applyLocalPullBatch`).
- **Authentication**: `X-Device-Id` + Bearer token SHA-256 validation against `SyncDevice.tokenHash`.
- **High-Water Mark**: Tracked strictly via `SyncCursor.lastSequence`.

### 2. Authority Partition
- **Cloud-Authoritative**: Product, Price, Supplier, User permissions/status.
- **Depot-Authoritative**: Sale, SaleItem, Payment, ContainerMovement, Receiving delivery intake. Cloud mutations to depot-authoritative data are rejected with `AUTHORITY_VIOLATION`.
- **Customer**: Unresolved in frozen architecture. External cloud customer changes trigger `CUSTOMER_AUTHORITY_DECISION_REQUIRED` and are safely quarantined.

### 3. Deterministic Block & Quarantine Semantics
- Model: `LocalSyncQuarantine` (`changeSequence @unique`, `operationId @unique`, `errorCode`, `errorMessage`, `payload`, `status: QUARANTINED | RESOLVED`).
- Safe Prefix Commit: Changes prior to blocked change are committed; the blocked change is quarantined; later changes are held.
- Anti-Looping: Re-attempts on quarantined changes immediately detect active quarantine and report `blocked: true` without blind retries or rollbacks.
- Resolution: Service-level function `resolveQuarantineChange()` allows `RETRY` (with optional `overridePayload`) or `DISCARD` (audited rejection), advancing `SyncCursor` and unblocking the stream.
- Replay Protection: `LocalProcessedChange` ensures idempotent deduplication.

---

## Next Steps: Phase 5 (Planning Only)

1. **Background Polling Daemon**: Periodic sync scheduler running on local depot server.
2. **Manager Quarantine Dashboard**: UI to inspect quarantined changes and trigger `resolveQuarantineChange()`.
3. **Formal Customer Authority Decision**: Explicit partition rules for offline vs online customer creation.
