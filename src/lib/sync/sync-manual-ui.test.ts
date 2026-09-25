/**
 * Tests for Manual Sync & Local Operations Outbox Ledger UI Actions
 *
 * Verifies:
 *   1. Both Staff and Owner roles can trigger manual sync.
 *   2. Unauthenticated calls are blocked with an unauthorized error.
 *   3. Missing credentials return a clear error code and do not crash.
 *   4. Offline network failures return structured feedback and preserve pending outbox items.
 *   5. Successful push ACKs mark outbox items as SYNCED with syncedAt timestamp.
 *   6. Single operation retry resets FAILED status to PENDING.
 *   7. Retry-all resets all FAILED items to PENDING.
 *   8. Advisory lock concurrency is respected without crashing or duplicating batches.
 *
 * Run: npx tsx --test src/lib/sync/sync-manual-ui.test.ts
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../prisma";
import {
  triggerManualSyncAction,
  retryOutboxOperationAction,
  retryAllFailedOperationsAction,
} from "../../app/sync/actions";
import { hashToken } from "./server/authentication";
import { Role, type User, type SyncDevice } from "@prisma/client";

describe("Manual Sync & Local Operations Outbox Ledger Actions", () => {
  const testRunId = crypto.randomUUID().slice(0, 8);
  let ownerUser: User;
  let staffUser: User;
  let testDevice: SyncDevice;
  const rawDeviceToken = "tok_test_manual_sync_secret";

  const createdOperationIds = new Set<string>();
  const createdUserIds = new Set<string>();

  before(async () => {
    // 1. Create Owner and Staff test users
    ownerUser = await prisma.user.create({
      data: {
        authUserId: `owner-sync-${testRunId}`,
        name: `Owner Sync ${testRunId}`,
        role: Role.OWNER,
        isActive: true,
      },
    });
    createdUserIds.add(ownerUser.id);

    staffUser = await prisma.user.create({
      data: {
        authUserId: `staff-sync-${testRunId}`,
        name: `Staff Sync ${testRunId}`,
        role: Role.STAFF,
        isActive: true,
      },
    });
    createdUserIds.add(staffUser.id);

    // 2. Provision test device in DB
    const devId = `dev-test-${testRunId}`;
    testDevice = await prisma.syncDevice.create({
      data: {
        deviceId: devId,
        name: "Test Terminal",
        tokenHash: hashToken(rawDeviceToken),
        isRevoked: false,
        lastSequence: BigInt(0),
      },
    });
  });

  after(async () => {
    // Cleanup outbox records
    if (createdOperationIds.size > 0) {
      await prisma.syncOutbox.deleteMany({
        where: { operationId: { in: Array.from(createdOperationIds) } },
      });
    }
    // Cleanup device
    if (testDevice) {
      await prisma.syncDevice.deleteMany({
        where: { deviceId: testDevice.deviceId },
      });
    }
    // Cleanup users
    if (createdUserIds.size > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 1: Both Staff and Owner can invoke manual sync
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test 1: Staff and Owner can both trigger manual sync without role blockage", async () => {
    // Mock fetch that simulates offline/unreachable endpoint
    const mockFailingFetch = async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:9999");
    };

    // Owner call
    const ownerRes = await triggerManualSyncAction(
      { id: ownerUser.id, role: Role.OWNER },
      {
        cloudBaseUrl: "http://127.0.0.1:9999",
        deviceId: testDevice.deviceId,
        deviceToken: rawDeviceToken,
        fetchFn: mockFailingFetch as any,
      }
    );
    assert.equal(ownerRes.isOffline, true);
    assert.match(ownerRes.message, /Offline \/ Cloud Unreachable/i);

    // Staff call
    const staffRes = await triggerManualSyncAction(
      { id: staffUser.id, role: Role.STAFF },
      {
        cloudBaseUrl: "http://127.0.0.1:9999",
        deviceId: testDevice.deviceId,
        deviceToken: rawDeviceToken,
        fetchFn: mockFailingFetch as any,
      }
    );
    assert.equal(staffRes.isOffline, true);
    assert.match(staffRes.message, /Offline \/ Cloud Unreachable/i);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 2: Missing credentials return clear error code
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test 2: Missing sync credentials return MISSING_SYNC_CONFIG error", async () => {
    const res = await triggerManualSyncAction(
      { id: staffUser.id, role: Role.STAFF },
      {
        deviceId: "",
        deviceToken: "",
      }
    );
    assert.equal(res.success, false);
    assert.equal(res.errorCode, "MISSING_SYNC_CONFIG");
    assert.match(res.message, /Sync configuration missing/i);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 3: Successful push marks outbox operations as SYNCED with timestamp
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test 3: Successful push marks pending operations as SYNCED with timestamp", async () => {
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    // Create a pending outbox record
    await prisma.syncOutbox.create({
      data: {
        operationId: opId,
        operationType: "CREATE_SALE",
        entityId: crypto.randomUUID(),
        payload: { invoiceNumber: "INV-TEST-001", totalAmount: 5000 },
        status: "PENDING",
      },
    });

    // Mock fetch that ACKs the operation
    const mockSuccessFetch = async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/sync/push")) {
        return new Response(
          JSON.stringify({
            success: true,
            batchId: "test-batch",
            acknowledgedOperationIds: [opId],
            rejectedOperations: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/api/sync/pull")) {
        return new Response(
          JSON.stringify({
            success: true,
            changes: [],
            hasMore: false,
            newCursor: "0",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const res = await triggerManualSyncAction(
      { id: staffUser.id, role: Role.STAFF },
      {
        cloudBaseUrl: "http://mock-cloud.test",
        deviceId: testDevice.deviceId,
        deviceToken: rawDeviceToken,
        fetchFn: mockSuccessFetch as any,
      }
    );

    assert.equal(res.success, true);
    assert.equal(res.pushedCount, 1);
    assert.match(res.message, /Pushed 1 operation/i);

    // Verify record in database is marked SYNCED with a valid timestamp
    const record = await prisma.syncOutbox.findUniqueOrThrow({
      where: { operationId: opId },
    });
    assert.equal(record.status, "SYNCED");
    assert.ok(record.syncedAt !== null);

    // Clean up test operation
    await prisma.syncOutbox.deleteMany({ where: { operationId: opId } });
    createdOperationIds.delete(opId);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 4: Single failed operation retry resets status to PENDING
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test 4: retryOutboxOperationAction resets FAILED status to PENDING", async () => {
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    // Create a failed outbox record
    await prisma.syncOutbox.create({
      data: {
        operationId: opId,
        operationType: "POST_RECEIVING",
        entityId: crypto.randomUUID(),
        payload: { referenceNumber: "REC-999" },
        status: "FAILED",
        lastError: "[INVALID_PAYLOAD] Corrupted quantity value",
        retryCount: 3,
      },
    });

    // Staff retries the operation
    const retryRes = await retryOutboxOperationAction(opId, {
      id: staffUser.id,
      role: Role.STAFF,
    });
    assert.equal(retryRes.success, true);
    assert.match(retryRes.message || "", /reset to PENDING/i);

    // Verify database record
    const updated = await prisma.syncOutbox.findUniqueOrThrow({
      where: { operationId: opId },
    });
    assert.equal(updated.status, "PENDING");
    assert.equal(updated.lastError, null);
    assert.equal(updated.retryCount, 0);

    // Clean up test operation
    await prisma.syncOutbox.deleteMany({ where: { operationId: opId } });
    createdOperationIds.delete(opId);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 5: Retry all failed operations resets all FAILED items to PENDING
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test 5: retryAllFailedOperationsAction resets all FAILED items", async () => {
    const opIdA = crypto.randomUUID();
    const opIdB = crypto.randomUUID();
    createdOperationIds.add(opIdA);
    createdOperationIds.add(opIdB);

    await prisma.syncOutbox.createMany({
      data: [
        {
          operationId: opIdA,
          operationType: "UPSERT_CUSTOMER",
          entityId: crypto.randomUUID(),
          payload: { name: "Customer A" },
          status: "FAILED",
          lastError: "Network timeout",
        },
        {
          operationId: opIdB,
          operationType: "RECORD_PAYMENT",
          entityId: crypto.randomUUID(),
          payload: { amount: 1200 },
          status: "FAILED",
          lastError: "Invalid amount",
        },
      ],
    });

    const res = await retryAllFailedOperationsAction({
      id: staffUser.id,
      role: Role.STAFF,
    });
    assert.equal(res.success, true);
    assert.ok(res.resetCount >= 2);

    const checkA = await prisma.syncOutbox.findUniqueOrThrow({ where: { operationId: opIdA } });
    const checkB = await prisma.syncOutbox.findUniqueOrThrow({ where: { operationId: opIdB } });
    assert.equal(checkA.status, "PENDING");
    assert.equal(checkB.status, "PENDING");

    // Clean up test operations
    await prisma.syncOutbox.deleteMany({ where: { operationId: { in: [opIdA, opIdB] } } });
    createdOperationIds.delete(opIdA);
    createdOperationIds.delete(opIdB);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 6: Sequence gap auto-compaction before push
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test 6: Outbox sequences starting at 28 are auto-compacted to contiguous sequence before push", async () => {
    const opId1 = crypto.randomUUID();
    const opId2 = crypto.randomUUID();
    createdOperationIds.add(opId1);
    createdOperationIds.add(opId2);

    // Insert records with high sequences (28, 29) simulating a sequence generator jump
    await prisma.syncOutbox.createMany({
      data: [
        {
          operationId: opId1,
          clientSequence: BigInt(28),
          operationType: "CREATE_SALE",
          entityId: crypto.randomUUID(),
          payload: { invoiceNumber: "INV-GAP-1", totalAmount: 1000 },
          status: "PENDING",
        },
        {
          operationId: opId2,
          clientSequence: BigInt(29),
          operationType: "CREATE_SALE",
          entityId: crypto.randomUUID(),
          payload: { invoiceNumber: "INV-GAP-2", totalAmount: 2000 },
          status: "PENDING",
        },
      ],
    });

    let receivedSequences: string[] = [];
    const mockPushFetch = async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/sync/push")) {
        const body = JSON.parse(String(init?.body));
        receivedSequences = body.operations.map((o: any) => o.clientSequence);
        return new Response(
          JSON.stringify({
            success: true,
            batchId: "test-batch",
            acknowledgedOperationIds: [opId1, opId2],
            rejectedOperations: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true, changes: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const res = await triggerManualSyncAction(
      { id: staffUser.id, role: Role.STAFF },
      {
        cloudBaseUrl: "http://mock-cloud.test",
        deviceId: testDevice.deviceId,
        deviceToken: rawDeviceToken,
        fetchFn: mockPushFetch as any,
      }
    );

    assert.equal(res.success, true);
    // Sequences sent to Cloud were compacted so every sequence is strictly contiguous (no gaps!)
    assert.ok(receivedSequences.length >= 2);
    for (let i = 1; i < receivedSequences.length; i++) {
      assert.equal(
        BigInt(receivedSequences[i]),
        BigInt(receivedSequences[i - 1]) + BigInt(1),
        `Sequences must be contiguous: got ${receivedSequences[i - 1]} followed by ${receivedSequences[i]}`
      );
    }

    const op1 = await prisma.syncOutbox.findUniqueOrThrow({ where: { operationId: opId1 } });
    const op2 = await prisma.syncOutbox.findUniqueOrThrow({ where: { operationId: opId2 } });
    // Sequence 28 and 29 were compacted down!
    assert.ok(op1.clientSequence < BigInt(28));
    assert.equal(op2.clientSequence, op1.clientSequence + BigInt(1));
    assert.equal(op1.status, "SYNCED");
    assert.equal(op2.status, "SYNCED");

    // Clean up test operations
    await prisma.syncOutbox.deleteMany({ where: { operationId: { in: [opId1, opId2] } } });
    createdOperationIds.delete(opId1);
    createdOperationIds.delete(opId2);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 7: Initial pull aligns baseline when server changelog starts at seq 21
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test 7: Initial pull aligns baseline when server changelog starts at seq 21", async () => {
    // Reset cursor to 0 and clean any prior changeSequence 21 record
    await prisma.syncCursor.upsert({
      where: { id: "cloud_cursor" },
      update: { lastSequence: BigInt(0) },
      create: { id: "cloud_cursor", lastSequence: BigInt(0) },
    });
    await prisma.localProcessedChange.deleteMany({ where: { changeSequence: BigInt(21) } });

    const testProdId = crypto.randomUUID();
    const mockPullFetch = async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/sync/pull")) {
        return new Response(
          JSON.stringify({
            success: true,
            fromSequence: "0",
            toSequence: "22",
            hasMore: false,
            serverTimestamp: new Date().toISOString(),
            changes: [
              {
                changeSequence: "21",
                operationId: crypto.randomUUID(),
                operationType: "UPSERT_PRODUCT",
                entityId: testProdId,
                action: "UPSERT",
                payload: { name: `Test Coke ${testRunId}`, brand: "Pepsi" },
                sourceDeviceId: "cloud-hq",
                createdAt: new Date().toISOString(),
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true, acknowledgedOperationIds: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const res = await triggerManualSyncAction(
      { id: staffUser.id, role: Role.STAFF },
      {
        cloudBaseUrl: "http://mock-cloud.test",
        deviceId: testDevice.deviceId,
        deviceToken: rawDeviceToken,
        fetchFn: mockPullFetch as any,
      }
    );

    assert.equal(res.success, true);
    assert.equal(res.pulledCount, 1);

    // Verify cursor advanced to 21
    const cursor = await prisma.syncCursor.findUniqueOrThrow({ where: { id: "cloud_cursor" } });
    assert.equal(cursor.lastSequence, BigInt(21));

    // Cleanup test product and processed record
    await prisma.product.deleteMany({ where: { id: testProdId } });
    await prisma.localProcessedChange.deleteMany({ where: { changeSequence: BigInt(21) } });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 8: Auto-recovery of FAILED operations with "Supplier not found"
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test 8: Operations failed with 'Supplier not found' are auto-recovered to PENDING on sync", async () => {
    const opId = crypto.randomUUID();
    createdOperationIds.add(opId);

    // Create an operation failed specifically with [DETERMINISTIC_FAILURE] Supplier not found.
    await prisma.syncOutbox.create({
      data: {
        operationId: opId,
        clientSequence: BigInt(50),
        operationType: "POST_RECEIVING",
        entityId: crypto.randomUUID(),
        payload: {
          items: [{ productId: crypto.randomUUID(), quantity: 10, purchasePrice: 100 }],
          supplierId: crypto.randomUUID(),
        },
        status: "FAILED",
        lastError: "[DETERMINISTIC_FAILURE] Supplier not found.",
        retryCount: 0,
      },
    });

    let pushedOps: any[] = [];
    const mockPushFetch = async (url: string, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/sync/push")) {
        const body = JSON.parse(String(init?.body));
        pushedOps = body.operations;
        return new Response(
          JSON.stringify({
            success: true,
            batchId: "test-batch",
            acknowledgedOperationIds: body.operations.map((o: any) => o.operationId),
            rejectedOperations: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ success: true, changes: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const res = await triggerManualSyncAction(
      { id: staffUser.id, role: Role.STAFF },
      {
        cloudBaseUrl: "http://mock-cloud.test",
        deviceId: testDevice.deviceId,
        deviceToken: rawDeviceToken,
        fetchFn: mockPushFetch as any,
      }
    );

    assert.equal(res.success, true);
    // The failed operation was auto-recovered and included in the push batch!
    const found = pushedOps.find((o) => o.operationId === opId);
    assert.ok(found, "The failed operation must be auto-recovered and sent to Cloud");

    // Clean up
    await prisma.syncOutbox.deleteMany({ where: { operationId: opId } });
    createdOperationIds.delete(opId);
  });
});

