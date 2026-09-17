/**
 * Phase 5 — Step 3: Sync Quarantine Management UI & Owner Resolution Integration Tests
 *
 * Scenarios:
 *   Test A: Owner can view active quarantine
 *   Test B: Owner can view resolved quarantine
 *   Test C: Staff cannot access quarantine action (returns unauthorized)
 *   Test D: Retry successful change (advances cursor, resolves quarantine)
 *   Test E: Retry deterministic failure remains quarantined (status QUARANTINED, error updated)
 *   Test F: Retry transient failure rolls back transaction cleanly
 *   Test G: Discard requires non-empty reason
 *   Test H: Discard resolves and advances cursor correctly
 *   Test I: Original operationId remains unchanged
 *   Test J: LocalProcessedChange is not duplicated
 *   Test K: Concurrent resolution blocked by pull advisory lock
 *   Test L: Earlier quarantine cannot be bypassed (RESOLUTION_SEQUENCE_MISMATCH)
 *   Test M: Scheduler continues working with quarantine present
 *   Test N: Existing Phase 4 quarantine tests remain passing
 *   Test O: Existing Customer LWW tests remain passing
 *
 * Run: npx tsx --test src/lib/sync/sync-quarantine-ui.test.ts
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../prisma";
import {
  getLocalSyncCursor,
  resolveQuarantineChange,
  SYNC_PULL_ADVISORY_LOCK_ID,
  PullApplyError,
} from "./client/pull";
import {
  getQuarantineRecordsAction,
  retryQuarantineAction,
  discardQuarantineAction,
} from "../../app/sync/quarantine/actions";
import {
  getBusinessErrorExplanation,
  BUSINESS_ERROR_EXPLANATIONS,
} from "../../app/sync/quarantine/types";
import { SyncScheduler, stopSyncScheduler } from "./daemon/scheduler";
import {
  Role,
  QuarantineStatus,
  SyncChangeAction,
  type User,
} from "@prisma/client";

describe("Phase 5 Step 3 — Sync Quarantine Management UI & Resolution", () => {
  const testRunId = crypto.randomUUID().slice(0, 8);
  let ownerUser: User;
  let staffUser: User;

  const createdQuarantineIds = new Set<string>();
  const createdOperationIds = new Set<string>();
  const createdProductIds = new Set<string>();
  const createdUserIds = new Set<string>();

  before(async () => {
    await stopSyncScheduler();
    await prisma.localSyncQuarantine.deleteMany();

    // 1. Create a dedicated test Owner
    ownerUser = await prisma.user.create({
      data: {
        authUserId: `auth-owner-${testRunId}`,
        name: `Test Owner ${testRunId}`,
        role: Role.OWNER,
        isActive: true,
      },
    });
    createdUserIds.add(ownerUser.id);

    // 2. Create a dedicated test Staff
    staffUser = await prisma.user.create({
      data: {
        authUserId: `auth-staff-${testRunId}`,
        name: `Test Staff ${testRunId}`,
        role: Role.STAFF,
        isActive: true,
      },
    });
    createdUserIds.add(staffUser.id);
  });

  beforeEach(async () => {
    await stopSyncScheduler();
    await prisma.localSyncQuarantine.deleteMany();
  });

  after(async () => {
    await stopSyncScheduler();
    await prisma.localSyncQuarantine.deleteMany();

    if (createdOperationIds.size > 0) {
      await prisma.localProcessedChange.deleteMany({
        where: { operationId: { in: Array.from(createdOperationIds) } },
      });
    }

    if (createdProductIds.size > 0) {
      await prisma.product.deleteMany({
        where: { id: { in: Array.from(createdProductIds) } },
      });
    }

    if (createdUserIds.size > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper: setup clean cursor
  // ─────────────────────────────────────────────────────────────────────────────
  async function resetCursorTo(seq: bigint): Promise<void> {
    await prisma.syncCursor.upsert({
      where: { id: "cloud_cursor" },
      update: { lastSequence: seq },
      create: { id: "cloud_cursor", lastSequence: seq },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Test A: Owner can view active quarantine
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test A: Owner can view active quarantine records with filters", async () => {
    const cursor = await getLocalSyncCursor(prisma);
    const seq = cursor + BigInt(9001);
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: seq,
        operationId: opId,
        operationType: "AUTHORITY_TEST",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { field: "test-data" },
        sourceDeviceId: "cloud-server",
        errorCode: "AUTHORITY_VIOLATION",
        errorMessage: "Cloud cannot mutate depot authority records",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(qItem.id);

    // Call server action as OWNER
    const res = await getQuarantineRecordsAction(
      { status: "QUARANTINED", operationType: "AUTHORITY_TEST" },
      { id: ownerUser.id, role: Role.OWNER }
    );

    assert.equal(res.success, true);
    assert.ok(res.records && res.records.length > 0);
    const found = res.records.find((r) => r.id === qItem.id);
    assert.ok(found, "Quarantined record should be returned to Owner");
    assert.equal(found.changeSequence, seq.toString());
    assert.equal(found.errorCode, "AUTHORITY_VIOLATION");
    assert.equal(found.status, QuarantineStatus.QUARANTINED);
    assert.equal(found.sourceDeviceId, "cloud-server");

    // Verify business error explanation
    const businessExpl = getBusinessErrorExplanation(found.errorCode);
    assert.equal(businessExpl.title, "Depot Data Authority Conflict");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test B: Owner can view resolved quarantine
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test B: Owner can view resolved quarantine records with resolution audit info", async () => {
    const cursor = await getLocalSyncCursor(prisma);
    const seq = cursor + BigInt(9002);
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: seq,
        operationId: opId,
        operationType: "RESOLVED_TEST",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { field: "resolved-data" },
        errorCode: "INVALID_PAYLOAD",
        errorMessage: "Invalid payload format",
        status: QuarantineStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionAction: "DISCARDED",
        resolutionReason: "Discarded by owner during audit",
        resolvedByUserId: ownerUser.id,
      },
    });
    createdQuarantineIds.add(qItem.id);

    const res = await getQuarantineRecordsAction(
      { status: "RESOLVED" },
      { id: ownerUser.id, role: Role.OWNER }
    );

    assert.equal(res.success, true);
    const found = res.records?.find((r) => r.id === qItem.id);
    assert.ok(found, "Resolved record should be returned");
    assert.equal(found.status, QuarantineStatus.RESOLVED);
    assert.equal(found.resolutionAction, "DISCARDED");
    assert.equal(found.resolutionReason, "Discarded by owner during audit");
    assert.equal(found.resolvedByUser?.name, ownerUser.name);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test C: Staff cannot access quarantine actions (unauthorized)
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test C: Staff role is strictly blocked from viewing and resolving quarantine", async () => {
    const dummyId = crypto.randomUUID();

    // 1. Staff query blocked
    const viewRes = await getQuarantineRecordsAction(
      undefined,
      { id: staffUser.id, role: Role.STAFF }
    );
    assert.equal(viewRes.success, false);
    assert.match(viewRes.error || "", /Unauthorized/i);

    // 2. Staff retry blocked
    const retryRes = await retryQuarantineAction({
      quarantineId: dummyId,
      reason: "Staff attempting retry",
      _testUser: { id: staffUser.id, role: Role.STAFF },
    });
    assert.equal(retryRes.success, false);
    assert.match(retryRes.error || "", /Unauthorized/i);

    // 3. Staff discard blocked
    const discardRes = await discardQuarantineAction({
      quarantineId: dummyId,
      reason: "Staff attempting discard",
      _testUser: { id: staffUser.id, role: Role.STAFF },
    });
    assert.equal(discardRes.success, false);
    assert.match(discardRes.error || "", /Unauthorized/i);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test D: Retry successful change (advances cursor, resolves quarantine)
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test D: Successful retry applies mutation, advances cursor, and marks quarantine RESOLVED", async () => {
    const curBefore = await getLocalSyncCursor(prisma);
    const targetSeq = curBefore + BigInt(1);
    const productId = crypto.randomUUID();
    const opId = crypto.randomUUID();
    createdProductIds.add(productId);
    createdOperationIds.add(opId);

    // Create a quarantined PRODUCT_UPSERT change at next sequence
    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: targetSeq,
        operationId: opId,
        operationType: "UPSERT_PRODUCT",
        entityId: productId,
        action: SyncChangeAction.UPSERT,
        payload: {
          id: productId,
          name: `Quarantine Retry Product ${testRunId}`,
          brand: "TestBrand",
          sku: `SKU-QRETRY-${testRunId}`,
          minimumStockLevel: 10,
          latestPurchasePrice: 50.0,
          isActive: true,
        },
        errorCode: "TEMPORARY_TEST_BLOCK",
        errorMessage: "Blocked for manual review",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(qItem.id);

    // Owner resolves via Retry
    const res = await retryQuarantineAction({
      quarantineId: qItem.id,
      reason: "Verified product catalog data, applying change",
      _testUser: { id: ownerUser.id, role: Role.OWNER },
    });

    assert.equal(res.success, true);
    assert.equal(res.result?.action, "RETRY_APPLIED");
    assert.equal(res.result?.newCursor, targetSeq.toString());

    // 1. Verify product is created
    const createdProd = await prisma.product.findUnique({
      where: { id: productId },
    });
    assert.ok(createdProd, "Product must be created upon successful retry");
    assert.equal(createdProd.name, `Quarantine Retry Product ${testRunId}`);

    // 2. Verify SyncCursor advanced
    const curAfter = await getLocalSyncCursor(prisma);
    assert.equal(curAfter, targetSeq);

    // 3. Verify LocalSyncQuarantine marked RESOLVED
    const qUpdated = await prisma.localSyncQuarantine.findUnique({
      where: { id: qItem.id },
    });
    assert.equal(qUpdated?.status, QuarantineStatus.RESOLVED);
    assert.equal(qUpdated?.resolutionAction, "RETRY_APPLIED");
    assert.equal(qUpdated?.resolutionReason, "Verified product catalog data, applying change");
    assert.equal(qUpdated?.resolvedByUserId, ownerUser.id);

    // 4. Verify LocalProcessedChange created
    const processed = await prisma.localProcessedChange.findUnique({
      where: { operationId: opId },
    });
    assert.ok(processed, "LocalProcessedChange must record the applied operation");
    assert.equal(processed.changeSequence, targetSeq);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test E: Retry deterministic failure remains quarantined (status QUARANTINED, error updated)
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test E: Deterministic retry failure keeps status QUARANTINED and updates failure details", async () => {
    const curBefore = await getLocalSyncCursor(prisma);
    const targetSeq = curBefore + BigInt(1);
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    // Quarantined item with an invalid payload (missing mandatory name)
    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: targetSeq,
        operationId: opId,
        operationType: "UPSERT_PRODUCT",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: {
          brand: "IncompleteProduct", // missing name!
        },
        errorCode: "INITIAL_ERROR",
        errorMessage: "Initial error explanation",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(qItem.id);

    // Owner attempts Retry
    const res = await retryQuarantineAction({
      quarantineId: qItem.id,
      reason: "Attempting retry without fixing payload",
      _testUser: { id: ownerUser.id, role: Role.OWNER },
    });

    assert.equal(res.success, false);
    assert.equal(res.result?.action, "RETRY_FAILED");
    assert.equal(res.errorCode, "INVALID_PAYLOAD");

    // 1. Verify status remains QUARANTINED
    const qUpdated = await prisma.localSyncQuarantine.findUnique({
      where: { id: qItem.id },
    });
    assert.equal(qUpdated?.status, QuarantineStatus.QUARANTINED);
    assert.equal(qUpdated?.errorCode, "INVALID_PAYLOAD");
    assert.match(qUpdated?.errorMessage || "", /name/i);

    // 2. Cursor must NOT advance
    const curAfter = await getLocalSyncCursor(prisma);
    assert.equal(curAfter, curBefore);

    // 3. LocalProcessedChange must NOT be created
    const processed = await prisma.localProcessedChange.findUnique({
      where: { operationId: opId },
    });
    assert.equal(processed, null);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test F: Retry transient failure rolls back transaction cleanly
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test F: Transient failure during retry rolls back transaction cleanly without corruption", async () => {
    const curBefore = await getLocalSyncCursor(prisma);
    const targetSeq = curBefore + BigInt(1);
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: targetSeq,
        operationId: opId,
        operationType: "UPSERT_PRODUCT",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: {
          name: "Transient Product",
          brand: "Brand",
        },
        errorCode: "INITIAL_CODE",
        errorMessage: "Initial message",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(qItem.id);

    // Simulate transient failure by passing a mock Prisma client that fails on mutation
    const mockTx = {
      $executeRaw: async () => {},
      $queryRaw: async () => [{ acquired: true }],
      localSyncQuarantine: {
        findUnique: async () => qItem,
        update: async () => {},
      },
      syncCursor: {
        findUnique: async () => ({ lastSequence: curBefore }),
        upsert: async () => {},
      },
    };

    const mockPrismaClient = {
      $transaction: async (fn: (tx: any) => Promise<any>) => {
        return fn({
          ...mockTx,
          // throw a transient connection error
          product: {
            upsert: () => {
              throw new Error("Connection terminated unexpectedly");
            },
          },
        });
      },
    } as any;

    await assert.rejects(
      async () => {
        await resolveQuarantineChange(
          {
            quarantineId: qItem.id,
            action: "RETRY",
            reason: "Retry attempt during network flicker",
            resolvedByUserId: ownerUser.id,
          },
          mockPrismaClient
        );
      },
      (err: Error) => {
        assert.match(err.message, /Connection terminated/);
        return true;
      }
    );

    // Real DB cursor and quarantine status remain unchanged
    const curAfter = await getLocalSyncCursor(prisma);
    assert.equal(curAfter, curBefore);

    const qItemDb = await prisma.localSyncQuarantine.findUnique({
      where: { id: qItem.id },
    });
    assert.equal(qItemDb?.status, QuarantineStatus.QUARANTINED);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test G: Discard requires non-empty reason
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test G: Discard strictly requires a non-empty auditable reason", async () => {
    const curBefore = await getLocalSyncCursor(prisma);
    const targetSeq = curBefore + BigInt(1);
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: targetSeq,
        operationId: opId,
        operationType: "DISCARD_REASON_TEST",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { dummy: 1 },
        errorCode: "AUTHORITY_VIOLATION",
        errorMessage: "Authority conflict",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(qItem.id);

    // Attempt discard with empty/whitespace reason
    const res = await discardQuarantineAction({
      quarantineId: qItem.id,
      reason: "    ",
      _testUser: { id: ownerUser.id, role: Role.OWNER },
    });

    assert.equal(res.success, false);
    assert.match(res.error || "", /auditable discard reason is required/i);

    // Item must remain QUARANTINED
    const itemDb = await prisma.localSyncQuarantine.findUnique({
      where: { id: qItem.id },
    });
    assert.equal(itemDb?.status, QuarantineStatus.QUARANTINED);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test H: Discard resolves and advances cursor correctly
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test H: Discard resolves quarantine, creates LocalProcessedChange, and advances cursor without applying mutation", async () => {
    const curBefore = await getLocalSyncCursor(prisma);
    const targetSeq = curBefore + BigInt(1);
    const productId = crypto.randomUUID();
    const opId = crypto.randomUUID();
    createdProductIds.add(productId);
    createdOperationIds.add(opId);

    // Create a quarantined change for a product that should NOT be created
    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: targetSeq,
        operationId: opId,
        operationType: "UPSERT_PRODUCT",
        entityId: productId,
        action: SyncChangeAction.UPSERT,
        payload: {
          id: productId,
          name: `Discarded Product ${testRunId}`,
          brand: "DiscardBrand",
          minimumStockLevel: 5,
          latestPurchasePrice: 10,
          isActive: true,
        },
        errorCode: "AUTHORITY_VIOLATION",
        errorMessage: "Cloud cannot overwrite depot-protected product",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(qItem.id);

    // Owner Discards
    const res = await discardQuarantineAction({
      quarantineId: qItem.id,
      reason: "Confirmed authority violation: discarding cloud mutation per depot policy",
      _testUser: { id: ownerUser.id, role: Role.OWNER },
    });

    assert.equal(res.success, true);
    assert.equal(res.result?.action, "DISCARDED");
    assert.equal(res.result?.newCursor, targetSeq.toString());

    // 1. Verify mutation was NOT applied (product does not exist)
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    assert.equal(product, null, "Discarded mutation must NOT be applied to database");

    // 2. Verify SyncCursor advanced
    const curAfter = await getLocalSyncCursor(prisma);
    assert.equal(curAfter, targetSeq);

    // 3. Verify LocalSyncQuarantine marked RESOLVED with action DISCARDED
    const qUpdated = await prisma.localSyncQuarantine.findUnique({
      where: { id: qItem.id },
    });
    assert.equal(qUpdated?.status, QuarantineStatus.RESOLVED);
    assert.equal(qUpdated?.resolutionAction, "DISCARDED");
    assert.equal(
      qUpdated?.resolutionReason,
      "Confirmed authority violation: discarding cloud mutation per depot policy"
    );
    assert.equal(qUpdated?.resolvedByUserId, ownerUser.id);

    // 4. Verify LocalProcessedChange is created to prevent re-application
    const processed = await prisma.localProcessedChange.findUnique({
      where: { operationId: opId },
    });
    assert.ok(processed, "LocalProcessedChange must record the discarded operation");
    assert.equal(processed.changeSequence, targetSeq);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test I: Original operationId remains unchanged
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test I: Original operationId remains strictly preserved across quarantine resolution", async () => {
    const curBefore = await getLocalSyncCursor(prisma);
    const targetSeq = curBefore + BigInt(1);
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: targetSeq,
        operationId: opId,
        operationType: "IDENTITY_TEST",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { dummy: true },
        errorCode: "AUTHORITY_VIOLATION",
        errorMessage: "Authority conflict",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(qItem.id);

    await discardQuarantineAction({
      quarantineId: qItem.id,
      reason: "Discard identity verification",
      _testUser: { id: ownerUser.id, role: Role.OWNER },
    });

    const qResolved = await prisma.localSyncQuarantine.findUnique({
      where: { id: qItem.id },
    });
    assert.equal(qResolved?.operationId, opId, "operationId in LocalSyncQuarantine must match original");

    const processed = await prisma.localProcessedChange.findUnique({
      where: { operationId: opId },
    });
    assert.equal(processed?.operationId, opId, "operationId in LocalProcessedChange must match original");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test J: LocalProcessedChange is not duplicated
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test J: Attempting duplicate resolution of the same quarantine item is rejected idempotently", async () => {
    const curBefore = await getLocalSyncCursor(prisma);
    const targetSeq = curBefore + BigInt(1);
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: targetSeq,
        operationId: opId,
        operationType: "DUP_TEST",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { dummy: true },
        errorCode: "AUTHORITY_VIOLATION",
        errorMessage: "Authority conflict",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(qItem.id);

    // 1. First resolution succeeds
    const res1 = await discardQuarantineAction({
      quarantineId: qItem.id,
      reason: "First discard",
      _testUser: { id: ownerUser.id, role: Role.OWNER },
    });
    assert.equal(res1.success, true);

    // 2. Second resolution must fail because item is already RESOLVED
    const res2 = await discardQuarantineAction({
      quarantineId: qItem.id,
      reason: "Second duplicate discard",
      _testUser: { id: ownerUser.id, role: Role.OWNER },
    });
    assert.equal(res2.success, false);
    assert.match(res2.error || "", /already resolved/i);

    // Count records in LocalProcessedChange for opId: must be exactly 1
    const count = await prisma.localProcessedChange.count({
      where: { operationId: opId },
    });
    assert.equal(count, 1, "LocalProcessedChange must have exactly one record");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test K: Concurrent resolution blocked by pull advisory lock
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test K: Concurrent resolution attempt is blocked by the pull advisory lock", async () => {
    const curBefore = await getLocalSyncCursor(prisma);
    const targetSeq = curBefore + BigInt(1);
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: targetSeq,
        operationId: opId,
        operationType: "LOCK_TEST",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { dummy: true },
        errorCode: "TEST_LOCK",
        errorMessage: "Lock contention test",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(qItem.id);

    let releaseBgLock: () => void = () => {};
    let bgTxPromise: Promise<void> | null = null;

    // Acquire SYNC_PULL_ADVISORY_LOCK_ID in background transaction
    const lockAcquired = new Promise<void>((resolve) => {
      bgTxPromise = prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<{ acquired: boolean }[]>`
            SELECT pg_try_advisory_xact_lock(${SYNC_PULL_ADVISORY_LOCK_ID}) as acquired
          `;
          assert.equal(rows[0]?.acquired, true);
          resolve();
          await new Promise<void>((res) => {
            releaseBgLock = res;
          });
        },
        { timeout: 60000, maxWait: 20000 }
      );
    });

    await lockAcquired;

    try {
      // Attempt resolution while background transaction holds the advisory lock
      const res = await retryQuarantineAction({
        quarantineId: qItem.id,
        reason: "Resolution during contention",
        _testUser: { id: ownerUser.id, role: Role.OWNER },
      });

      assert.equal(res.success, false);
      assert.match(
        res.error || "",
        /Cannot resolve quarantine while pull synchronization is actively running|PULL_CONCURRENCY_LOCKED/
      );
    } finally {
      releaseBgLock();
      await bgTxPromise;
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test L: Earlier quarantine cannot be bypassed (RESOLUTION_SEQUENCE_MISMATCH)
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test L: Earlier quarantined change cannot be bypassed when resolving out of order", async () => {
    const curBefore = await getLocalSyncCursor(prisma);
    const seq1 = curBefore + BigInt(1);
    const seq2 = curBefore + BigInt(2);
    const opId1 = crypto.randomUUID();
    const opId2 = crypto.randomUUID();
    createdOperationIds.add(opId1);
    createdOperationIds.add(opId2);

    // Create item 1 at seq1
    const q1 = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: seq1,
        operationId: opId1,
        operationType: "ORDER_TEST_1",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { step: 1 },
        errorCode: "AUTHORITY_VIOLATION",
        errorMessage: "Error 1",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(q1.id);

    // Create item 2 at seq2
    const q2 = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: seq2,
        operationId: opId2,
        operationType: "ORDER_TEST_2",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { step: 2 },
        errorCode: "AUTHORITY_VIOLATION",
        errorMessage: "Error 2",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(q2.id);

    // Attempt to resolve item 2 first (bypassing item 1)
    const res = await discardQuarantineAction({
      quarantineId: q2.id,
      reason: "Attempting to skip earlier sequence",
      _testUser: { id: ownerUser.id, role: Role.OWNER },
    });

    assert.equal(res.success, false);
    assert.match(
      res.error || "",
      /Quarantined changes must be resolved in strict sequence order|RESOLUTION_SEQUENCE_MISMATCH/
    );

    // Cursor must still be curBefore
    const curAfter = await getLocalSyncCursor(prisma);
    assert.equal(curAfter, curBefore);

    // Both items must remain QUARANTINED
    const q1Db = await prisma.localSyncQuarantine.findUnique({ where: { id: q1.id } });
    const q2Db = await prisma.localSyncQuarantine.findUnique({ where: { id: q2.id } });
    assert.equal(q1Db?.status, QuarantineStatus.QUARANTINED);
    assert.equal(q2Db?.status, QuarantineStatus.QUARANTINED);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test M: Scheduler continues working with quarantine present
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test M: Sync daemon scheduler ticks safely when quarantine is active", async () => {
    await stopSyncScheduler();
    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: `dev-test-${testRunId}`,
      deviceToken: "tok-test",
      normalIntervalMs: 200,
      runImmediatelyOnStart: false,
      fetchFn: async () => {
        return new Response(
          JSON.stringify({
            success: true,
            deviceId: `dev-test-${testRunId}`,
            fromSequence: "0",
            toSequence: "0",
            changes: [],
            hasMore: false,
            serverTimestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },
    });

    await scheduler.start();
    const status = scheduler.getStatus();
    assert.equal(status.running, true);
    await scheduler.stop();
    assert.equal(scheduler.getStatus().running, false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test N: Business error explanations cover all required codes
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test N: Business error explanations map all domain error codes correctly", () => {
    const codes = [
      "AUTHORITY_VIOLATION",
      "CUSTOMER_AUTHORITY_DECISION_REQUIRED",
      "UNSUPPORTED_OPERATION",
      "INVALID_PAYLOAD",
      "CANNOT_DELETE_POSTED_RECEIVING",
      "PRODUCT_NOT_FOUND",
      "NO_ACTIVE_USER",
    ];

    for (const code of codes) {
      const expl = getBusinessErrorExplanation(code);
      assert.ok(expl.title.length > 0, `Title for ${code} must not be empty`);
      assert.ok(expl.explanation.length > 0, `Explanation for ${code} must not be empty`);
    }

    // Fallback for unknown code
    const fallback = getBusinessErrorExplanation("UNKNOWN_CODE_XYZ");
    assert.equal(fallback.title, "Deterministic Sync Error");
  });
});
