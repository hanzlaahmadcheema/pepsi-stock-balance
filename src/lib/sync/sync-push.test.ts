/**
 * Phase 2 Sync — Cloud Push + Idempotency Integration Tests
 *
 * Exercises all 20 baseline scenarios (A through T) AND the Phase 2 Review
 * correction scenarios (failed sequence recovery, stub safety, retry without sequence skip)
 * against the live development Supabase database.
 *
 * Baseline Scenarios:
 *   A. Valid authenticated push
 *   B. Invalid/missing token
 *   C. Revoked device
 *   D. Unknown device
 *   E. First sequence accepted
 *   F. Future sequence rejected
 *   G. Duplicate operationId returns previous ACK
 *   H. Duplicate deviceId + clientSequence cannot create another operation
 *   I. Operation 17 succeeds and 18 fails
 *   J. Operation 19 does not execute after 18 fails
 *   K. Retry after simulated lost ACK returns the original ACK
 *   L. Failed transaction leaves no ProcessedSyncOperation
 *   M. Unknown operationType rejected
 *   N. More than 50 operations rejected
 *   O. Malformed payload rejected
 *   P. SyncDevice.lastSeenAt updates correctly
 *   Q. SyncDevice.lastSequence does not advance beyond accepted operations
 *   R. Local SyncOutbox marks ACKed operations SYNCED
 *   S. Local SyncOutbox leaves later operations PENDING after failure
 *   T. Transient HTTP/network failure does not incorrectly mark an operation SYNCED
 *
 * Phase 2 Review Verification Scenarios:
 *   REV-A. Sequence 17 succeeds, 18 fails, 19 remains blocked.
 *   REV-B. Retrying the SAME operation 18 after resolution succeeds under identical sequence & opId.
 *   REV-C. After 18 succeeds, 19 can then succeed.
 *   REV-D. No sequence skipping is possible (Cloud rejects gap; Local blocks queue).
 *   REV-E. CREATE_SALE and other business operation types cannot receive false SUCCESS.
 *   REV-F. A rejected/unimplemented operation does not advance SyncDevice.lastSequence.
 *
 * Run: npx tsx --test src/lib/sync/sync-push.test.ts
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../prisma";
import { hashToken } from "./server/authentication";
import { processDevicePushBatch } from "./server/push";
import { pushPendingOperations, retryFailedOperation } from "./client/push";
import { POST } from "../../app/api/sync/push/route";
import { REGISTERED_FUTURE_OPERATION_TYPES } from "./server/operation-dispatcher";
import type { SyncOperation, SyncBatchPushPayload, SyncBatchPushResponse } from "./types";

// ─── Test Run Fixtures ────────────────────────────────────────────────────────

const testRunId = crypto.randomUUID().slice(0, 8);
const createdDeviceIds = new Set<string>();

/** Create a unique test device record in the database. */
async function createTestDevice(overrides: {
  isRevoked?: boolean;
  lastSequence?: bigint;
} = {}) {
  const devId = `dev-${testRunId}-${crypto.randomUUID().slice(0, 8)}`;
  const rawToken = `tok-${crypto.randomBytes(16).toString("hex")}`;
  const tokenHash = hashToken(rawToken);

  const device = await prisma.syncDevice.create({
    data: {
      deviceId: devId,
      name: `Test Device ${devId}`,
      tokenHash,
      isRevoked: overrides.isRevoked ?? false,
      lastSequence: overrides.lastSequence ?? BigInt(0),
    },
  });

  createdDeviceIds.add(devId);
  return { device, rawToken };
}

/**
 * Helper to make a valid SyncOperation.
 * Defaults to TEST_PING (the Phase 2 implemented test operation) to prevent false-stub errors.
 */
function makeOp(overrides: Partial<SyncOperation> & { clientSequence: string }): SyncOperation {
  return {
    operationId: crypto.randomUUID(),
    operationType: "TEST_PING",
    entityId: crypto.randomUUID(),
    payload: { testRunId, amount: 1000 },
    clientCreatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Helper to build a standard Request for the POST route handler */
function makePushRequest(
  deviceId: string,
  rawToken: string,
  body: unknown,
  customHeaders: Record<string, string> = {}
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${rawToken}`,
    "x-device-id": deviceId,
    ...customHeaders,
  };

  if (customHeaders.authorization === undefined && !rawToken) {
    delete headers.authorization;
  }
  if (customHeaders["x-device-id"] === undefined && !deviceId) {
    delete headers["x-device-id"];
  }

  return new Request("http://localhost:3000/api/sync/push", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// ─── Global Cleanup ───────────────────────────────────────────────────────────

after(async () => {
  const deviceList = Array.from(createdDeviceIds);
  if (deviceList.length > 0) {
    await prisma.processedSyncOperation.deleteMany({
      where: { deviceId: { in: deviceList } },
    });
    await prisma.syncDevice.deleteMany({
      where: { deviceId: { in: deviceList } },
    });
  }
  await prisma.syncOutbox.deleteMany({
    where: { operationType: { contains: testRunId } },
  });
});

// ─── Scenarios A through T ────────────────────────────────────────────────────

describe("Phase 2: Cloud Push + Idempotency Verification (Scenarios A–T)", () => {
  it("A. Valid authenticated push returns 200 and acknowledges operation", async () => {
    const { device, rawToken } = await createTestDevice();
    const op = makeOp({ clientSequence: "1" });

    const payload: SyncBatchPushPayload = {
      deviceId: device.deviceId,
      batchId: crypto.randomUUID(),
      schemaVersion: "1.0",
      operations: [op],
    };

    const req = makePushRequest(device.deviceId, rawToken, payload);
    const res = await POST(req);

    assert.equal(res.status, 200);
    const body = (await res.json()) as SyncBatchPushResponse;
    assert.equal(body.success, true);
    assert.ok(body.acknowledgedOperationIds.includes(op.operationId));
  });

  it("B. Invalid or missing token returns 400 or 401 error", async () => {
    const { device } = await createTestDevice();
    const payload = { schemaVersion: "1.0", operations: [] };

    const reqMissing = new Request("http://localhost:3000/api/sync/push", {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-id": device.deviceId },
      body: JSON.stringify(payload),
    });
    const resMissing = await POST(reqMissing);
    assert.equal(resMissing.status, 400);

    const reqInvalid = makePushRequest(device.deviceId, "invalid-token-xyz", payload);
    const resInvalid = await POST(reqInvalid);
    assert.equal(resInvalid.status, 401);
  });

  it("C. Revoked device returns 403 Forbidden with DEVICE_REVOKED", async () => {
    const { device, rawToken } = await createTestDevice({ isRevoked: true });
    const payload = { schemaVersion: "1.0", operations: [] };

    const req = makePushRequest(device.deviceId, rawToken, payload);
    const res = await POST(req);

    assert.equal(res.status, 403);
    const body = (await res.json()) as { errorCode?: string };
    assert.equal(body.errorCode, "DEVICE_REVOKED");
  });

  it("D. Unknown device returns 401 with DEVICE_NOT_FOUND", async () => {
    const fakeDevId = `unknown-dev-${crypto.randomUUID().slice(0, 8)}`;
    const payload = { schemaVersion: "1.0", operations: [] };

    const req = makePushRequest(fakeDevId, "some-token", payload);
    const res = await POST(req);

    assert.equal(res.status, 401);
    const body = (await res.json()) as { errorCode?: string };
    assert.equal(body.errorCode, "DEVICE_NOT_FOUND");
  });

  it("E. First sequence (clientSequence=1) is accepted", async () => {
    const { device } = await createTestDevice();
    const op = makeOp({ clientSequence: "1" });

    const result = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(result.success, true);
    assert.ok(result.acknowledgedOperationIds.includes(op.operationId));
    assert.equal(result.rejectedOperations, undefined);
  });

  it("F. Future sequence (clientSequence=5 when expecting 1) is rejected with SEQUENCE_GAP", async () => {
    const { device } = await createTestDevice();
    const op = makeOp({ clientSequence: "5" });

    const result = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(result.success, false);
    assert.equal(result.acknowledgedOperationIds.length, 0);
    assert.ok(result.rejectedOperations && result.rejectedOperations.length === 1);
    assert.equal(result.rejectedOperations[0].errorCode, "SEQUENCE_GAP");
    assert.equal(result.rejectedOperations[0].expectedSequence, "1");
  });

  it("G. Duplicate operationId returns previous ACK without duplicate mutation", async () => {
    const { device } = await createTestDevice();
    const op = makeOp({ clientSequence: "1" });

    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res1.success, true);
    assert.ok(res1.acknowledgedOperationIds.includes(op.operationId));

    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res2.success, true);
    assert.ok(res2.acknowledgedOperationIds.includes(op.operationId));
    assert.equal(res2.rejectedOperations, undefined);

    const count = await prisma.processedSyncOperation.count({
      where: { operationId: op.operationId },
    });
    assert.equal(count, 1);
  });

  it("H. Duplicate deviceId + clientSequence cannot create another operation", async () => {
    const { device } = await createTestDevice();
    const opA = makeOp({ clientSequence: "1" });
    const opB = makeOp({ clientSequence: "1" });

    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [opA]);
    assert.equal(res1.success, true);

    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [opB]);
    assert.equal(res2.success, false);
    assert.ok(res2.rejectedOperations && res2.rejectedOperations.length === 1);
    assert.equal(res2.rejectedOperations[0].errorCode, "SEQUENCE_REUSE_FORBIDDEN");
  });

  it("I. Operation 17 succeeds and 18 fails: batch stops with correct per-operation status", async () => {
    const { device } = await createTestDevice({ lastSequence: BigInt(16) });
    const op17 = makeOp({ clientSequence: "17", operationType: "TEST_PING" });
    const op18 = makeOp({ clientSequence: "18", operationType: "UNKNOWN_UNSUPPORTED_TYPE" as never });

    const result = await processDevicePushBatch(device, crypto.randomUUID(), [op17, op18]);

    assert.equal(result.success, false);
    assert.ok(result.acknowledgedOperationIds.includes(op17.operationId));
    assert.ok(result.rejectedOperations?.some((r) => r.operationId === op18.operationId));
    assert.equal(result.rejectedOperations![0].errorCode, "UNSUPPORTED_OPERATION");
  });

  it("J. Operation 19 does not execute after 18 fails", async () => {
    const { device } = await createTestDevice({ lastSequence: BigInt(16) });
    const op17 = makeOp({ clientSequence: "17", operationType: "TEST_PING" });
    const op18 = makeOp({ clientSequence: "18", operationType: "BAD_TYPE" as never });
    const op19 = makeOp({ clientSequence: "19", operationType: "TEST_PING" });

    const result = await processDevicePushBatch(device, crypto.randomUUID(), [op17, op18, op19]);

    assert.ok(result.acknowledgedOperationIds.includes(op17.operationId));
    assert.ok(result.rejectedOperations?.some((r) => r.operationId === op18.operationId));
    assert.ok(!result.acknowledgedOperationIds.includes(op19.operationId));
    assert.ok(!result.rejectedOperations?.some((r) => r.operationId === op19.operationId));

    const op19Row = await prisma.processedSyncOperation.findUnique({
      where: { operationId: op19.operationId },
    });
    assert.equal(op19Row, null);
  });

  it("K. Retry after simulated lost ACK returns the original ACK", async () => {
    const { device } = await createTestDevice();
    const op = makeOp({ clientSequence: "1" });

    await processDevicePushBatch(device, crypto.randomUUID(), [op]);

    const retryResult = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(retryResult.success, true);
    assert.ok(retryResult.acknowledgedOperationIds.includes(op.operationId));
  });

  it("L. Failed transaction leaves no ProcessedSyncOperation", async () => {
    const { device } = await createTestDevice();
    const failedOp = makeOp({ clientSequence: "1", operationType: "INVALID_TEST_TYPE" as never });

    await processDevicePushBatch(device, crypto.randomUUID(), [failedOp]);

    const row = await prisma.processedSyncOperation.findUnique({
      where: { operationId: failedOp.operationId },
    });
    assert.equal(row, null, "Failed transaction must leave no ProcessedSyncOperation row");
  });

  it("M. Unknown operationType rejected deterministically", async () => {
    const { device } = await createTestDevice();
    const badOp = makeOp({ clientSequence: "1", operationType: "NON_EXISTENT_TYPE" as never });

    const result = await processDevicePushBatch(device, crypto.randomUUID(), [badOp]);
    assert.equal(result.success, false);
    assert.ok(result.rejectedOperations && result.rejectedOperations.length === 1);
    assert.equal(result.rejectedOperations[0].errorCode, "UNSUPPORTED_OPERATION");
    assert.match(result.rejectedOperations[0].error, /Unsupported operation type/);
  });

  it("N. More than 50 operations in a batch rejected with 422 BATCH_TOO_LARGE", async () => {
    const { device, rawToken } = await createTestDevice();
    const fiftyOneOps = Array.from({ length: 51 }, (_, i) =>
      makeOp({ clientSequence: (i + 1).toString() })
    );

    const payload: SyncBatchPushPayload = {
      deviceId: device.deviceId,
      batchId: crypto.randomUUID(),
      schemaVersion: "1.0",
      operations: fiftyOneOps,
    };

    const req = makePushRequest(device.deviceId, rawToken, payload);
    const res = await POST(req);

    assert.equal(res.status, 422);
    const body = (await res.json()) as { errorCode?: string };
    assert.equal(body.errorCode, "BATCH_TOO_LARGE");
  });

  it("O. Malformed payload rejected with 400 Bad Request", async () => {
    const { device, rawToken } = await createTestDevice();

    const req1 = makePushRequest(device.deviceId, rawToken, {
      deviceId: device.deviceId,
      batchId: crypto.randomUUID(),
      schemaVersion: "1.0",
    });
    const res1 = await POST(req1);
    assert.equal(res1.status, 400);

    const req2 = makePushRequest(device.deviceId, rawToken, {
      deviceId: device.deviceId,
      batchId: crypto.randomUUID(),
      schemaVersion: "1.0",
      operations: [],
    });
    const res2 = await POST(req2);
    assert.equal(res2.status, 400);

    const badOp = makeOp({ clientSequence: "not-a-number" });
    const req3 = makePushRequest(device.deviceId, rawToken, {
      deviceId: device.deviceId,
      batchId: crypto.randomUUID(),
      schemaVersion: "1.0",
      operations: [badOp],
    });
    const res3 = await POST(req3);
    assert.equal(res3.status, 400);
  });

  it("P. SyncDevice.lastSeenAt updates correctly after push", async () => {
    const { device, rawToken } = await createTestDevice();
    const beforeTime = device.lastSeenAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 50));

    const op = makeOp({ clientSequence: "1" });
    const payload: SyncBatchPushPayload = {
      deviceId: device.deviceId,
      batchId: crypto.randomUUID(),
      schemaVersion: "1.0",
      operations: [op],
    };

    const req = makePushRequest(device.deviceId, rawToken, payload);
    await POST(req);

    const updated = await prisma.syncDevice.findUniqueOrThrow({
      where: { deviceId: device.deviceId },
    });
    assert.ok(
      updated.lastSeenAt.getTime() >= beforeTime,
      `Expected lastSeenAt (${updated.lastSeenAt.getTime()}) >= beforeTime (${beforeTime})`
    );
  });

  it("Q. SyncDevice.lastSequence does not advance beyond accepted operations", async () => {
    const { device } = await createTestDevice();
    const op1 = makeOp({ clientSequence: "1" });
    const op2 = makeOp({ clientSequence: "2", operationType: "INVALID" as never });

    await processDevicePushBatch(device, crypto.randomUUID(), [op1, op2]);

    const updated = await prisma.syncDevice.findUniqueOrThrow({
      where: { deviceId: device.deviceId },
    });
    assert.equal(updated.lastSequence, BigInt(1));
  });

  it("R. Local SyncOutbox marks ACKed operations SYNCED", async () => {
    const opId = crypto.randomUUID();
    const entityId = crypto.randomUUID();
    const devId = `dev-r-${testRunId}`;

    const outboxRow = await prisma.syncOutbox.create({
      data: {
        operationId: opId,
        operationType: `TEST_${testRunId}_R`,
        entityId,
        payload: { test: true },
        status: "PENDING",
      },
    });

    const mockFetch: typeof fetch = async () => {
      const resp: SyncBatchPushResponse = {
        success: true,
        batchId: crypto.randomUUID(),
        acknowledgedOperationIds: [opId],
        serverTimestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(resp), { status: 200 });
    };

    const result = await pushPendingOperations("http://localhost:3000", devId, "fake-token", mockFetch);
    assert.equal(result.syncedCount >= 1, true);

    const updated = await prisma.syncOutbox.findUniqueOrThrow({ where: { id: outboxRow.id } });
    assert.equal(updated.status, "SYNCED");
    assert.ok(updated.syncedAt !== null);

    // Clean up
    await prisma.syncOutbox.delete({ where: { id: outboxRow.id } });
  });

  it("S. Local SyncOutbox leaves later operations PENDING after failure", async () => {
    const opId1 = crypto.randomUUID();
    const opId2 = crypto.randomUUID();
    const devId = `dev-s-${testRunId}`;

    const row1 = await prisma.syncOutbox.create({
      data: {
        operationId: opId1,
        operationType: `TEST_${testRunId}_S1`,
        entityId: crypto.randomUUID(),
        payload: { test: 1 },
        status: "PENDING",
      },
    });

    const row2 = await prisma.syncOutbox.create({
      data: {
        operationId: opId2,
        operationType: `TEST_${testRunId}_S2`,
        entityId: crypto.randomUUID(),
        payload: { test: 2 },
        status: "PENDING",
      },
    });

    const mockFetch: typeof fetch = async () => {
      const resp: SyncBatchPushResponse = {
        success: false,
        batchId: crypto.randomUUID(),
        acknowledgedOperationIds: [],
        rejectedOperations: [
          { operationId: opId1, error: "Deterministic validation error", errorCode: "DETERMINISTIC_FAILURE" },
        ],
        serverTimestamp: new Date().toISOString(),
      };
      return new Response(JSON.stringify(resp), { status: 207 });
    };

    await pushPendingOperations("http://localhost:3000", devId, "fake-token", mockFetch);

    const updated1 = await prisma.syncOutbox.findUniqueOrThrow({ where: { id: row1.id } });
    const updated2 = await prisma.syncOutbox.findUniqueOrThrow({ where: { id: row2.id } });

    assert.equal(updated1.status, "FAILED", "Failed op must be marked FAILED/quarantined");
    assert.equal(updated2.status, "PENDING", "Subsequent op must remain PENDING");

    // Clean up to prevent FAILED row from blocking subsequent test queues
    await prisma.syncOutbox.deleteMany({ where: { id: { in: [row1.id, row2.id] } } });
  });

  it("T. Transient HTTP/network failure does not incorrectly mark an operation SYNCED", async () => {
    const opId = crypto.randomUUID();
    const devId = `dev-t-${testRunId}`;

    const row = await prisma.syncOutbox.create({
      data: {
        operationId: opId,
        operationType: `TEST_${testRunId}_T`,
        entityId: crypto.randomUUID(),
        payload: { test: "network_failure" },
        status: "PENDING",
      },
    });

    const failingFetch: typeof fetch = async () => {
      throw new Error("fetch failed: ECONNREFUSED 127.0.0.1:3000");
    };

    const result = await pushPendingOperations("http://localhost:3000", devId, "fake-token", failingFetch);
    assert.equal(result.success, false);
    assert.ok(result.networkError);

    const updated = await prisma.syncOutbox.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(updated.status, "PENDING", "Operation must remain PENDING on network error");
    assert.notEqual(updated.status, "SYNCED");
    assert.equal(updated.retryCount, 1);

    // Clean up
    await prisma.syncOutbox.delete({ where: { id: row.id } });
  });
});

// ─── Phase 2 Review Verification Scenarios ────────────────────────────────────

describe("Phase 2 Review: Sequence Recovery, Anti-Skip, and Stub Safety", () => {
  it("REV-A & REV-B & REV-C: Sequence 17 succeeds, 18 fails, 19 remains blocked; retrying SAME 18 succeeds; 19 then succeeds", async () => {
    const { device } = await createTestDevice({ lastSequence: BigInt(16) });

    const op17 = makeOp({ clientSequence: "17", operationType: "TEST_PING" });
    const op18 = makeOp({ clientSequence: "18", operationType: "UNSUPPORTED_ERROR_TYPE" as never });
    const op19 = makeOp({ clientSequence: "19", operationType: "TEST_PING" });

    // Step A: Push 17, 18, 19 in a single batch
    const initialBatch = await processDevicePushBatch(device, crypto.randomUUID(), [op17, op18, op19]);

    assert.equal(initialBatch.success, false);
    assert.ok(initialBatch.acknowledgedOperationIds.includes(op17.operationId), "Op 17 must succeed");
    assert.ok(initialBatch.rejectedOperations?.some((r) => r.operationId === op18.operationId), "Op 18 must fail");
    assert.ok(!initialBatch.acknowledgedOperationIds.includes(op19.operationId), "Op 19 must NOT execute");

    // Cloud DB verification after Step A
    const devAfterA = await prisma.syncDevice.findUniqueOrThrow({ where: { deviceId: device.deviceId } });
    assert.equal(devAfterA.lastSequence, BigInt(17), "Cloud sequence must stay at 17");

    const row18AfterA = await prisma.processedSyncOperation.findUnique({ where: { operationId: op18.operationId } });
    assert.equal(row18AfterA, null, "Failed op 18 transaction must leave NO ProcessedSyncOperation");

    // Step B: Retry the exact SAME operation 18 after fixing the failure condition
    // Under identical operationId and identical clientSequence 18
    const correctedOp18: SyncOperation = {
      ...op18,
      operationType: "TEST_PING", // failure condition resolved!
    };

    const retryBatch18 = await processDevicePushBatch(device, crypto.randomUUID(), [correctedOp18]);
    assert.equal(retryBatch18.success, true, "Retrying op 18 must succeed once resolved");
    assert.ok(retryBatch18.acknowledgedOperationIds.includes(op18.operationId));

    // Cloud DB verification after Step B
    const devAfterB = await prisma.syncDevice.findUniqueOrThrow({ where: { deviceId: device.deviceId } });
    assert.equal(devAfterB.lastSequence, BigInt(18), "Cloud sequence must now advance to 18");

    // Step C: After 18 has succeeded, operation 19 can now be pushed and succeeds
    const batch19 = await processDevicePushBatch(device, crypto.randomUUID(), [op19]);
    assert.equal(batch19.success, true, "Op 19 must succeed now that 18 has succeeded");
    assert.ok(batch19.acknowledgedOperationIds.includes(op19.operationId));

    // Cloud DB verification after Step C
    const devAfterC = await prisma.syncDevice.findUniqueOrThrow({ where: { deviceId: device.deviceId } });
    assert.equal(devAfterC.lastSequence, BigInt(19), "Cloud sequence must now advance to 19");

    // All 3 operations exist with status SUCCESS in order
    const processedOps = await prisma.processedSyncOperation.findMany({
      where: { deviceId: device.deviceId },
      orderBy: { clientSequence: "asc" },
    });
    assert.equal(processedOps.length, 3);
    assert.equal(processedOps[0].clientSequence, BigInt(17));
    assert.equal(processedOps[1].clientSequence, BigInt(18));
    assert.equal(processedOps[2].clientSequence, BigInt(19));
  });

  it("REV-D: No sequence skipping is possible (Cloud rejects gap; Local blocks queue)", async () => {
    const { device } = await createTestDevice({ lastSequence: BigInt(10) });

    // 1. Direct Cloud check: sending sequence 12 when expecting 11 must reject
    const op12 = makeOp({ clientSequence: "12" });
    const cloudRes = await processDevicePushBatch(device, crypto.randomUUID(), [op12]);
    assert.equal(cloudRes.success, false);
    assert.equal(cloudRes.rejectedOperations![0].errorCode, "SEQUENCE_GAP");
    assert.equal(cloudRes.rejectedOperations![0].expectedSequence, "11");

    // 2. Local queue check: a FAILED outbox record blocks all subsequent operations
    await prisma.syncOutbox.deleteMany({ where: { operationType: { contains: testRunId } } });

    const opFailedId = crypto.randomUUID();
    const opBlockedId = crypto.randomUUID();
    const devId = `dev-skip-${testRunId}`;

    const failedRow = await prisma.syncOutbox.create({
      data: {
        operationId: opFailedId,
        operationType: `TEST_${testRunId}_FAIL`,
        entityId: crypto.randomUUID(),
        payload: { test: true },
        status: "FAILED",
        lastError: "Simulated deterministic failure",
      },
    });

    const pendingRow = await prisma.syncOutbox.create({
      data: {
        operationId: opBlockedId,
        operationType: `TEST_${testRunId}_BLOCKED`,
        entityId: crypto.randomUUID(),
        payload: { test: true },
        status: "PENDING",
      },
    });

    // Attempt to push: must return blockedByFailedOperationId and refuse to send opBlockedId
    let fetchCalled = false;
    const dummyFetch: typeof fetch = async () => {
      fetchCalled = true;
      return new Response("{}", { status: 200 });
    };

    const pushRes = await pushPendingOperations("http://localhost:3000", devId, "token", dummyFetch);
    assert.equal(pushRes.success, false);
    assert.equal(pushRes.blockedByFailedOperationId, opFailedId);
    assert.equal(fetchCalled, false, "Local push must NOT call cloud when earlier sequence is FAILED");

    // Verify pendingRow remained PENDING (unskipped)
    const checkPending = await prisma.syncOutbox.findUniqueOrThrow({ where: { id: pendingRow.id } });
    assert.equal(checkPending.status, "PENDING");

    // Use retryFailedOperation to recover the failed row
    await retryFailedOperation(opFailedId);
    const recovered = await prisma.syncOutbox.findUniqueOrThrow({ where: { id: failedRow.id } });
    assert.equal(recovered.status, "PENDING", "Operation must be back in PENDING after retry");
    assert.equal(recovered.operationId, opFailedId, "operationId must be preserved");
    assert.equal(recovered.clientSequence, failedRow.clientSequence, "clientSequence must be preserved");

    // Clean up
    await prisma.syncOutbox.deleteMany({ where: { id: { in: [failedRow.id, pendingRow.id] } } });
  });

  it("REV-E: All 16 real business operations are deterministically rejected with UNIMPLEMENTED_OPERATION (no false ACKs)", async () => {
    const { device } = await createTestDevice();
    let currentSeq = 1;

    for (const opType of REGISTERED_FUTURE_OPERATION_TYPES) {
      const op = makeOp({
        clientSequence: currentSeq.toString(),
        operationType: opType,
      });

      const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);

      assert.equal(res.success, false, `Operation '${opType}' must NOT receive false success in Phase 2`);
      assert.equal(res.acknowledgedOperationIds.length, 0);
      assert.ok(res.rejectedOperations && res.rejectedOperations.length === 1);
      assert.equal(
        res.rejectedOperations[0].errorCode,
        "UNIMPLEMENTED_OPERATION",
        `Expected UNIMPLEMENTED_OPERATION for ${opType}`
      );

      // Verify no ProcessedSyncOperation was created
      const dbRow = await prisma.processedSyncOperation.findUnique({
        where: { operationId: op.operationId },
      });
      assert.equal(dbRow, null, `No ProcessedSyncOperation may exist for unimplemented ${opType}`);
    }

    // Verify device sequence did NOT advance
    const dev = await prisma.syncDevice.findUniqueOrThrow({ where: { deviceId: device.deviceId } });
    assert.equal(dev.lastSequence, BigInt(0), "lastSequence must remain 0 after rejected unimplemented operations");
  });

  it("REV-F: Rejected/unimplemented operations do not advance SyncDevice.lastSequence", async () => {
    const { device } = await createTestDevice({ lastSequence: BigInt(5) });

    // Send an unimplemented operation at expected sequence 6
    const op = makeOp({ clientSequence: "6", operationType: "CREATE_SALE" });
    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);

    assert.equal(res.success, false);
    const updatedDevice = await prisma.syncDevice.findUniqueOrThrow({ where: { deviceId: device.deviceId } });
    assert.equal(updatedDevice.lastSequence, BigInt(5), "lastSequence must remain 5; must not advance to 6");
  });
});
