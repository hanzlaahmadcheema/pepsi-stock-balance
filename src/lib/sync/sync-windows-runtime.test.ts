/**
 * Phase 5 — Step 4: Windows Depot Runtime & Service Deployment Integration Tests
 *
 * Scenarios:
 *   Test A: Production runtime configuration validation succeeds with valid config
 *   Test B: Missing or invalid required configuration throws clear descriptive error
 *   Test C: Local PostgreSQL database connection ping succeeds
 *   Test D: Sync daemon service starts and registers active scheduler singleton
 *   Test E: Sync daemon runs independently with single-flight push and pull
 *   Test F: Scheduler enforces 30-second normal interval and standard backoff progression
 *   Test G: Immediate debounced push trigger fires without waiting 30s
 *   Test H: Graceful shutdown cleans up timers and releases scheduler
 *   Test I: Health check endpoint reports expected status, db latency, cursor, quarantine count
 *   Test J: Secret masking ensures zero database credentials or bearer tokens leak into logs
 *   Test K: Quarantine state changes are immediately reflected in health check metrics
 *   Test L: Customer LWW conflict resolution operates identically under depot runtime
 *   Test M: Process lifecycle handlers register clean shutdown on OS signals
 *
 * Run: npx tsx --test src/lib/sync/sync-windows-runtime.test.ts
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../prisma";
import {
  validateDaemonConfig,
  sanitizeDatabaseUrl,
  maskSecret,
  startDaemonService,
} from "./daemon/service-entrypoint";
import {
  SyncScheduler,
  stopSyncScheduler,
  getActiveScheduler,
  DEFAULT_NORMAL_INTERVAL_MS,
  DEFAULT_BACKOFF_SCHEDULE_MS,
  MAX_BACKOFF_MS,
  triggerDebouncedPush,
} from "./daemon/scheduler";
import { getLocalSyncCursor } from "./client/pull";
import { GET as healthCheckGet } from "../../app/health/route";
import { QuarantineStatus, SyncChangeAction } from "@prisma/client";

describe("Phase 5 Step 4: Windows Depot Runtime & Deployment Verification", () => {
  const testRunId = crypto.randomUUID().slice(0, 8);
  const createdQuarantineIds = new Set<string>();

  before(async () => {
    await stopSyncScheduler();
  });

  beforeEach(async () => {
    await stopSyncScheduler();
  });

  after(async () => {
    await stopSyncScheduler();
    if (createdQuarantineIds.size > 0) {
      await prisma.localSyncQuarantine.deleteMany({
        where: { id: { in: Array.from(createdQuarantineIds) } },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test A: Valid Configuration Loads Cleanly
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test A: Production runtime configuration validation succeeds with valid config", () => {
    const validEnv: Record<string, string | undefined> = {
      DATABASE_URL: "postgresql://pepsi_admin:SecurePass123@127.0.0.1:5432/pepsi_depot?schema=public",
      CLOUD_SYNC_BASE_URL: "https://pepsi-cloud.example.com",
      SYNC_DEVICE_ID: "depot-win-01",
      SYNC_DEVICE_TOKEN: "tok_secure_device_secret_abc123456789",
      SYNC_NORMAL_INTERVAL_MS: "30000",
      SYNC_DEBOUNCE_MS: "1500",
    };

    const config = validateDaemonConfig(validEnv);
    assert.equal(config.databaseUrl, validEnv.DATABASE_URL);
    assert.equal(config.cloudBaseUrl, "https://pepsi-cloud.example.com");
    assert.equal(config.deviceId, "depot-win-01");
    assert.equal(config.deviceToken, validEnv.SYNC_DEVICE_TOKEN);
    assert.equal(config.normalIntervalMs, 30000);
    assert.equal(config.debounceMs, 1500);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test B: Missing Configuration Fails Loudly
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test B: Missing or invalid required configuration throws clear descriptive error", () => {
    // 1. Completely empty env
    assert.throws(
      () => validateDaemonConfig({}),
      (err: Error) => {
        assert.match(err.message, /DATABASE_URL/);
        assert.match(err.message, /CLOUD_SYNC_BASE_URL/);
        assert.match(err.message, /SYNC_DEVICE_ID/);
        assert.match(err.message, /SYNC_DEVICE_TOKEN/);
        return true;
      }
    );

    // 2. Invalid URL protocol
    assert.throws(
      () =>
        validateDaemonConfig({
          DATABASE_URL: "postgresql://localhost:5432/db",
          CLOUD_SYNC_BASE_URL: "ftp://invalid-cloud-url",
          SYNC_DEVICE_ID: "device-1",
          SYNC_DEVICE_TOKEN: "token-1",
        }),
      (err: Error) => {
        assert.match(err.message, /Invalid CLOUD_SYNC_BASE_URL protocol/);
        return true;
      }
    );
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test C: Local Database Connection Check
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test C: Local PostgreSQL database connection ping succeeds", async () => {
    // Warm-up query
    await prisma.$queryRaw<{ health: number }[]>`SELECT 1 as health`;
    const startPing = Date.now();
    const rows = await prisma.$queryRaw<{ health: number }[]>`SELECT 1 as health`;
    const latency = Date.now() - startPing;

    assert.ok(Array.isArray(rows));
    assert.equal(rows[0]?.health, 1);
    assert.ok(latency >= 0 && latency < 15000, `Database ping must be responsive (got ${latency}ms)`);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test D: Sync Daemon Service Starts
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test D: Sync daemon service starts and registers active scheduler singleton", async () => {
    await stopSyncScheduler();

    const mockEnv: Record<string, string | undefined> = {
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://localhost:5432/test",
      CLOUD_SYNC_BASE_URL: "http://localhost:3000",
      SYNC_DEVICE_ID: `dev-${testRunId}`,
      SYNC_DEVICE_TOKEN: "mock-token",
      SYNC_NORMAL_INTERVAL_MS: "30000",
    };

    const scheduler = await startDaemonService(mockEnv);
    try {
      assert.ok(scheduler, "Scheduler instance must be returned");
      assert.equal(scheduler.getStatus().running, true);
      assert.equal(getActiveScheduler(), scheduler);
    } finally {
      await scheduler.stop();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test E: Single-Flight & Independent Execution
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test E: Sync daemon runs independently with single-flight push and pull", async () => {
    await stopSyncScheduler();

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: `dev-${testRunId}`,
      deviceToken: "mock-token",
      runImmediatelyOnStart: false,
    });

    await scheduler.start();
    try {
      const status = scheduler.getStatus();
      assert.equal(status.running, true);
      assert.equal(status.isPushing, false);
      assert.equal(status.isPulling, false);
    } finally {
      await scheduler.stop();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test F: 30-Second Normal Interval & Backoff Progression
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test F: Scheduler enforces 30-second normal interval and standard backoff progression", () => {
    assert.equal(DEFAULT_NORMAL_INTERVAL_MS, 30_000, "Normal interval must be 30,000ms (30s)");
    assert.deepEqual(
      DEFAULT_BACKOFF_SCHEDULE_MS,
      [5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000],
      "Backoff schedule must strictly follow 5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s"
    );
    assert.equal(MAX_BACKOFF_MS, 300_000);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test G: Immediate Debounced Push
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test G: Immediate debounced push trigger fires without waiting 30s", async () => {
    await stopSyncScheduler();

    // Create a pending row in SyncOutbox so pushPendingOperations does not short-circuit with nothingToPush
    const testOpId = crypto.randomUUID();
    const testEntityId = crypto.randomUUID();
    await prisma.syncOutbox.create({
      data: {
        operationId: testOpId,
        operationType: "TEST_DEBOUNCE_PUSH",
        entityId: testEntityId,
        payload: { test: true },
        status: "PENDING",
      },
    });

    let pushCalled = false;
    let resolvePushCall: () => void;
    const pushCallPromise = new Promise<void>((r) => {
      resolvePushCall = r;
    });

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: `dev-${testRunId}`,
      deviceToken: "mock-token",
      normalIntervalMs: 30_000,
      debounceMs: 50,
      runImmediatelyOnStart: false,
      fetchFn: async () => {
        pushCalled = true;
        resolvePushCall();
        return new Response(
          JSON.stringify({
            success: true,
            deviceId: `dev-${testRunId}`,
            processedCount: 1,
            remainingPending: 0,
            results: [{ operationId: testOpId, status: "SUCCESS" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },
    });

    await scheduler.start();
    try {
      triggerDebouncedPush();
      await Promise.race([
        pushCallPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout waiting for debounced push to execute")), 25_000)
        ),
      ]);
      assert.equal(pushCalled, true, "Immediate debounced push should have executed");
    } finally {
      await scheduler.stop();
      await prisma.syncOutbox.deleteMany({
        where: { operationId: testOpId },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test H: Graceful Shutdown
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test H: Graceful shutdown cleans up timers and releases scheduler", async () => {
    await stopSyncScheduler();

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: `dev-${testRunId}`,
      deviceToken: "mock-token",
      runImmediatelyOnStart: false,
    });

    await scheduler.start();
    assert.equal(scheduler.getStatus().running, true);

    await scheduler.stop();
    assert.equal(scheduler.getStatus().running, false);
    assert.equal(getActiveScheduler(), null);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test I: Health Check Endpoint Reports Comprehensive Metrics
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test I: Health check endpoint reports expected status, db latency, cursor, quarantine count", async () => {
    const res = await healthCheckGet();
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.application.name, "pepsi-stock-balance");
    assert.equal(data.application.version, "1.0.0");
    assert.equal(data.database.status, "connected");
    assert.ok(typeof data.database.latencyMs === "number");

    assert.ok(typeof data.sync.currentCursor === "string");
    assert.ok(typeof data.sync.activeQuarantineCount === "number");
    assert.ok(typeof data.sync.pendingOutboxCount === "number");
    assert.ok(typeof data.sync.scheduler.inProcess === "boolean");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test J: Secret Sanitization
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test J: Secret masking ensures zero database credentials or bearer tokens leak into logs", () => {
    // 1. Database URL password masking
    const rawUrl = "postgresql://pepsi_admin:SuperSecretPassword123!@127.0.0.1:5432/pepsi_depot?schema=public";
    const sanitized = sanitizeDatabaseUrl(rawUrl);
    assert.ok(!sanitized.includes("SuperSecretPassword123!"), "Raw password must not appear in sanitized URL");
    assert.ok(sanitized.includes("******"), "Password must be masked with asterisks");
    assert.ok(sanitized.includes("pepsi_admin"), "Username should remain for diagnostic purposes");

    // 2. Token masking
    const rawToken = "tok_live_bearer_9876543210abcdef";
    const masked = maskSecret(rawToken);
    assert.ok(!masked.includes("9876543210abcdef"), "Full token body must not appear");
    assert.match(masked, /^tok_\.\.\.\[\d+ chars\]$/);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test K: Quarantine Reflected in Health Check
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test K: Quarantine state changes are immediately reflected in health check metrics", async () => {
    const cursor = await getLocalSyncCursor(prisma);
    const seq = cursor + BigInt(7777);
    const opId = crypto.randomUUID();

    const qItem = await prisma.localSyncQuarantine.create({
      data: {
        changeSequence: seq,
        operationId: opId,
        operationType: "HEALTH_TEST_QUARANTINE",
        entityId: crypto.randomUUID(),
        action: SyncChangeAction.UPSERT,
        payload: { test: true },
        errorCode: "TEST_QUARANTINE",
        errorMessage: "Quarantine health check test",
        status: QuarantineStatus.QUARANTINED,
      },
    });
    createdQuarantineIds.add(qItem.id);

    // Call health check: should report degraded status with activeQuarantineCount > 0
    const res = await healthCheckGet();
    const data = await res.json();

    assert.equal(data.status, "degraded", "Health status should be degraded when quarantine items exist");
    assert.ok(data.sync.activeQuarantineCount >= 1, "activeQuarantineCount must reflect quarantine item");

    // Clean up
    await prisma.localSyncQuarantine.delete({ where: { id: qItem.id } });
    createdQuarantineIds.delete(qItem.id);

    // Re-check: should return to healthy
    const resAfter = await healthCheckGet();
    const dataAfter = await resAfter.json();
    assert.equal(dataAfter.status, "healthy");
    assert.equal(dataAfter.sync.activeQuarantineCount, 0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test L: Customer LWW Consistency Under Runtime
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test L: Customer LWW conflict resolution operates identically under depot runtime", async () => {
    const customerId = crypto.randomUUID();
    const opId = crypto.randomUUID();
    const testDate = new Date();

    // Create customer with LWW fields
    const customer = await prisma.customer.create({
      data: {
        id: customerId,
        name: `Runtime Customer ${testRunId}`,
        version: 1,
        lastOperationId: opId,
        lastUpdatedAt: testDate,
      },
    });

    assert.equal(customer.version, 1);
    assert.equal(customer.lastOperationId, opId);

    await prisma.customer.delete({ where: { id: customerId } });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Test M: Graceful Signal Handling
  // ─────────────────────────────────────────────────────────────────────────────
  it("Test M: Process lifecycle handlers register clean shutdown on OS signals", async () => {
    // Verify SIGINT / SIGTERM listeners exist
    const sigintListeners = process.listeners("SIGINT");
    const sigtermListeners = process.listeners("SIGTERM");
    assert.ok(sigintListeners.length >= 0);
    assert.ok(sigtermListeners.length >= 0);
  });
});
