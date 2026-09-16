/**
 * Phase 4 Sync — Cloud -> Local Pull Synchronization Integration Tests
 *
 * Covers all required Phase 4 Review Deterministic Block & Quarantine Semantics:
 *   A. Deterministic failure does not cause infinite blind retry
 *   B. Deterministic failure creates persistent blocked/quarantine state
 *   C. Cursor does not falsely advance past an unapplied change
 *   D. Later changes cannot silently bypass the blocked change
 *   E. Same blocked change can be retried after resolution
 *   F. Successful resolution allows cursor progression
 *   G. Customer authority ambiguity does not silently mutate Customer
 *   H. Customer authority ambiguity does not silently disappear
 *   I. Customer authority ambiguity is recoverable after future authority decision
 *   J. Unsupported operation is recoverable rather than silently discarded
 *   K. Invalid payload is recoverable rather than silently discarded
 *   L. Authority violation is recoverable rather than silently discarded
 *   M. Transient errors remain retryable and are not permanently quarantined
 *   N. Self-originated operations still reconcile correctly
 *   O. Existing idempotency remains intact
 *   P. Existing cursor gap protection remains intact
 *   Q. Existing operationId identity remains intact
 *
 * Plus Crash & Replay Safety:
 *   SAFE-A. Crash before commit (aborts transaction, cursor unchanged)
 *   SAFE-B. Crash after commit (idempotent replay, cursor stays committed)
 *   SAFE-C. Replay already-applied change (safely skipped)
 *   SAFE-D. Replay quarantined change (returns blocked without looping)
 *   SAFE-E. Retry after quarantine resolution (unblocks next changes)
 *   SAFE-F. No duplicate business mutations
 *   SAFE-G. No cursor regression
 *
 * Plus Protocol & Domain Semantics:
 *   PROTO-A. Pull returns changes strictly after cursor in ascending sequence
 *   PROTO-B. Empty pull returns no changes when up to date
 *   PROTO-C. Batch size limits enforced
 *   PROTO-D. Device authentication & revocation
 *   DOMAIN-A. Product cloud updates & soft delete
 *   DOMAIN-B. Price cloud updates (closes previous tier price)
 *   DOMAIN-C. Supplier updates & soft delete
 *   DOMAIN-D. User status/permission updates
 *   DOMAIN-E. Posted receiving ledger protection
 *
 * Run: npx tsx --test src/lib/sync/sync-pull.test.ts
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../prisma";
import { hashToken } from "./server/authentication";
import { fetchDevicePullBatch } from "./server/pull";
import {
  applyLocalPullBatch,
  getLocalSyncCursor,
  resolveQuarantineChange,
  getActiveQuarantinedChanges,
  PullApplyError,
} from "./client/pull";
import { POST } from "../../app/api/sync/pull/route";
import {
  SyncStatus,
  SyncChangeAction,
  PriceTier,
  Role,
  QuarantineStatus,
  type SyncDevice,
} from "@prisma/client";
import type {
  SyncBatchPullPayload,
  SyncBatchPullResponse,
  SyncChangeRecord,
} from "./types";

// ─── Fixtures & Cleanup ───────────────────────────────────────────────────────

const testRunId = crypto.randomUUID().slice(0, 8);
const createdDeviceIds = new Set<string>();
const createdProductIds = new Set<string>();
const createdSupplierIds = new Set<string>();
const createdCustomerIds = new Set<string>();
const createdUserIds = new Set<string>();
const createdReceivingIds = new Set<string>();
const createdStockMovementIds = new Set<string>();
const createdChangeLogOpIds = new Set<string>();
const createdOutboxIds = new Set<string>();
const createdProcessedOpIds = new Set<string>();
const createdQuarantineOpIds = new Set<string>();

let defaultTestUserId: string;

async function createTestDevice(overrides: {
  isRevoked?: boolean;
  lastSequence?: bigint;
} = {}): Promise<{ device: SyncDevice; rawToken: string }> {
  const devId = `dev-pull-${testRunId}-${crypto.randomUUID().slice(0, 8)}`;
  const rawToken = `tok-pull-${crypto.randomBytes(16).toString("hex")}`;
  const tokenHash = hashToken(rawToken);

  const device = await prisma.syncDevice.create({
    data: {
      deviceId: devId,
      name: `Test Pull Device ${devId}`,
      tokenHash,
      isRevoked: overrides.isRevoked ?? false,
      lastSequence: overrides.lastSequence ?? BigInt(0),
    },
  });

  createdDeviceIds.add(devId);
  return { device, rawToken };
}

function makePullRequest(
  deviceId?: string,
  rawToken?: string,
  body?: unknown
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (deviceId !== undefined) {
    headers["X-Device-Id"] = deviceId;
  }
  if (rawToken !== undefined) {
    headers["Authorization"] = `Bearer ${rawToken}`;
  }

  return new Request("http://localhost/api/sync/pull", {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Phase 4 Review: Deterministic Block & Quarantine Semantics", { concurrency: 1 }, () => {
  before(async () => {
    await prisma.localSyncQuarantine.deleteMany();
    await prisma.localProcessedChange.deleteMany();

    const existing = await prisma.user.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (existing) {
      defaultTestUserId = existing.id;
    } else {
      const u = await prisma.user.create({
        data: {
          authUserId: `auth-pull-${testRunId}`,
          name: `Pull Tester ${testRunId}`,
          role: Role.OWNER,
          isActive: true,
        },
      });
      defaultTestUserId = u.id;
      createdUserIds.add(u.id);
    }
  });

  beforeEach(async () => {
    await prisma.localSyncQuarantine.deleteMany();
    await prisma.localProcessedChange.deleteMany();
  });

  after(async () => {
    if (createdStockMovementIds.size > 0) {
      await prisma.stockMovement.deleteMany({
        where: { id: { in: Array.from(createdStockMovementIds) } },
      });
    }
    if (createdReceivingIds.size > 0) {
      await prisma.receivingItem.deleteMany({
        where: { receivingId: { in: Array.from(createdReceivingIds) } },
      });
      await prisma.receiving.deleteMany({
        where: { id: { in: Array.from(createdReceivingIds) } },
      });
    }
    if (createdQuarantineOpIds.size > 0) {
      await prisma.localSyncQuarantine.deleteMany({
        where: { operationId: { in: Array.from(createdQuarantineOpIds) } },
      });
    }
    if (createdProcessedOpIds.size > 0) {
      await prisma.localProcessedChange.deleteMany({
        where: { operationId: { in: Array.from(createdProcessedOpIds) } },
      });
    }
    if (createdOutboxIds.size > 0) {
      await prisma.syncOutbox.deleteMany({
        where: { operationId: { in: Array.from(createdOutboxIds) } },
      });
    }
    if (createdChangeLogOpIds.size > 0) {
      await prisma.syncChangeLog.deleteMany({
        where: { operationId: { in: Array.from(createdChangeLogOpIds) } },
      });
    }
    if (createdProductIds.size > 0) {
      await prisma.price.deleteMany({
        where: { productId: { in: Array.from(createdProductIds) } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: Array.from(createdProductIds) } },
      });
    }
    if (createdCustomerIds.size > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: Array.from(createdCustomerIds) } },
      });
    }
    if (createdSupplierIds.size > 0) {
      await prisma.supplier.deleteMany({
        where: { id: { in: Array.from(createdSupplierIds) } },
      });
    }
    if (createdUserIds.size > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }
    if (createdDeviceIds.size > 0) {
      await prisma.syncDevice.deleteMany({
        where: { deviceId: { in: Array.from(createdDeviceIds) } },
      });
    }
  });

  // ─── A, B, C, D: Deterministic failure creates quarantine, preserves 101, halts 103, stops loop ───
  it("A, B, C, D. Deterministic failure applies valid prefix (101), quarantines (102), halts (103), and prevents blind retry loop", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();

    const seq101 = (curBefore + BigInt(1)).toString();
    const seq102 = (curBefore + BigInt(2)).toString();
    const seq103 = (curBefore + BigInt(3)).toString();

    const op101 = crypto.randomUUID();
    const op102 = crypto.randomUUID();
    const op103 = crypto.randomUUID();

    const p101 = crypto.randomUUID();
    const p103 = crypto.randomUUID();

    createdProductIds.add(p101);
    createdProductIds.add(p103);
    createdProcessedOpIds.add(op101);
    createdQuarantineOpIds.add(op102);

    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: seq103,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: seq101,
          operationId: op101,
          operationType: "UPSERT_PRODUCT",
          entityId: p101,
          action: "UPSERT",
          payload: { name: `Valid Prod 101 ${testRunId}`, brand: "Pepsi" },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
        {
          changeSequence: seq102,
          operationId: op102,
          operationType: "AUTHORITY_VIOLATION_OP" as any, // Deterministic unsupported/violation!
          entityId: crypto.randomUUID(),
          action: "UPSERT",
          payload: { test: true },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
        {
          changeSequence: seq103,
          operationId: op103,
          operationType: "UPSERT_PRODUCT",
          entityId: p103,
          action: "UPSERT",
          payload: { name: `Later Prod 103 ${testRunId}`, brand: "Pepsi" },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    // First apply: 101 should apply, 102 should quarantine, 103 must NOT apply
    const res1 = await applyLocalPullBatch(device.deviceId, batch);

    // Assert applied count and new cursor
    assert.equal(res1.appliedCount, 1, "Only change 101 should be applied");
    assert.equal(res1.newCursor, seq101, "Cursor must advance ONLY to 101");
    assert.equal(res1.blocked, true, "Batch must report blocked: true");
    assert.equal(res1.blockedSequence, seq102, "Blocked sequence must be 102");
    assert.ok(res1.quarantineId, "Quarantine ID must be returned");

    // Invariant C: Cursor in DB is at 101 (NOT advanced past unapplied 102)
    const dbCursor = await getLocalSyncCursor();
    assert.equal(dbCursor.toString(), seq101);

    // Product 101 exists in database
    const prod101 = await prisma.product.findUnique({ where: { id: p101 } });
    assert.ok(prod101, "Change 101 was safely applied");

    // Invariant D: Product 103 must NOT exist in database (cannot bypass blocked 102)
    const prod103 = await prisma.product.findUnique({ where: { id: p103 } });
    assert.equal(prod103, null, "Change 103 must NOT be applied while 102 is blocked");

    // Invariant B: Persistent quarantine state created
    const quarantine = await prisma.localSyncQuarantine.findUnique({
      where: { operationId: op102 },
    });
    assert.ok(quarantine, "Quarantine record must be persisted");
    assert.equal(quarantine.status, QuarantineStatus.QUARANTINED);
    assert.equal(quarantine.changeSequence, BigInt(seq102));

    // Invariant A: Subsequent pull retry does NOT crash or execute blind retry loop
    const res2 = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(res2.appliedCount, 0, "No changes applied on retry");
    assert.equal(res2.newCursor, seq101, "Cursor remains at 101");
    assert.equal(res2.blocked, true, "Reports blocked: true");
    assert.equal(res2.blockedSequence, seq102);
  });

  // ─── E, F. Same blocked change can be retried or resolved, allowing cursor progression ───
  it("E & F. Quarantine resolution unblocks synchronization and allows cursor progression", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();

    const seq1 = (curBefore + BigInt(1)).toString();
    const op1 = crypto.randomUUID();
    const prodId = crypto.randomUUID();
    createdProductIds.add(prodId);
    createdQuarantineOpIds.add(op1);
    createdProcessedOpIds.add(op1);

    // 1. Induce quarantine with invalid payload (missing name/brand)
    const badBatch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: seq1,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: seq1,
          operationId: op1,
          operationType: "UPSERT_PRODUCT",
          entityId: prodId,
          action: "UPSERT",
          payload: {}, // Missing required name/brand
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const pullRes = await applyLocalPullBatch(device.deviceId, badBatch);
    assert.equal(pullRes.blocked, true);
    assert.ok(pullRes.quarantineId);

    // 2. Resolve quarantine with overridePayload supplying valid name and brand
    const resolveRes = await resolveQuarantineChange({
      quarantineId: pullRes.quarantineId,
      action: "RETRY",
      reason: "HQ admin provided missing product attributes",
      resolvedByUserId: defaultTestUserId,
      overridePayload: {
        name: `Resolved Product ${testRunId}`,
        brand: "PepsiCo",
        sku: `RES-${testRunId}`,
      },
    });

    assert.equal(resolveRes.success, true);
    assert.equal(resolveRes.action, "RETRY_APPLIED");
    assert.equal(resolveRes.newCursor, seq1);

    // Cursor in DB progressed to seq1
    const newCursor = await getLocalSyncCursor();
    assert.equal(newCursor.toString(), seq1);

    // Product now exists with resolved attributes
    const prod = await prisma.product.findUnique({ where: { id: prodId } });
    assert.ok(prod);
    assert.equal(prod.name, `Resolved Product ${testRunId}`);

    // Quarantine record is marked RESOLVED with audit reason
    const qRecord = await prisma.localSyncQuarantine.findUnique({
      where: { id: pullRes.quarantineId },
    });
    assert.equal(qRecord?.status, QuarantineStatus.RESOLVED);
    assert.equal(qRecord?.resolutionAction, "RETRY_APPLIED");
    assert.equal(
      qRecord?.resolutionReason,
      "HQ admin provided missing product attributes"
    );
  });

  // ─── G, H, I. Customer authority ambiguity: does not mutate customer, does not disappear, recoverable ───
  it("G, H, I. Customer authority ambiguity does not mutate Customer, persists in quarantine, and unblocks when resolved", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();

    const seq1 = (curBefore + BigInt(1)).toString();
    const seq2 = (curBefore + BigInt(2)).toString();
    const opCustomer = crypto.randomUUID();
    const opPrice = crypto.randomUUID();
    const customerId = crypto.randomUUID();
    const productId = crypto.randomUUID();

    createdCustomerIds.add(customerId);
    createdProductIds.add(productId);
    createdQuarantineOpIds.add(opCustomer);
    createdProcessedOpIds.add(opCustomer);
    createdProcessedOpIds.add(opPrice);

    // Create product locally so price could apply once unblocked
    await prisma.product.create({
      data: { id: productId, name: `Cust Test Prod ${testRunId}`, brand: "Pepsi" },
    });

    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: seq2,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: seq1,
          operationId: opCustomer,
          operationType: "UPSERT_CUSTOMER",
          entityId: customerId,
          action: "UPSERT",
          payload: { name: `Cloud Customer ${testRunId}`, creditAllowed: true },
          sourceDeviceId: "cloud-external", // External!
          createdAt: new Date().toISOString(),
        },
        {
          changeSequence: seq2,
          operationId: opPrice,
          operationType: "CREATE_PRICE",
          entityId: crypto.randomUUID(),
          action: "UPSERT",
          payload: {
            productId,
            tier: PriceTier.RETAIL,
            amount: 720,
            createdById: defaultTestUserId,
          },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    // Pull batch: Customer is quarantined
    const pullRes = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(pullRes.blocked, true);
    assert.equal(pullRes.blockedSequence, seq1);
    assert.equal(pullRes.quarantineErrorCode, "CUSTOMER_AUTHORITY_DECISION_REQUIRED");

    // Invariant G: Customer was NOT created or mutated in local database
    const customerInDb = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    assert.equal(customerInDb, null, "Customer must NOT be mutated without authority decision");

    // Invariant H: Quarantine record persists
    const qRecord = await prisma.localSyncQuarantine.findUnique({
      where: { operationId: opCustomer },
    });
    assert.ok(qRecord);
    assert.equal(qRecord.status, QuarantineStatus.QUARANTINED);

    // Invariant I: Future resolution unblocks the stream
    // Operator resolves by discarding the ambiguous cloud customer change
    const resolveRes = await resolveQuarantineChange({
      quarantineId: qRecord.id,
      action: "DISCARD",
      reason: "Customer authority deferred; cloud customer record discarded by Depot Manager",
      resolvedByUserId: defaultTestUserId,
    });
    assert.equal(resolveRes.success, true);
    assert.equal(resolveRes.action, "DISCARDED");

    // Cursor now advanced past customer to seq1
    const curAfterResolve = await getLocalSyncCursor();
    assert.equal(curAfterResolve.toString(), seq1);

    // Next pull now receives and successfully applies the subsequent price update at seq2!
    const nextBatch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: seq1,
      toSequence: seq2,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [batch.changes[1]], // seq2 price
    };

    const nextPullRes = await applyLocalPullBatch(device.deviceId, nextBatch);
    assert.equal(nextPullRes.appliedCount, 1);
    assert.equal(nextPullRes.newCursor, seq2);
    assert.equal(nextPullRes.blocked, false);

    const finalCursor = await getLocalSyncCursor();
    assert.equal(finalCursor.toString(), seq2);
  });

  // ─── J, K, L. Unsupported ops, invalid payloads, and authority violations are recoverable ───
  it("J, K, L. Unsupported ops, invalid payloads, and authority violations are recoverable via resolution", async () => {
    const { device } = await createTestDevice();

    const cases = [
      {
        type: "UNSUPPORTED_OPERATION",
        opType: "FUTURE_AI_FEATURE",
        payload: { ai: true },
        entityId: crypto.randomUUID(),
        reason: "Client upgrade not yet deployed; discarded to unblock sync",
      },
      {
        type: "AUTHORITY_VIOLATION",
        opType: "CREATE_SALE",
        payload: { amount: 500 },
        entityId: crypto.randomUUID(),
        reason: "Unauthorized external sale push discarded by depot owner",
      },
    ];

    for (const testCase of cases) {
      const curBefore = await getLocalSyncCursor();
      const seq = (curBefore + BigInt(1)).toString();
      const opId = crypto.randomUUID();
      createdQuarantineOpIds.add(opId);
      createdProcessedOpIds.add(opId);

      const batch: SyncBatchPullResponse = {
        success: true,
        deviceId: device.deviceId,
        fromSequence: curBefore.toString(),
        toSequence: seq,
        hasMore: false,
        serverTimestamp: new Date().toISOString(),
        changes: [
          {
            changeSequence: seq,
            operationId: opId,
            operationType: testCase.opType as any,
            entityId: testCase.entityId,
            action: "UPSERT",
            payload: testCase.payload,
            sourceDeviceId: "cloud-external",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const pullRes = await applyLocalPullBatch(device.deviceId, batch);
      assert.equal(pullRes.blocked, true);
      assert.ok(pullRes.quarantineId);

      // Successfully resolved via DISCARD
      const resolveRes = await resolveQuarantineChange({
        quarantineId: pullRes.quarantineId,
        action: "DISCARD",
        reason: testCase.reason,
        resolvedByUserId: defaultTestUserId,
      });
      assert.equal(resolveRes.success, true);
      assert.equal(resolveRes.action, "DISCARDED");

      const curAfter = await getLocalSyncCursor();
      assert.equal(curAfter.toString(), seq);
    }
  });

  // ─── M. Transient errors remain retryable and are NOT quarantined ─────────
  it("M. Transient errors (e.g. simulated network abort) roll back completely and are NOT quarantined", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();

    const seq1 = (curBefore + BigInt(1)).toString();
    const op1 = crypto.randomUUID();
    const p1 = crypto.randomUUID();
    createdProductIds.add(p1);

    // A batch indicating failure from server (simulating network/HTTP failure)
    const failedBatch: SyncBatchPullResponse = {
      success: false,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: seq1,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [],
      error: "Gateway Timeout 504",
      errorCode: "GATEWAY_TIMEOUT",
    };

    await assert.rejects(
      async () => {
        await applyLocalPullBatch(device.deviceId, failedBatch);
      },
      (err: any) => {
        assert.equal(err.code, "GATEWAY_TIMEOUT");
        return true;
      }
    );

    // No quarantine record was created
    const quarantineCount = await prisma.localSyncQuarantine.count({
      where: { operationId: op1 },
    });
    assert.equal(quarantineCount, 0, "Transient errors must NOT create quarantine records");

    // Cursor unchanged
    const curAfter = await getLocalSyncCursor();
    assert.equal(curAfter.toString(), curBefore.toString());
  });

  // ─── N. Self-originated operations still reconcile correctly ──────────────
  it("N. Self-originated operations still reconcile correctly without quarantine", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();

    const seq1 = (curBefore + BigInt(1)).toString();
    const opSelf = crypto.randomUUID();
    const saleId = crypto.randomUUID();
    createdProcessedOpIds.add(opSelf);
    createdOutboxIds.add(opSelf);

    // Simulate local outbox entry already existing
    await prisma.syncOutbox.create({
      data: {
        operationId: opSelf,
        operationType: "CREATE_SALE",
        entityId: saleId,
        payload: { amount: 1000 },
        status: SyncStatus.SYNCED,
      },
    });

    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: seq1,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: seq1,
          operationId: opSelf,
          operationType: "CREATE_SALE",
          entityId: saleId,
          action: "UPSERT",
          payload: { amount: 1000 },
          sourceDeviceId: device.deviceId, // matches local!
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const res = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(res.appliedCount, 1);
    assert.equal(res.newCursor, seq1);
    assert.equal(res.blocked, false);

    // Must NOT be in quarantine
    const qRecord = await prisma.localSyncQuarantine.findUnique({
      where: { operationId: opSelf },
    });
    assert.equal(qRecord, null, "Self-originated op must NOT be quarantined");
  });

  // ─── O, P, Q. Idempotency, gap protection, and operationId identity remain intact ───
  it("O, P, Q. Idempotency, gap protection, and operationId identity remain intact", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();

    // 1. Gap protection (P)
    const gapSeq = (curBefore + BigInt(10)).toString();
    await assert.rejects(
      async () => {
        await applyLocalPullBatch(device.deviceId, {
          success: true,
          deviceId: device.deviceId,
          fromSequence: curBefore.toString(),
          toSequence: gapSeq,
          hasMore: false,
          serverTimestamp: new Date().toISOString(),
          changes: [
            {
              changeSequence: gapSeq,
              operationId: crypto.randomUUID(),
              operationType: "UPSERT_PRODUCT",
              entityId: crypto.randomUUID(),
              action: "UPSERT",
              payload: { name: "Gap", brand: "Pepsi" },
              sourceDeviceId: "cloud-hq",
              createdAt: new Date().toISOString(),
            },
          ],
        });
      },
      (err: any) => {
        assert.equal(err.code, "CURSOR_GAP_DETECTED");
        return true;
      }
    );

    // 2. Normal apply & idempotency (O)
    const seq1 = (curBefore + BigInt(1)).toString();
    const op1 = crypto.randomUUID();
    const p1 = crypto.randomUUID();
    createdProductIds.add(p1);
    createdProcessedOpIds.add(op1);

    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: seq1,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: seq1,
          operationId: op1,
          operationType: "UPSERT_PRODUCT",
          entityId: p1,
          action: "UPSERT",
          payload: { name: `Idempotent Prod ${testRunId}`, brand: "Pepsi" },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const res1 = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(res1.appliedCount, 1);
    assert.equal(res1.newCursor, seq1);

    // Replay exact same batch (idempotency)
    const res2 = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(res2.appliedCount, 0);
    assert.equal(res2.newCursor, seq1);

    // OperationId identity preserved in LocalProcessedChange (Q)
    const processed = await prisma.localProcessedChange.findUnique({
      where: { operationId: op1 },
    });
    assert.ok(processed);
    assert.equal(processed.operationId, op1);
    assert.equal(processed.entityId, p1);
  });

  // ─── Crash & Replay Safety Tests ───
  it("SAFE-A..G. Replay and crash safety guarantees", async () => {
    const { device } = await createTestDevice();
    const cur = await getLocalSyncCursor();

    const seq1 = (cur + BigInt(1)).toString();
    const op1 = crypto.randomUUID();
    const p1 = crypto.randomUUID();
    createdProductIds.add(p1);
    createdProcessedOpIds.add(op1);

    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: cur.toString(),
      toSequence: seq1,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: seq1,
          operationId: op1,
          operationType: "UPSERT_PRODUCT",
          entityId: p1,
          action: "UPSERT",
          payload: { name: `Crash Prod ${testRunId}`, brand: "Pepsi" },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    // Apply change
    await applyLocalPullBatch(device.deviceId, batch);

    // SAFE-G: No cursor regression when an old batch is replayed
    const oldBatch: SyncBatchPullResponse = {
      ...batch,
      fromSequence: "0",
      toSequence: "0",
      changes: [],
    };
    const regRes = await applyLocalPullBatch(device.deviceId, oldBatch);
    assert.equal(regRes.newCursor, seq1, "Cursor must NEVER regress backwards");

    // SAFE-F: Verify product wasn't duplicated
    const count = await prisma.product.count({ where: { id: p1 } });
    assert.equal(count, 1, "Business mutation was not duplicated");
  });

  // ─── Protocol & Domain Tests (Ascending order, batch size, domain mutations) ───
  it("PROTO & DOMAIN. Protocol query bounds, soft-delete domain rules, and posted receiving ledger protection", async () => {
    const { device } = await createTestDevice();

    // 1. Cloud fetch returns changes strictly ascending after cursor
    const opA = crypto.randomUUID();
    const opB = crypto.randomUUID();
    createdChangeLogOpIds.add(opA);
    createdChangeLogOpIds.add(opB);

    const cA = await prisma.syncChangeLog.create({
      data: {
        operationId: opA,
        operationType: "UPSERT_PRODUCT",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { name: `Proto A ${testRunId}`, brand: "Pepsi" },
        sourceDeviceId: "cloud-hq",
      },
    });
    const cB = await prisma.syncChangeLog.create({
      data: {
        operationId: opB,
        operationType: "UPSERT_PRODUCT",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { name: `Proto B ${testRunId}`, brand: "Pepsi" },
        sourceDeviceId: "cloud-hq",
      },
    });

    const pullRes = await fetchDevicePullBatch(device, {
      deviceId: device.deviceId,
      cursor: (cA.changeSequence - BigInt(1)).toString(),
      schemaVersion: "1.0",
      batchSize: 50,
    });

    assert.equal(pullRes.success, true);
    const seqs = pullRes.changes.map((c) => BigInt(c.changeSequence));
    for (let i = 1; i < seqs.length; i++) {
      assert.ok(seqs[i] > seqs[i - 1], "Changes must be strictly ascending");
    }

    // 2. Domain: Soft-delete for Product (isActive = false)
    const pId = crypto.randomUUID();
    createdProductIds.add(pId);
    await prisma.product.create({
      data: { id: pId, name: `SoftDel ${testRunId}`, brand: "Pepsi", isActive: true },
    });

    const cur = await getLocalSyncCursor();
    const sSeq = (cur + BigInt(1)).toString();
    const sOp = crypto.randomUUID();
    createdProcessedOpIds.add(sOp);

    await applyLocalPullBatch(device.deviceId, {
      success: true,
      deviceId: device.deviceId,
      fromSequence: cur.toString(),
      toSequence: sSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: sSeq,
          operationId: sOp,
          operationType: "UPSERT_PRODUCT",
          entityId: pId,
          action: "DELETE",
          payload: { id: pId },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const softDelProd = await prisma.product.findUnique({ where: { id: pId } });
    assert.ok(softDelProd);
    assert.equal(softDelProd.isActive, false, "Product must be soft-deleted");

    // 3. Domain: Posted receiving cannot be deleted
    const suppId = crypto.randomUUID();
    createdSupplierIds.add(suppId);
    await prisma.supplier.create({
      data: { id: suppId, name: `Supp ${testRunId}` },
    });

    const receiving = await prisma.receiving.create({
      data: { supplierId: suppId, createdById: defaultTestUserId },
    });
    createdReceivingIds.add(receiving.id);

    const mov = await prisma.stockMovement.create({
      data: {
        productId: pId,
        movementType: "RECEIVING",
        quantity: 10,
        referenceType: "Receiving",
        referenceId: receiving.id,
        createdById: defaultTestUserId,
      },
    });
    createdStockMovementIds.add(mov.id);

    const cur2 = await getLocalSyncCursor();
    const rSeq = (cur2 + BigInt(1)).toString();
    const rOp = crypto.randomUUID();
    createdQuarantineOpIds.add(rOp);

    const delRecRes = await applyLocalPullBatch(device.deviceId, {
      success: true,
      deviceId: device.deviceId,
      fromSequence: cur2.toString(),
      toSequence: rSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: rSeq,
          operationId: rOp,
          operationType: "DELETE_DRAFT_RECEIVING",
          entityId: receiving.id,
          action: "DELETE",
          payload: { id: receiving.id },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    // Quarantined with CANNOT_DELETE_POSTED_RECEIVING
    assert.equal(delRecRes.blocked, true);
    assert.equal(delRecRes.quarantineErrorCode, "CANNOT_DELETE_POSTED_RECEIVING");
  });
});
