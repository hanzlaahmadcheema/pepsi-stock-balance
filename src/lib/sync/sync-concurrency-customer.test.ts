/**
 * Phase 5 — Step 1: Sync Concurrency Hardening & Hybrid Customer Authority Integration Tests
 *
 * Covers all 20 scenarios required by Section E:
 *   1. Two simultaneous push attempts (alreadyRunning: true, no duplicate mutation)
 *   2. Two simultaneous pull attempts (alreadyRunning: true, cursor remains correct)
 *   3. Lock release after successful operation
 *   4. Lock release after handled error
 *   5. PostgreSQL session termination releases advisory lock
 *   6. No retry counter changes caused by lock contention
 *   7. No cursor changes caused by lock contention
 *   8. Cloud creates a new Customer profile locally
 *   9. Cloud updates an existing Customer profile locally
 *  10. Local creates/updates Customer profile and pushes to Cloud
 *  11. Same Customer UUID remains stable
 *  12. Duplicate operationId remains idempotent
 *  13. Customer profile sync does not modify Sale
 *  14. Customer profile sync does not modify Payment
 *  15. Customer profile sync does not modify ContainerMovement
 *  16. Customer balance remains derived from existing transactions
 *  17. Malformed Customer payload is quarantined
 *  18. Self-originated Customer operation reconciles without duplicate mutation
 *  19. Two different customer UUIDs are never silently merged
 *  20. Customer profile sync does not bypass existing authorization
 *
 * Run: npx tsx --test src/lib/sync/sync-concurrency-customer.test.ts
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../prisma";
import { hashToken } from "./server/authentication";
import { processDevicePushBatch } from "./server/push";
import {
  pushPendingOperations,
  SYNC_PUSH_ADVISORY_LOCK_ID,
} from "./client/push";
import {
  applyLocalPullBatch,
  getLocalSyncCursor,
  resolveQuarantineChange,
  SYNC_PULL_ADVISORY_LOCK_ID,
} from "./client/pull";
import { POST as pushRoutePost } from "../../app/api/sync/push/route";
import {
  PriceTier,
  Role,
  QuarantineStatus,
  SaleType,
  SaleStatus,
  PaymentMethod,
  ContainerType,
  ContainerMovementType,
  type SyncDevice,
} from "@prisma/client";
import type {
  SyncBatchPullResponse,
  SyncChangeRecord,
  SyncBatchPushResponse,
  SyncOperation,
} from "./types";

// ─── Fixtures & Tracking ──────────────────────────────────────────────────────

const testRunId = crypto.randomUUID().slice(0, 8);
const createdDeviceIds = new Set<string>();
const createdCustomerIds = new Set<string>();
const createdUserIds = new Set<string>();
const createdSaleIds = new Set<string>();
const createdPaymentIds = new Set<string>();
const createdContainerMovementIds = new Set<string>();
const createdOutboxIds = new Set<string>();
const createdProcessedOpIds = new Set<string>();
const createdQuarantineOpIds = new Set<string>();
const createdChangeLogOpIds = new Set<string>();

let defaultTestUserId: string;

async function createTestDevice(overrides: {
  isRevoked?: boolean;
  lastSequence?: bigint;
} = {}): Promise<{ device: SyncDevice; rawToken: string }> {
  const devId = `dev-p5-${testRunId}-${crypto.randomUUID().slice(0, 8)}`;
  const rawToken = `tok-p5-${crypto.randomBytes(16).toString("hex")}`;
  const tokenHash = hashToken(rawToken);

  const device = await prisma.syncDevice.create({
    data: {
      deviceId: devId,
      name: `Test P5 Device ${devId}`,
      tokenHash,
      isRevoked: overrides.isRevoked ?? false,
      lastSequence: overrides.lastSequence ?? BigInt(0),
    },
  });

  createdDeviceIds.add(devId);
  return { device, rawToken };
}

describe("Phase 5 Step 1: Concurrency Protection & Hybrid Customer Authority", { concurrency: 1 }, () => {
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
          authUserId: `auth-p5-${testRunId}`,
          name: `P5 Tester ${testRunId}`,
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
    if (createdContainerMovementIds.size > 0) {
      await prisma.containerMovement.deleteMany({
        where: { id: { in: Array.from(createdContainerMovementIds) } },
      });
    }
    if (createdPaymentIds.size > 0) {
      await prisma.payment.deleteMany({
        where: { id: { in: Array.from(createdPaymentIds) } },
      });
    }
    if (createdSaleIds.size > 0) {
      await prisma.sale.deleteMany({
        where: { id: { in: Array.from(createdSaleIds) } },
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
        where: { id: { in: Array.from(createdOutboxIds) } },
      });
    }
    if (createdChangeLogOpIds.size > 0) {
      await prisma.syncChangeLog.deleteMany({
        where: { operationId: { in: Array.from(createdChangeLogOpIds) } },
      });
    }
    if (createdCustomerIds.size > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: Array.from(createdCustomerIds) } },
      });
    }
    if (createdDeviceIds.size > 0) {
      await prisma.syncDevice.deleteMany({
        where: { deviceId: { in: Array.from(createdDeviceIds) } },
      });
    }
    if (createdUserIds.size > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }
  });

  // ─── 1. Two simultaneous push attempts ──────────────────────────────────────
  it("1. Two simultaneous push attempts return alreadyRunning and prevent duplicate work", async () => {
    const { device, rawToken } = await createTestDevice();

    let releaseLock: () => void = () => {};
    let bgTxPromise: Promise<unknown> = Promise.resolve();
    const lockAcquired = new Promise<void>((resolve) => {
      bgTxPromise = prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<{ acquired: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(${SYNC_PUSH_ADVISORY_LOCK_ID}) as acquired
          `;
          assert.equal(rows[0]?.acquired, true);
          resolve();
          await new Promise<void>((res) => {
            releaseLock = res;
          });
        },
        { timeout: 60000, maxWait: 20000 }
      );
    });

    await lockAcquired;

    try {
      // Concurrently try to push
      const pushRes = await pushPendingOperations("http://mock", device.deviceId, rawToken);
      assert.equal(pushRes.success, true);
      assert.equal(pushRes.alreadyRunning, true);
      assert.equal(pushRes.syncedCount, 0);
      assert.equal(pushRes.failedCount, 0);
    } finally {
      releaseLock();
      await bgTxPromise;
    }
  });

  // ─── 2. Two simultaneous pull attempts ──────────────────────────────────────
  it("2. Two simultaneous pull attempts return alreadyRunning and leave cursor correct", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();

    let releaseLock: () => void = () => {};
    let bgTxPromise: Promise<unknown> = Promise.resolve();
    const lockAcquired = new Promise<void>((resolve) => {
      bgTxPromise = prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<{ acquired: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(${SYNC_PULL_ADVISORY_LOCK_ID}) as acquired
          `;
          assert.equal(rows[0]?.acquired, true);
          resolve();
          await new Promise<void>((res) => {
            releaseLock = res;
          });
        },
        { timeout: 60000, maxWait: 20000 }
      );
    });

    await lockAcquired;

    try {
      const dummyBatch: SyncBatchPullResponse = {
        success: true,
        deviceId: device.deviceId,
        fromSequence: curBefore.toString(),
        toSequence: nextSeq,
        hasMore: false,
        serverTimestamp: new Date().toISOString(),
        changes: [
          {
            changeSequence: nextSeq,
            operationId: crypto.randomUUID(),
            operationType: "UPSERT_CUSTOMER",
            entityId: crypto.randomUUID(),
            action: "UPSERT",
            payload: { name: "Pull Contention Cust" },
            sourceDeviceId: "cloud-hq",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const pullRes = await applyLocalPullBatch(device.deviceId, dummyBatch);
      assert.equal(pullRes.alreadyRunning, true);
      assert.equal(pullRes.appliedCount, 0);
      assert.equal(pullRes.newCursor, curBefore.toString());
    } finally {
      releaseLock();
      await bgTxPromise;
    }

    const curAfter = await getLocalSyncCursor();
    assert.equal(curAfter.toString(), curBefore.toString());
  });

  // ─── 3. Lock release after successful operation ─────────────────────────────
  it("3. Lock release after successful operation allows subsequent run immediately", async () => {
    const { device, rawToken } = await createTestDevice();

    // Push with empty outbox succeeds
    const pushRes = await pushPendingOperations("http://mock", device.deviceId, rawToken);
    assert.equal(pushRes.success, true);
    assert.equal(pushRes.alreadyRunning, undefined);

    // Immediately verify lock can be acquired
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${SYNC_PUSH_ADVISORY_LOCK_ID}) as acquired
      `;
      assert.equal(rows[0]?.acquired, true, "Push lock must be released after commit");
    });
  });

  // ─── 4. Lock release after handled error ────────────────────────────────────
  it("4. Lock release after handled error releases cleanly without hanging", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();

    const badSeq = (curBefore + BigInt(10)).toString(); // Gap! Throws CURSOR_GAP_DETECTED
    const brokenBatch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: badSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: badSeq,
          operationId: crypto.randomUUID(),
          operationType: "UPSERT_CUSTOMER",
          entityId: crypto.randomUUID(),
          action: "UPSERT",
          payload: { name: "Fail Gap" },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    // Should throw due to sequence gap
    await assert.rejects(async () => {
      await applyLocalPullBatch(device.deviceId, brokenBatch);
    });

    // Verify pull lock was released despite the error
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${SYNC_PULL_ADVISORY_LOCK_ID}) as acquired
      `;
      assert.equal(rows[0]?.acquired, true, "Pull lock must be released after rollback");
    });
  });

  // ─── 5. PostgreSQL session termination releases advisory lock ───────────────
  it("5. PostgreSQL transaction abort/termination auto-releases transaction advisory lock", async () => {
    try {
      await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ acquired: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${SYNC_PUSH_ADVISORY_LOCK_ID}) as acquired
        `;
        assert.equal(rows[0]?.acquired, true);
        throw new Error("Simulated sudden abort / process termination");
      });
    } catch (err: any) {
      assert.equal(err.message, "Simulated sudden abort / process termination");
    }

    // Following transaction verifies lock is free
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${SYNC_PUSH_ADVISORY_LOCK_ID}) as acquired
      `;
      assert.equal(rows[0]?.acquired, true, "Transaction lock must auto-release on abort");
    });
  });

  // ─── 6. No retry counter changes caused by lock contention ──────────────────
  it("6. No retry counter changes caused by lock contention", async () => {
    const { device, rawToken } = await createTestDevice();

    const opId = crypto.randomUUID();
    const outbox = await prisma.syncOutbox.create({
      data: {
        operationId: opId,
        operationType: "UPSERT_CUSTOMER",
        entityId: crypto.randomUUID(),
        payload: { name: `Lock Test ${testRunId}` },
        status: "PENDING",
        retryCount: 0,
      },
    });
    createdOutboxIds.add(outbox.id);

    let releaseLock: () => void = () => {};
    let bgTxPromise: Promise<unknown> = Promise.resolve();
    const lockAcquired = new Promise<void>((resolve) => {
      bgTxPromise = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${SYNC_PUSH_ADVISORY_LOCK_ID})`;
          resolve();
          await new Promise<void>((res) => {
            releaseLock = res;
          });
        },
        { timeout: 60000, maxWait: 20000 }
      );
    });

    await lockAcquired;

    try {
      const pushRes = await pushPendingOperations("http://mock", device.deviceId, rawToken);
      assert.equal(pushRes.alreadyRunning, true);
    } finally {
      releaseLock();
      await bgTxPromise;
    }

    // Verify outbox row: retryCount is STILL 0 and status is STILL PENDING
    const outboxRow = await prisma.syncOutbox.findUniqueOrThrow({ where: { id: outbox.id } });
    assert.equal(outboxRow.retryCount, 0, "retryCount must NOT be incremented by lock contention");
    assert.equal(outboxRow.status, "PENDING", "status must remain PENDING");
  });

  // ─── 7. No cursor changes caused by lock contention ─────────────────────────
  it("7. No cursor changes caused by lock contention", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();

    let releaseLock: () => void = () => {};
    let bgTxPromise: Promise<unknown> = Promise.resolve();
    const lockAcquired = new Promise<void>((resolve) => {
      bgTxPromise = prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${SYNC_PULL_ADVISORY_LOCK_ID})`;
          resolve();
          await new Promise<void>((res) => {
            releaseLock = res;
          });
        },
        { timeout: 60000, maxWait: 20000 }
      );
    });

    await lockAcquired;

    try {
      const batch: SyncBatchPullResponse = {
        success: true,
        deviceId: device.deviceId,
        fromSequence: curBefore.toString(),
        toSequence: nextSeq,
        hasMore: false,
        serverTimestamp: new Date().toISOString(),
        changes: [
          {
            changeSequence: nextSeq,
            operationId: crypto.randomUUID(),
            operationType: "UPSERT_CUSTOMER",
            entityId: crypto.randomUUID(),
            action: "UPSERT",
            payload: { name: "Contention Cursor Test" },
            sourceDeviceId: "cloud-hq",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      const pullRes = await applyLocalPullBatch(device.deviceId, batch);
      assert.equal(pullRes.alreadyRunning, true);
    } finally {
      releaseLock();
      await bgTxPromise;
    }

    const curAfter = await getLocalSyncCursor();
    assert.equal(curAfter.toString(), curBefore.toString(), "SyncCursor must remain unchanged on lock contention");
  });

  // ─── 8. Cloud creates a new Customer profile locally ────────────────────────
  it("8. Cloud creates a new Customer profile locally with non-financial fields", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();
    const customerId = crypto.randomUUID();
    const opId = crypto.randomUUID();

    createdCustomerIds.add(customerId);
    createdProcessedOpIds.add(opId);

    const change: SyncChangeRecord = {
      changeSequence: nextSeq,
      operationId: opId,
      operationType: "UPSERT_CUSTOMER",
      entityId: customerId,
      action: "UPSERT",
      payload: {
        id: customerId,
        name: `Cloud Created Cust ${testRunId}`,
        phone: "+923001234567",
        address: "Depot Road Sector 4",
        priceTier: PriceTier.WHOLESALE,
        creditAllowed: true,
        isActive: true,
      },
      sourceDeviceId: "cloud-hq",
      createdAt: new Date().toISOString(),
    };

    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: nextSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [change],
    };

    const pullRes = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(pullRes.appliedCount, 1);
    assert.equal(pullRes.newCursor, nextSeq);
    assert.equal(pullRes.blocked, false);

    const created = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(created.name, `Cloud Created Cust ${testRunId}`);
    assert.equal(created.phone, "+923001234567");
    assert.equal(created.address, "Depot Road Sector 4");
    assert.equal(created.priceTier, PriceTier.WHOLESALE);
    assert.equal(created.creditAllowed, true);
    assert.equal(created.isActive, true);

    const proc = await prisma.localProcessedChange.findUnique({ where: { operationId: opId } });
    assert.ok(proc);
  });

  // ─── 9. Cloud updates an existing Customer profile locally ──────────────────
  it("9. Cloud updates an existing Customer profile locally", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Original Cust ${testRunId}`,
        phone: "111",
        address: "Old Address",
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
      },
    });

    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();
    const opId = crypto.randomUUID();
    createdProcessedOpIds.add(opId);

    const change: SyncChangeRecord = {
      changeSequence: nextSeq,
      operationId: opId,
      operationType: "UPSERT_CUSTOMER",
      entityId: customerId,
      action: "UPSERT",
      payload: {
        id: customerId,
        name: `Updated Cust ${testRunId}`,
        phone: "222",
        address: "New Address Boulevard",
        priceTier: PriceTier.WHOLESALE,
        creditAllowed: true,
      },
      sourceDeviceId: "cloud-hq",
      createdAt: new Date().toISOString(),
    };

    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: nextSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [change],
    };

    const pullRes = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(pullRes.appliedCount, 1);

    const updated = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(updated.name, `Updated Cust ${testRunId}`);
    assert.equal(updated.phone, "222");
    assert.equal(updated.address, "New Address Boulevard");
    assert.equal(updated.priceTier, PriceTier.WHOLESALE);
    assert.equal(updated.creditAllowed, true);
  });

  // ─── 10. Local creates/updates Customer profile and pushes to Cloud ─────────
  it("10. Local creates/updates Customer profile and pushes to Cloud", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const opId = crypto.randomUUID();
    createdCustomerIds.add(customerId);
    createdChangeLogOpIds.add(opId);

    const op: SyncOperation = {
      operationId: opId,
      clientSequence: "1",
      operationType: "UPSERT_CUSTOMER",
      entityId: customerId,
      payload: {
        name: `Depot Pushed Cust ${testRunId}`,
        phone: "333",
        priceTier: PriceTier.KEY_ACCOUNT,
        creditAllowed: true,
      },
      clientCreatedAt: new Date().toISOString(),
    };

    const cloudPushRes = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(cloudPushRes.success, true);
    assert.deepEqual(cloudPushRes.acknowledgedOperationIds, [opId]);

    // Check Cloud DB: Customer exists with matching fields
    const cloudCust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cloudCust.name, `Depot Pushed Cust ${testRunId}`);
    assert.equal(cloudCust.phone, "333");
    assert.equal(cloudCust.priceTier, PriceTier.KEY_ACCOUNT);
    assert.equal(cloudCust.creditAllowed, true);

    // Check SyncChangeLog
    const changeLog = await prisma.syncChangeLog.findUnique({ where: { operationId: opId } });
    assert.ok(changeLog);
    assert.equal(changeLog.sourceDeviceId, device.deviceId);
  });

  // ─── 11. Same Customer UUID remains stable ──────────────────────────────────
  it("11. Same Customer UUID remains stable across push and pull", async () => {
    const { device } = await createTestDevice();
    const stableUUID = crypto.randomUUID();
    const opPush = crypto.randomUUID();
    const opPull = crypto.randomUUID();
    createdCustomerIds.add(stableUUID);
    createdChangeLogOpIds.add(opPush);
    createdProcessedOpIds.add(opPull);

    // Push with stableUUID
    const op: SyncOperation = {
      operationId: opPush,
      clientSequence: "1",
      operationType: "UPSERT_CUSTOMER",
      entityId: stableUUID,
      payload: { name: `Stable UUID Cust ${testRunId}` },
      clientCreatedAt: new Date().toISOString(),
    };
    await processDevicePushBatch(device, crypto.randomUUID(), [op]);

    // Pull with stableUUID
    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();
    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: nextSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: nextSeq,
          operationId: opPull,
          operationType: "UPSERT_CUSTOMER",
          entityId: stableUUID,
          action: "UPSERT",
          payload: { name: `Stable UUID Cust Pulled ${testRunId}` },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    await applyLocalPullBatch(device.deviceId, batch);

    const cust = await prisma.customer.findUnique({ where: { id: stableUUID } });
    assert.ok(cust);
    assert.equal(cust.id, stableUUID, "UUID must remain strictly identical");
  });

  // ─── 12. Duplicate operationId remains idempotent ───────────────────────────
  it("12. Duplicate operationId remains idempotent", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const opId = crypto.randomUUID();
    createdCustomerIds.add(customerId);
    createdProcessedOpIds.add(opId);

    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();

    const change: SyncChangeRecord = {
      changeSequence: nextSeq,
      operationId: opId,
      operationType: "UPSERT_CUSTOMER",
      entityId: customerId,
      action: "UPSERT",
      payload: { name: `Idempotent Cust ${testRunId}` },
      sourceDeviceId: "cloud-hq",
      createdAt: new Date().toISOString(),
    };

    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: nextSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [change],
    };

    // First apply
    const res1 = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(res1.appliedCount, 1);

    // Replay exact same change (e.g. re-pull or replay)
    const res2 = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(res2.appliedCount, 0, "Duplicate operationId must be skipped safely");
    assert.equal(res2.blocked, false);
  });

  // ─── 13. Customer profile sync does not modify Sale ─────────────────────────
  it("13. Customer profile sync does not modify Sale records", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const saleId = crypto.randomUUID();
    createdCustomerIds.add(customerId);
    createdSaleIds.add(saleId);

    await prisma.customer.create({
      data: { id: customerId, name: `Sale Cust ${testRunId}` },
    });

    const sale = await prisma.sale.create({
      data: {
        id: saleId,
        invoiceNumber: `INV-${testRunId}-13`,
        customerId,
        saleType: SaleType.RETAIL,
        status: SaleStatus.COMPLETED,
        subtotal: 1000,
        totalAmount: 1000,
        paidAmount: 1000,
        createdById: defaultTestUserId,
      },
    });

    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();
    const opId = crypto.randomUUID();
    createdProcessedOpIds.add(opId);

    // Pull update for Customer
    await applyLocalPullBatch(device.deviceId, {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: nextSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: nextSeq,
          operationId: opId,
          operationType: "UPSERT_CUSTOMER",
          entityId: customerId,
          action: "UPSERT",
          payload: { name: `Renamed Cust ${testRunId}`, address: "Changed Street" },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const saleAfter = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    assert.equal(saleAfter.totalAmount.toNumber(), 1000);
    assert.equal(saleAfter.customerId, customerId);
    assert.equal(saleAfter.updatedAt.getTime(), sale.updatedAt.getTime(), "Sale must remain untouched");
  });

  // ─── 14. Customer profile sync does not modify Payment ──────────────────────
  it("14. Customer profile sync does not modify Payment records", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    createdCustomerIds.add(customerId);
    createdPaymentIds.add(paymentId);

    await prisma.customer.create({
      data: { id: customerId, name: `Payment Cust ${testRunId}` },
    });

    const payment = await prisma.payment.create({
      data: {
        id: paymentId,
        customerId,
        amount: 450,
        paymentMethod: PaymentMethod.CASH,
        receivedById: defaultTestUserId,
      },
    });

    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();
    const opId = crypto.randomUUID();
    createdProcessedOpIds.add(opId);

    await applyLocalPullBatch(device.deviceId, {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: nextSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: nextSeq,
          operationId: opId,
          operationType: "UPSERT_CUSTOMER",
          entityId: customerId,
          action: "UPSERT",
          payload: { phone: "999888777" },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const paymentAfter = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assert.equal(paymentAfter.amount.toNumber(), 450);
    assert.equal(paymentAfter.customerId, customerId);
  });

  // ─── 15. Customer profile sync does not modify ContainerMovement ────────────
  it("15. Customer profile sync does not modify ContainerMovement records", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const cmId = crypto.randomUUID();
    createdCustomerIds.add(customerId);
    createdContainerMovementIds.add(cmId);

    await prisma.customer.create({
      data: { id: customerId, name: `CM Cust ${testRunId}` },
    });

    await prisma.containerMovement.create({
      data: {
        id: cmId,
        customerId,
        containerType: ContainerType.PLASTIC_CRATE,
        movementType: ContainerMovementType.DEBIT,
        quantity: 15,
        createdById: defaultTestUserId,
      },
    });

    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();
    const opId = crypto.randomUUID();
    createdProcessedOpIds.add(opId);

    await applyLocalPullBatch(device.deviceId, {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: nextSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: nextSeq,
          operationId: opId,
          operationType: "UPSERT_CUSTOMER",
          entityId: customerId,
          action: "UPSERT",
          payload: { address: "CM Address New" },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const cmAfter = await prisma.containerMovement.findUniqueOrThrow({ where: { id: cmId } });
    assert.equal(cmAfter.quantity, 15);
    assert.equal(cmAfter.customerId, customerId);
  });

  // ─── 16. Customer balance remains derived from existing transactions ────────
  it("16. Customer balance remains dynamically derived and untouched by sync", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const saleId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    createdCustomerIds.add(customerId);
    createdSaleIds.add(saleId);
    createdPaymentIds.add(paymentId);

    await prisma.customer.create({
      data: { id: customerId, name: `Balance Cust ${testRunId}` },
    });

    // Sale of 1000 with 0 paid upfront -> credit 1000
    await prisma.sale.create({
      data: {
        id: saleId,
        invoiceNumber: `INV-BAL-${testRunId}`,
        customerId,
        saleType: SaleType.RETAIL,
        status: SaleStatus.COMPLETED,
        subtotal: 1000,
        totalAmount: 1000,
        paidAmount: 0,
        creditAmount: 1000,
        createdById: defaultTestUserId,
      },
    });

    // Payment of 300
    await prisma.payment.create({
      data: {
        id: paymentId,
        customerId,
        amount: 300,
        paymentMethod: PaymentMethod.CASH,
        receivedById: defaultTestUserId,
      },
    });

    // Derived balance calculation helper
    async function getDerivedBalance(cid: string) {
      const sales = await prisma.sale.aggregate({
        where: { customerId: cid, status: "COMPLETED" },
        _sum: { totalAmount: true },
      });
      const payments = await prisma.payment.aggregate({
        where: { customerId: cid },
        _sum: { amount: true },
      });
      const billed = sales._sum.totalAmount?.toNumber() ?? 0;
      const paid = payments._sum.amount?.toNumber() ?? 0;
      return billed - paid;
    }

    const balBefore = await getDerivedBalance(customerId);
    assert.equal(balBefore, 700, "Derived balance must be 1000 - 300 = 700");

    // Pull customer profile update
    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();
    const opId = crypto.randomUUID();
    createdProcessedOpIds.add(opId);

    await applyLocalPullBatch(device.deviceId, {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: nextSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: nextSeq,
          operationId: opId,
          operationType: "UPSERT_CUSTOMER",
          entityId: customerId,
          action: "UPSERT",
          payload: { name: `Balance Cust Renamed ${testRunId}` },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const balAfter = await getDerivedBalance(customerId);
    assert.equal(balAfter, 700, "Derived balance must remain exactly 700 after customer profile sync");
  });

  // ─── 17. Malformed Customer payload is quarantined ──────────────────────────
  it("17. Malformed Customer payload is quarantined without advancing cursor", async () => {
    const { device } = await createTestDevice();
    const curBefore = await getLocalSyncCursor();
    const badSeq = (curBefore + BigInt(1)).toString();
    const opId = crypto.randomUUID();
    const customerId = crypto.randomUUID();

    createdQuarantineOpIds.add(opId);

    const badChange: SyncChangeRecord = {
      changeSequence: badSeq,
      operationId: opId,
      operationType: "UPSERT_CUSTOMER",
      entityId: customerId,
      action: "UPSERT",
      payload: { name: "   " }, // Empty name after trim -> INVALID_PAYLOAD
      sourceDeviceId: "cloud-hq",
      createdAt: new Date().toISOString(),
    };

    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: badSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [badChange],
    };

    const pullRes = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(pullRes.blocked, true);
    assert.equal(pullRes.blockedSequence, badSeq);
    assert.equal(pullRes.quarantineErrorCode, "INVALID_PAYLOAD");

    // Quarantine row exists
    const qRow = await prisma.localSyncQuarantine.findUnique({ where: { operationId: opId } });
    assert.ok(qRow);
    assert.equal(qRow.status, QuarantineStatus.QUARANTINED);

    // SyncCursor did NOT advance
    const curAfter = await getLocalSyncCursor();
    assert.equal(curAfter.toString(), curBefore.toString());
  });

  // ─── 18. Self-originated Customer operation reconciles ──────────────────────
  it("18. Self-originated Customer operation reconciles without duplicate mutation", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const opId = crypto.randomUUID();
    createdCustomerIds.add(customerId);
    createdProcessedOpIds.add(opId);

    await prisma.customer.create({
      data: { id: customerId, name: `Depot Cust ${testRunId}` },
    });

    const outbox = await prisma.syncOutbox.create({
      data: {
        operationId: opId,
        operationType: "UPSERT_CUSTOMER",
        entityId: customerId,
        payload: { name: `Depot Cust ${testRunId}` },
        status: "SYNCED",
      },
    });
    createdOutboxIds.add(outbox.id);

    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();

    // Pull change coming back with same sourceDeviceId
    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: nextSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: nextSeq,
          operationId: opId,
          operationType: "UPSERT_CUSTOMER",
          entityId: customerId,
          action: "UPSERT",
          payload: { name: `Different Name In Transit` },
          sourceDeviceId: device.deviceId, // Self-originated!
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const pullRes = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(pullRes.appliedCount, 1);
    assert.equal(pullRes.blocked, false);

    // Mutation was safely skipped for self-originated change
    const custInDb = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(custInDb.name, `Depot Cust ${testRunId}`, "Self-originated change reconciles without mutation");

    // LocalProcessedChange recorded
    const proc = await prisma.localProcessedChange.findUnique({ where: { operationId: opId } });
    assert.ok(proc);
  });

  // ─── 19. Two different customer UUIDs are never silently merged ─────────────
  it("19. Two different customer UUIDs with identical names are never merged", async () => {
    const { device } = await createTestDevice();
    const uuidA = crypto.randomUUID();
    const uuidB = crypto.randomUUID();
    const opA = crypto.randomUUID();
    const opB = crypto.randomUUID();

    createdCustomerIds.add(uuidA);
    createdCustomerIds.add(uuidB);
    createdProcessedOpIds.add(opA);
    createdProcessedOpIds.add(opB);

    const curBefore = await getLocalSyncCursor();
    const seqA = (curBefore + BigInt(1)).toString();
    const seqB = (curBefore + BigInt(2)).toString();

    const batch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: curBefore.toString(),
      toSequence: seqB,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: seqA,
          operationId: opA,
          operationType: "UPSERT_CUSTOMER",
          entityId: uuidA,
          action: "UPSERT",
          payload: { name: "Identical Depot Customer", phone: "111-AAA" },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
        {
          changeSequence: seqB,
          operationId: opB,
          operationType: "UPSERT_CUSTOMER",
          entityId: uuidB,
          action: "UPSERT",
          payload: { name: "Identical Depot Customer", phone: "222-BBB" },
          sourceDeviceId: "cloud-hq",
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const pullRes = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(pullRes.appliedCount, 2);

    const custA = await prisma.customer.findUniqueOrThrow({ where: { id: uuidA } });
    const custB = await prisma.customer.findUniqueOrThrow({ where: { id: uuidB } });

    assert.equal(custA.phone, "111-AAA");
    assert.equal(custB.phone, "222-BBB");
    assert.notEqual(custA.id, custB.id, "Different customer UUIDs must remain distinct rows");
  });

  // ─── 20. Customer profile sync does not bypass existing authorization ───────
  it("20. Customer profile sync push rejects unauthorized/revoked device", async () => {
    const { device: revokedDev, rawToken: revokedToken } = await createTestDevice({
      isRevoked: true,
    });

    const opId = crypto.randomUUID();
    const custId = crypto.randomUUID();

    const body = {
      deviceId: revokedDev.deviceId,
      operations: [
        {
          operationId: opId,
          clientSequence: 1,
          operationType: "UPSERT_CUSTOMER",
          entityId: custId,
          payload: { name: "Revoked Push Customer" },
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const req = new Request("http://localhost/api/sync/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": revokedDev.deviceId,
        Authorization: `Bearer ${revokedToken}`,
      },
      body: JSON.stringify(body),
    });

    const res = await pushRoutePost(req);
    assert.equal(res.status, 403, "Revoked device push must return 403 Forbidden");

    const custInDb = await prisma.customer.findUnique({ where: { id: custId } });
    assert.equal(custInDb, null, "Unauthorized push must never write to database");
  });
});
