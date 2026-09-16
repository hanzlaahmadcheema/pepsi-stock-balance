import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { SyncStatus, SyncChangeAction } from "@prisma/client";
import crypto from "node:crypto";

describe("Phase 1: Sync Foundation Database Verification", () => {
  const testRunId = crypto.randomUUID().slice(0, 8);
  const testDeviceId = `test-dev-${testRunId}`;
  const testDeviceId2 = `test-dev-2-${testRunId}`;
  let testUserId: string;

  before(async () => {
    // Find or create a user for AuditLog tests
    const existingUser = await prisma.user.findFirst({ select: { id: true } });
    if (existingUser) {
      testUserId = existingUser.id;
    } else {
      const newUser = await prisma.user.create({
        data: {
          authUserId: `auth-test-${testRunId}`,
          name: "Sync Foundation Tester",
          role: "OWNER",
        },
      });
      testUserId = newUser.id;
    }
  });

  after(async () => {
    // Clean up test records
    await prisma.syncOutbox.deleteMany({
      where: { operationType: { startsWith: `TEST_${testRunId}` } },
    });
    await prisma.processedSyncOperation.deleteMany({
      where: { deviceId: { in: [testDeviceId, testDeviceId2] } },
    });
    await prisma.syncChangeLog.deleteMany({
      where: { operationType: { startsWith: `TEST_${testRunId}` } },
    });
    await prisma.syncDevice.deleteMany({
      where: { deviceId: { in: [testDeviceId, testDeviceId2] } },
    });
    await prisma.auditLog.deleteMany({
      where: { reason: `Sync foundation test ${testRunId}` },
    });
  });

  it("1. SyncOutbox - enforces operationId uniqueness", async () => {
    const opId = crypto.randomUUID();
    const entityId = crypto.randomUUID();

    // First insert succeeds
    const record1 = await prisma.syncOutbox.create({
      data: {
        operationId: opId,
        operationType: `TEST_${testRunId}_SALE`,
        entityId,
        payload: { test: true },
        status: SyncStatus.PENDING,
      },
    });
    assert.equal(record1.operationId, opId);
    assert.equal(record1.status, SyncStatus.PENDING);

    // Duplicate operationId must reject
    await assert.rejects(
      async () => {
        await prisma.syncOutbox.create({
          data: {
            operationId: opId,
            operationType: `TEST_${testRunId}_SALE`,
            entityId,
            payload: { duplicate: true },
          },
        });
      },
      (err: Error) => {
        assert.match(err.message, /Unique constraint failed/);
        return true;
      }
    );
  });

  it("2. SyncOutbox - generates strictly increasing clientSequence", async () => {
    const recordA = await prisma.syncOutbox.create({
      data: {
        operationId: crypto.randomUUID(),
        operationType: `TEST_${testRunId}_SEQ_A`,
        entityId: crypto.randomUUID(),
        payload: { seq: "A" },
      },
    });

    const recordB = await prisma.syncOutbox.create({
      data: {
        operationId: crypto.randomUUID(),
        operationType: `TEST_${testRunId}_SEQ_B`,
        entityId: crypto.randomUUID(),
        payload: { seq: "B" },
      },
    });

    assert.ok(
      recordB.clientSequence > recordA.clientSequence,
      `Expected ${recordB.clientSequence} > ${recordA.clientSequence}`
    );
  });

  it("3. SyncOutbox - supports all defined enum statuses", async () => {
    const statuses: SyncStatus[] = [
      SyncStatus.PENDING,
      SyncStatus.IN_FLIGHT,
      SyncStatus.SYNCED,
      SyncStatus.FAILED,
    ];

    for (const st of statuses) {
      const record = await prisma.syncOutbox.create({
        data: {
          operationId: crypto.randomUUID(),
          operationType: `TEST_${testRunId}_STATUS`,
          entityId: crypto.randomUUID(),
          payload: { statusTest: st },
          status: st,
          lastError: st === SyncStatus.FAILED ? "Simulated test error" : null,
          syncedAt: st === SyncStatus.SYNCED ? new Date() : null,
        },
      });
      assert.equal(record.status, st);
    }
  });

  it("4. SyncCursor - enforces singleton and safe advancement", async () => {
    // Ensure or advance the singleton cursor
    const cursor1 = await prisma.syncCursor.upsert({
      where: { id: "cloud_cursor" },
      update: { lastSequence: BigInt(1050), lastSyncedAt: new Date() },
      create: { id: "cloud_cursor", lastSequence: BigInt(1050) },
    });
    assert.equal(cursor1.id, "cloud_cursor");
    assert.equal(cursor1.lastSequence, BigInt(1050));

    // Advance cursor transactionally
    const cursor2 = await prisma.syncCursor.update({
      where: { id: "cloud_cursor" },
      data: { lastSequence: BigInt(1095), lastSyncedAt: new Date() },
    });
    assert.equal(cursor2.lastSequence, BigInt(1095));

    // Attempting to create a duplicate with the same id fails
    await assert.rejects(
      async () => {
        await prisma.syncCursor.create({
          data: { id: "cloud_cursor", lastSequence: BigInt(2000) },
        });
      },
      (err: Error) => {
        assert.match(err.message, /Unique constraint failed/);
        return true;
      }
    );
  });

  it("5. ProcessedSyncOperation - enforces operationId and (deviceId, clientSequence) uniqueness", async () => {
    const opId1 = crypto.randomUUID();
    const entityId = crypto.randomUUID();

    // 1. Insert first processed op
    await prisma.processedSyncOperation.create({
      data: {
        operationId: opId1,
        deviceId: testDeviceId,
        clientSequence: BigInt(1),
        operationType: "CREATE_SALE",
        entityId,
        status: "SUCCESS",
      },
    });

    // 2. Duplicate operationId must reject
    await assert.rejects(
      async () => {
        await prisma.processedSyncOperation.create({
          data: {
            operationId: opId1,
            deviceId: testDeviceId,
            clientSequence: BigInt(2),
            operationType: "CREATE_SALE",
            entityId,
            status: "SUCCESS",
          },
        });
      },
      (err: Error) => {
        assert.match(err.message, /Unique constraint failed/);
        return true;
      }
    );

    // 3. Same device with duplicate clientSequence must reject
    await assert.rejects(
      async () => {
        await prisma.processedSyncOperation.create({
          data: {
            operationId: crypto.randomUUID(),
            deviceId: testDeviceId,
            clientSequence: BigInt(1), // duplicate sequence for testDeviceId
            operationType: "RECORD_PAYMENT",
            entityId,
            status: "SUCCESS",
          },
        });
      },
      (err: Error) => {
        assert.match(err.message, /Unique constraint failed/);
        return true;
      }
    );

    // 4. Different device with same clientSequence MUST succeed
    const differentDeviceOp = await prisma.processedSyncOperation.create({
      data: {
        operationId: crypto.randomUUID(),
        deviceId: testDeviceId2,
        clientSequence: BigInt(1), // same sequence, but different device
        operationType: "RECORD_PAYMENT",
        entityId,
        status: "SUCCESS",
      },
    });
    assert.equal(differentDeviceOp.deviceId, testDeviceId2);
  });

  it("6. SyncChangeLog - generates monotonic global changeSequence and supports UPSERT and DELETE", async () => {
    const entityId = crypto.randomUUID();
    const opId1 = crypto.randomUUID();
    const opId2 = crypto.randomUUID();

    const change1 = await prisma.syncChangeLog.create({
      data: {
        operationId: opId1,
        operationType: `TEST_${testRunId}_PROD`,
        entityId,
        action: SyncChangeAction.UPSERT,
        payload: { name: "Pepsi 250ml", price: 540 },
        sourceDeviceId: testDeviceId,
      },
    });

    const change2 = await prisma.syncChangeLog.create({
      data: {
        operationId: opId2,
        operationType: `TEST_${testRunId}_PROD`,
        entityId,
        action: SyncChangeAction.DELETE,
        payload: { id: entityId },
        sourceDeviceId: null, // Originating from Cloud directly
      },
    });

    assert.ok(
      change2.changeSequence > change1.changeSequence,
      `Expected ${change2.changeSequence} > ${change1.changeSequence}`
    );
    assert.equal(change1.operationId, opId1);
    assert.equal(change2.operationId, opId2);
    assert.equal(change1.action, SyncChangeAction.UPSERT);
    assert.equal(change2.action, SyncChangeAction.DELETE);
    assert.equal(change1.sourceDeviceId, testDeviceId);
    assert.equal(change2.sourceDeviceId, null);
  });

  it("7. SyncDevice - enforces deviceId uniqueness and state tracking", async () => {
    const device = await prisma.syncDevice.create({
      data: {
        deviceId: testDeviceId,
        name: "Lahore Depot Test Server",
        tokenHash: "sha256_mock_hash_for_testing",
        isRevoked: false,
        lastSequence: BigInt(42),
      },
    });
    assert.equal(device.deviceId, testDeviceId);
    assert.equal(device.isRevoked, false);
    assert.equal(device.lastSequence, BigInt(42));

    // Duplicate deviceId must reject
    await assert.rejects(
      async () => {
        await prisma.syncDevice.create({
          data: {
            deviceId: testDeviceId,
            name: "Duplicate Lahore Depot",
            tokenHash: "another_hash",
          },
        });
      },
      (err: Error) => {
        assert.match(err.message, /Unique constraint failed/);
        return true;
      }
    );
  });

  it("8. AuditLog - supports nullable deviceId and records terminal identity", async () => {
    const entityId = crypto.randomUUID();

    // 1. AuditLog without deviceId (legacy / web behavior)
    const logNoDevice = await prisma.auditLog.create({
      data: {
        userId: testUserId,
        action: "TEST_LEGACY_AUDIT",
        entityType: "TestEntity",
        entityId,
        reason: `Sync foundation test ${testRunId}`,
        deviceId: null,
      },
    });
    assert.equal(logNoDevice.deviceId, null);

    // 2. AuditLog with terminal deviceId
    const logWithDevice = await prisma.auditLog.create({
      data: {
        userId: testUserId,
        action: "TEST_TERMINAL_AUDIT",
        entityType: "TestEntity",
        entityId,
        reason: `Sync foundation test ${testRunId}`,
        deviceId: testDeviceId,
      },
    });
    assert.equal(logWithDevice.deviceId, testDeviceId);

    // 3. Querying by deviceId works efficiently
    const foundLogs = await prisma.auditLog.findMany({
      where: { deviceId: testDeviceId },
    });
    assert.ok(foundLogs.length >= 1);
    assert.equal(foundLogs[0].deviceId, testDeviceId);
  });
});
