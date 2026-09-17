/**
 * Phase 5 — Step 2: Sync Daemon / Runtime Scheduler Integration Tests
 *
 * Covers all scenarios required for Phase 5 Step 2:
 *   A. 30-second scheduling & default configuration
 *   B. Immediate / debounced push trigger
 *   C. Repeated mutation bursts produce one debounced push
 *   D. Push and Pull can run independently and concurrently
 *   E. Overlapping push is blocked by existing advisory lock
 *   F. Overlapping pull is blocked by existing advisory lock
 *   G. Network failure enters backoff (5s)
 *   H. Backoff increases correctly (5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s max)
 *   I. Successful sync resets backoff to 0
 *   J. Sync failure does not kill daemon
 *   K. Clean shutdown clears timers and in-flight operations safely
 *   L. Duplicate scheduler start is prevented
 *   M. Existing quarantine behavior remains intact
 *   N. Existing customer LWW behavior remains intact
 *
 * Run: npx tsx src/lib/sync/sync-daemon-scheduler.test.ts
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../prisma";
import { hashToken } from "./server/authentication";
import {
  SyncScheduler,
  DEFAULT_NORMAL_INTERVAL_MS,
  DEFAULT_DEBOUNCE_MS,
  DEFAULT_BACKOFF_SCHEDULE_MS,
  MAX_BACKOFF_MS,
  isNetworkOrOfflineError,
  getActiveScheduler,
  stopSyncScheduler,
} from "./daemon/scheduler";
import {
  SYNC_PUSH_ADVISORY_LOCK_ID,
} from "./client/push";
import {
  SYNC_PULL_ADVISORY_LOCK_ID,
  getLocalSyncCursor,
  PullApplyError,
} from "./client/pull";
import {
  PriceTier,
  Role,
  QuarantineStatus,
  type SyncDevice,
} from "@prisma/client";
import type {
  SyncBatchPullResponse,
  SyncChangeRecord,
  SyncBatchPushResponse,
} from "./types";

// ─── Fixtures & Tracking ──────────────────────────────────────────────────────

const testRunId = crypto.randomUUID().slice(0, 8);
const createdDeviceIds = new Set<string>();
const createdCustomerIds = new Set<string>();
const createdOutboxIds = new Set<string>();
const createdProcessedOpIds = new Set<string>();
const createdQuarantineOpIds = new Set<string>();
const createdChangeLogOpIds = new Set<string>();

async function createTestDevice(): Promise<{ device: SyncDevice; rawToken: string }> {
  const devId = `dev-sch-${testRunId}-${crypto.randomUUID().slice(0, 8)}`;
  const rawToken = `tok-sch-${crypto.randomBytes(16).toString("hex")}`;
  const tokenHash = hashToken(rawToken);

  const device = await prisma.syncDevice.create({
    data: {
      deviceId: devId,
      name: `Scheduler Test Device ${devId}`,
      tokenHash,
      isRevoked: false,
      lastSequence: BigInt(0),
    },
  });
  createdDeviceIds.add(devId);
  return { device, rawToken };
}

async function createPendingOutboxRow(seq = 1): Promise<string> {
  const opId = crypto.randomUUID();
  const row = await prisma.syncOutbox.create({
    data: {
      operationId: opId,
      clientSequence: BigInt(seq),
      operationType: "UPSERT_CUSTOMER",
      entityId: crypto.randomUUID(),
      payload: { name: `Pending ${opId.slice(0, 8)}` },
      status: "PENDING",
    },
  });
  createdOutboxIds.add(row.id);
  return opId;
}

describe("Phase 5 Step 2: Sync Daemon / Runtime Scheduler", { concurrency: 1 }, () => {
  before(async () => {
    await stopSyncScheduler();
    await prisma.syncOutbox.deleteMany();
    await prisma.localSyncQuarantine.deleteMany();
    await prisma.localProcessedChange.deleteMany();
  });

  beforeEach(async () => {
    await stopSyncScheduler();
    await prisma.syncOutbox.deleteMany();
    await prisma.localSyncQuarantine.deleteMany();
    await prisma.localProcessedChange.deleteMany();
  });

  after(async () => {
    await stopSyncScheduler();
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
  });

  // ─── A. 30-Second Scheduling ──────────────────────────────────────────────

  it("A. Default configuration enforces 30-second scheduling and standard backoff schedule", async () => {
    assert.equal(DEFAULT_NORMAL_INTERVAL_MS, 30_000, "Normal interval must be 30 seconds");
    assert.equal(DEFAULT_DEBOUNCE_MS, 1_000, "Default debounce must be 1 second");
    assert.deepEqual(
      DEFAULT_BACKOFF_SCHEDULE_MS,
      [5_000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000],
      "Backoff schedule must match 5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s max"
    );
    assert.equal(MAX_BACKOFF_MS, 300_000);

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test",
      deviceToken: "tok-test",
      runImmediatelyOnStart: false,
    });

    const status = scheduler.getStatus();
    assert.equal(status.running, false);
    assert.equal(status.currentPushIntervalMs, 30_000);
    assert.equal(status.currentPullIntervalMs, 30_000);
    assert.equal(status.pushBackoffIndex, 0);
    assert.equal(status.pullBackoffIndex, 0);
  });

  // ─── B. Immediate / Debounced Push Trigger ─────────────────────────────────

  it("B. Immediate/debounced push trigger fires push without waiting 30 seconds", async () => {
    let pushExecuted = false;
    const mockFetch = async () => {
      pushExecuted = true;
      return new Response(
        JSON.stringify({
          success: true,
          batchId: crypto.randomUUID(),
          acknowledgedOperationIds: [],
          rejectedOperations: [],
          serverTimestamp: new Date().toISOString(),
        } satisfies SyncBatchPushResponse),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test",
      deviceToken: "tok-test",
      normalIntervalMs: 30_000,
      debounceMs: 50, // Short debounce for fast test execution
      runImmediatelyOnStart: false,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await scheduler.start();
    assert.equal(pushExecuted, false, "Push should not run immediately when runImmediatelyOnStart: false");

    // Create a pending outbox row to push
    await createPendingOutboxRow();

    // Trigger immediate push
    scheduler.triggerImmediatePush();

    // Wait for debounce window (50ms) + remote DB push execution (up to 30s)
    const deadlineB = Date.now() + 30_000;
    while (!pushExecuted && Date.now() < deadlineB) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    assert.equal(pushExecuted, true, "Immediate push must execute after debounce delay");
    await scheduler.stop();
  });

  // ─── C. Repeated Mutation Bursts Produce One Debounced Push ───────────────

  it("C. Repeated mutation bursts produce exactly one debounced push", async () => {
    let pushCallCount = 0;
    const mockFetch = async () => {
      pushCallCount++;
      return new Response(
        JSON.stringify({
          success: true,
          batchId: crypto.randomUUID(),
          acknowledgedOperationIds: [],
          rejectedOperations: [],
          serverTimestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test",
      deviceToken: "tok-test",
      normalIntervalMs: 30_000,
      debounceMs: 80,
      runImmediatelyOnStart: false,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await scheduler.start();

    // Create a pending outbox row so push triggers fetch
    await createPendingOutboxRow();

    // Simulate 10 rapid mutations occurring in tight succession
    for (let i = 0; i < 10; i++) {
      scheduler.triggerImmediatePush();
      await new Promise((resolve) => setTimeout(resolve, 5)); // 5ms gap
    }

    // Wait for debounce delay (80ms) + remote DB push execution (up to 10s)
    const deadlineC = Date.now() + 10_000;
    while (pushCallCount === 0 && Date.now() < deadlineC) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Wait a brief margin to verify no extra duplicate push was fired
    await new Promise((resolve) => setTimeout(resolve, 200));

    assert.equal(pushCallCount, 1, "A burst of 10 mutations within the debounce window must trigger exactly 1 push");
    await scheduler.stop();
  });

  // ─── D. Push and Pull Can Run Independently ───────────────────────────────

  it("D. Push and Pull run independently and concurrently without cross-blocking", async () => {
    let pushStarted = false;
    let pullStarted = false;

    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/sync/push")) {
        pushStarted = true;
        // Hold push open slightly to verify concurrency
        await new Promise((resolve) => setTimeout(resolve, 50));
        return new Response(
          JSON.stringify({
            success: true,
            deviceId: "dev-test",
            batchId: crypto.randomUUID(),
            processedCount: 0,
            acknowledgedOperationIds: [],
            rejectedOperations: [],
            serverTimestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else if (urlStr.includes("/api/sync/pull")) {
        pullStarted = true;
        return new Response(
          JSON.stringify({
            success: true,
            deviceId: "dev-test",
            fromSequence: "0",
            toSequence: "0",
            hasMore: false,
            serverTimestamp: new Date().toISOString(),
            changes: [],
          } satisfies SyncBatchPullResponse),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test",
      deviceToken: "tok-test",
      runImmediatelyOnStart: false,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    await scheduler.start();

    // Create a pending outbox row so push calls mockFetch
    await createPendingOutboxRow();

    // Run push and pull simultaneously
    const [pushRes, pullRes] = await Promise.all([
      scheduler.runPushCycle(),
      scheduler.runPullCycle(),
    ]);

    assert.equal(pushStarted, true, "Push cycle must have started");
    assert.equal(pullStarted, true, "Pull cycle must have started");
    assert.ok(pushRes, "Push result returned");
    assert.ok(pullRes, "Pull result returned");

    const status = scheduler.getStatus();
    assert.equal(status.totalPushCycles, 1);
    assert.equal(status.totalPullCycles, 1);
    assert.equal(status.lastPushSuccess, true);
    assert.equal(status.lastPullSuccess, true);

    await scheduler.stop();
  });

  // ─── E. Overlapping Push is Blocked by Existing Advisory Lock ─────────────

  it("E. Overlapping push is blocked by advisory lock without advancing backoff", async () => {
    const { device, rawToken } = await createTestDevice();

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: device.deviceId,
      deviceToken: rawToken,
      runImmediatelyOnStart: false,
    });
    await scheduler.start();

    // Acquire the Push advisory lock in a separate PostgreSQL transaction
    let releaseBgLock: () => void = () => {};
    let bgTxPromise: Promise<unknown> = Promise.resolve();
    const lockAcquired = new Promise<void>((resolve) => {
      bgTxPromise = prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ acquired: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${SYNC_PUSH_ADVISORY_LOCK_ID}) as acquired
        `;
        assert.equal(rows[0]?.acquired, true);
        resolve();
        await new Promise<void>((res) => {
          releaseBgLock = res;
        });
      }, { timeout: 60000, maxWait: 20000 });
    });

    await lockAcquired;

    // Run push cycle while lock is held
    const result = await scheduler.runPushCycle();
    assert.ok(result, "Push cycle returned a result");
    assert.equal(result.alreadyRunning, true, "Push must report alreadyRunning: true");

    const status = scheduler.getStatus();
    assert.equal(status.pushBackoffIndex, 0, "Lock contention must NOT increase backoff");

    releaseBgLock();
    await bgTxPromise;
    await scheduler.stop();
  });

  // ─── F. Overlapping Pull is Blocked by Existing Advisory Lock ─────────────

  it("F. Overlapping pull is blocked by advisory lock without advancing backoff", async () => {
    const { device, rawToken } = await createTestDevice();

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: device.deviceId,
      deviceToken: rawToken,
      runImmediatelyOnStart: false,
      fetchFn: (async () => {
        return new Response(
          JSON.stringify({
            success: true,
            deviceId: device.deviceId,
            fromSequence: "0",
            toSequence: "1",
            hasMore: false,
            serverTimestamp: new Date().toISOString(),
            changes: [
              {
                changeSequence: "1",
                operationId: crypto.randomUUID(),
                operationType: "UPSERT_PRODUCT",
                entityId: crypto.randomUUID(),
                action: "UPSERT",
                payload: { name: "Advisory Test Product", brand: "Test" },
                sourceDeviceId: "cloud",
                createdAt: new Date().toISOString(),
              } as SyncChangeRecord,
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as unknown as typeof fetch,
    });
    await scheduler.start();

    // Acquire the Pull advisory lock in a separate transaction
    let releaseBgLock: () => void = () => {};
    let bgTxPromise: Promise<unknown> = Promise.resolve();
    const lockAcquired = new Promise<void>((resolve) => {
      bgTxPromise = prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ acquired: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(${SYNC_PULL_ADVISORY_LOCK_ID}) as acquired
        `;
        assert.equal(rows[0]?.acquired, true);
        resolve();
        await new Promise<void>((res) => {
          releaseBgLock = res;
        });
      }, { timeout: 60000, maxWait: 20000 });
    });

    await lockAcquired;

    // Run pull cycle while lock is held
    const result = await scheduler.runPullCycle();
    assert.ok(result, "Pull cycle returned a result");
    assert.equal(result.alreadyRunning, true, "Pull must report alreadyRunning: true");

    const status = scheduler.getStatus();
    assert.equal(status.pullBackoffIndex, 0, "Lock contention must NOT increase backoff");

    releaseBgLock();
    await bgTxPromise;
    await scheduler.stop();
  });

  // ─── G. Network Failure Enters Backoff (5s) ────────────────────────────────

  it("G. Network failure enters 5-second backoff level", async () => {
    const mockNetworkFailFetch = async () => {
      throw new TypeError("fetch failed: ECONNREFUSED");
    };

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test",
      deviceToken: "tok-test",
      runImmediatelyOnStart: false,
      fetchFn: mockNetworkFailFetch as unknown as typeof fetch,
    });

    await scheduler.start();

    // Create pending outbox row to trigger push fetch
    await createPendingOutboxRow();

    // Run push cycle that encounters network failure
    const res = await scheduler.runPushCycle();

    const status = scheduler.getStatus();
    assert.equal(status.lastPushSuccess, false);
    assert.equal(status.pushBackoffIndex, 1, "First network failure must set backoff level 1");
    assert.equal(status.currentPushIntervalMs, 5_000, "First backoff interval must be 5s (5000ms)");
    assert.ok(status.lastPushError?.includes("fetch failed") || status.lastPushError?.includes("ECONNREFUSED"));

    await scheduler.stop();
  });

  // ─── H. Backoff Increases Correctly (5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s) ──

  it("H. Backoff escalates: 5s -> 10s -> 20s -> 40s -> 80s -> 160s -> 300s max", async () => {
    const mockNetworkFailFetch = async () => {
      throw new TypeError("fetch failed: ENOTFOUND");
    };

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test",
      deviceToken: "tok-test",
      runImmediatelyOnStart: false,
      fetchFn: mockNetworkFailFetch as unknown as typeof fetch,
    });

    await scheduler.start();

    // Create pending outbox row to trigger push fetch across retries
    await createPendingOutboxRow();

    const expectedIntervals = [
      5_000,   // after failure 1 (index 1)
      10_000,  // after failure 2 (index 2)
      20_000,  // after failure 3 (index 3)
      40_000,  // after failure 4 (index 4)
      80_000,  // after failure 5 (index 5)
      160_000, // after failure 6 (index 6)
      300_000, // after failure 7 (index 6 capped)
      300_000, // after failure 8 (remains at max)
    ];

    for (let i = 0; i < expectedIntervals.length; i++) {
      await scheduler.runPushCycle();
      const status = scheduler.getStatus();
      assert.equal(
        status.currentPushIntervalMs,
        expectedIntervals[i],
        `After failure ${i + 1}, backoff interval should be ${expectedIntervals[i]}ms`
      );
    }

    await scheduler.stop();
  });

  // ─── I. Successful Sync Resets Backoff ─────────────────────────────────────

  it("I. Successful sync immediately resets backoff to 0 and restores 30s interval", async () => {
    let shouldFail = true;

    const mockToggleFetch = async () => {
      if (shouldFail) {
        throw new TypeError("fetch failed: offline");
      }
      return new Response(
        JSON.stringify({
          success: true,
          deviceId: "dev-test",
          batchId: crypto.randomUUID(),
          processedCount: 0,
          acknowledgedOperationIds: [],
          rejectedOperations: [],
          serverTimestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test",
      deviceToken: "tok-test",
      normalIntervalMs: 30_000,
      runImmediatelyOnStart: false,
      fetchFn: mockToggleFetch as unknown as typeof fetch,
    });

    await scheduler.start();

    // Create pending outbox row to trigger push fetch
    await createPendingOutboxRow();

    // Trigger 3 failures
    await scheduler.runPushCycle();
    await scheduler.runPushCycle();
    await scheduler.runPushCycle();

    let status = scheduler.getStatus();
    assert.equal(status.pushBackoffIndex, 3);
    assert.equal(status.currentPushIntervalMs, 20_000);

    // Network returns!
    shouldFail = false;
    await scheduler.runPushCycle();

    status = scheduler.getStatus();
    assert.equal(status.lastPushSuccess, true);
    assert.equal(status.pushBackoffIndex, 0, "Backoff index must reset to 0 after success");
    assert.equal(status.currentPushIntervalMs, 30_000, "Interval must reset to 30 seconds");

    await scheduler.stop();
  });

  // ─── J. Sync Failure Does Not Kill Daemon ──────────────────────────────────

  it("J. Individual sync failures (HTTP 500, network, DB) do not terminate the scheduler", async () => {
    let callCount = 0;
    const mockFaultyFetch = async () => {
      callCount++;
      if (callCount === 1) throw new TypeError("fetch failed: socket hang up");
      if (callCount === 2) {
        return new Response(JSON.stringify({ error: "Cloud 500 Internal Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          success: true,
          deviceId: "dev-test",
          batchId: crypto.randomUUID(),
          processedCount: 0,
          acknowledgedOperationIds: [],
          rejectedOperations: [],
          serverTimestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test",
      deviceToken: "tok-test",
      runImmediatelyOnStart: false,
      fetchFn: mockFaultyFetch as unknown as typeof fetch,
    });

    await scheduler.start();

    // Cycle 1: network exception
    await scheduler.runPushCycle();
    assert.equal(scheduler.isRunning(), true, "Scheduler must remain running after network exception");

    // Cycle 2: HTTP 500
    await scheduler.runPushCycle();
    assert.equal(scheduler.isRunning(), true, "Scheduler must remain running after HTTP 500");

    // Cycle 3: Success
    await scheduler.runPushCycle();
    assert.equal(scheduler.isRunning(), true, "Scheduler must remain running after success");
    assert.equal(scheduler.getStatus().lastPushSuccess, true);

    await scheduler.stop();
  });

  // ─── K. Clean Shutdown ────────────────────────────────────────────────────

  it("K. Clean shutdown cancels timers and in-flight operations without dangling handles", async () => {
    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test",
      deviceToken: "tok-test",
      normalIntervalMs: 10_000,
      debounceMs: 5_000,
      runImmediatelyOnStart: false,
    });

    await scheduler.start();
    assert.equal(scheduler.isRunning(), true);

    // Queue a debounced push
    scheduler.triggerImmediatePush();

    // Stop cleanly
    await scheduler.stop();

    assert.equal(scheduler.isRunning(), false, "Scheduler should not be running after stop()");
    assert.equal(getActiveScheduler(), null, "Global active scheduler reference must be null");

    // Calling runPushCycle after stop is a safe no-op
    const noopResult = await scheduler.runPushCycle();
    assert.equal(noopResult, null);
  });

  // ─── L. Duplicate Scheduler Start Is Prevented ────────────────────────────

  it("L. Duplicate scheduler start within the same process is prevented", async () => {
    const scheduler1 = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test-1",
      deviceToken: "tok-test-1",
      runImmediatelyOnStart: false,
    });

    await scheduler1.start();
    assert.equal(scheduler1.isRunning(), true);

    // Attempting to call start() again on the same instance
    await assert.rejects(
      async () => {
        await scheduler1.start();
      },
      /SyncScheduler is already running/,
      "Calling start() on an already-running scheduler must throw"
    );

    // Attempting to start a second instance concurrently
    const scheduler2 = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: "dev-test-2",
      deviceToken: "tok-test-2",
      runImmediatelyOnStart: false,
    });

    await assert.rejects(
      async () => {
        await scheduler2.start();
      },
      /A SyncScheduler instance is already running in this process/,
      "Starting a second scheduler in the same process must throw"
    );

    await scheduler1.stop();
    assert.equal(scheduler1.isRunning(), false);

    // After stopping scheduler1, scheduler2 can now start cleanly
    await scheduler2.start();
    assert.equal(scheduler2.isRunning(), true);
    await scheduler2.stop();
  });

  // ─── M. Existing Quarantine Behavior Remains Intact ───────────────────────

  it("M. Existing pull quarantine semantics remain intact under the scheduler", async () => {
    const { device, rawToken } = await createTestDevice();
    const badOpId = crypto.randomUUID();
    createdQuarantineOpIds.add(badOpId);
    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();

    // Mock pull response containing a deterministic authority violation
    const mockQuarantinePullFetch = async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/sync/pull")) {
        return new Response(
          JSON.stringify({
            success: true,
            deviceId: device.deviceId,
            fromSequence: curBefore.toString(),
            toSequence: nextSeq,
            hasMore: false,
            serverTimestamp: new Date().toISOString(),
            changes: [
              {
                changeSequence: nextSeq,
                operationId: badOpId,
                operationType: "CREATE_SALE", // Depot-authoritative: Cloud cannot mutate!
                entityId: crypto.randomUUID(),
                action: "UPSERT",
                payload: { invoiceNumber: "ILLEGAL-SALE" },
                sourceDeviceId: "cloud-rogue",
                createdAt: new Date().toISOString(),
              } as SyncChangeRecord,
            ],
          } satisfies SyncBatchPullResponse),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    };

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: device.deviceId,
      deviceToken: rawToken,
      runImmediatelyOnStart: false,
      fetchFn: mockQuarantinePullFetch as unknown as typeof fetch,
    });

    await scheduler.start();

    // Run pull cycle
    const pullResult = await scheduler.runPullCycle();
    assert.ok(pullResult, "Pull cycle must return a result");
    assert.equal(pullResult.blocked, true, "Deterministic error must report blocked: true");
    assert.equal(pullResult.quarantineErrorCode, "AUTHORITY_VIOLATION");

    // Verify LocalSyncQuarantine record was created in database
    const quarantine = await prisma.localSyncQuarantine.findUnique({
      where: { operationId: badOpId },
    });
    assert.ok(quarantine, "Quarantine record must exist in database");
    assert.equal(quarantine!.status, QuarantineStatus.QUARANTINED);
    assert.equal(quarantine!.errorCode, "AUTHORITY_VIOLATION");

    // Verify SyncCursor was NOT advanced past the blocked change
    const curAfter = await getLocalSyncCursor();
    assert.equal(curAfter, curBefore, "SyncCursor must NOT advance past quarantined change");

    // Verify scheduler status: this was a valid quarantine, so network backoff is NOT applied
    const status = scheduler.getStatus();
    assert.equal(status.pullBackoffIndex, 0, "Quarantine must not trigger network backoff");

    await scheduler.stop();
  });

  // ─── N. Existing Customer LWW Behavior Remains Intact ─────────────────────

  it("N. Existing Customer LWW conflict resolution remains intact under the scheduler", async () => {
    const { device, rawToken } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const cloudOpId = crypto.randomUUID();
    createdCustomerIds.add(customerId);
    createdProcessedOpIds.add(cloudOpId);

    // Create a local customer with version=1
    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Local Cust ${testRunId}`,
        phone: "111",
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
        isActive: true,
        version: 1,
        lastOperationId: crypto.randomUUID(),
        lastUpdatedAt: new Date("2026-09-17T09:00:00.000Z"),
      },
    });

    const curBefore = await getLocalSyncCursor();
    const nextSeq = (curBefore + BigInt(1)).toString();

    // Cloud delivers an update with version=2 (wins LWW)
    const mockLwwPullFetch = async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/sync/pull")) {
        return new Response(
          JSON.stringify({
            success: true,
            deviceId: device.deviceId,
            fromSequence: curBefore.toString(),
            toSequence: nextSeq,
            hasMore: false,
            serverTimestamp: new Date().toISOString(),
            changes: [
              {
                changeSequence: nextSeq,
                operationId: cloudOpId,
                operationType: "UPSERT_CUSTOMER",
                entityId: customerId,
                action: "UPSERT",
                payload: {
                  name: `Cloud Winner ${testRunId}`,
                  phone: "999",
                  priceTier: PriceTier.WHOLESALE,
                  creditAllowed: true,
                  isActive: true,
                  version: 2,
                  lwwTimestamp: "2026-09-17T10:00:00.000Z",
                },
                sourceDeviceId: null,
                createdAt: "2026-09-17T10:00:00.000Z",
              } as SyncChangeRecord,
            ],
          } satisfies SyncBatchPullResponse),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("{}", { status: 200 });
    };

    const scheduler = new SyncScheduler({
      cloudBaseUrl: "http://localhost:3000",
      deviceId: device.deviceId,
      deviceToken: rawToken,
      runImmediatelyOnStart: false,
      fetchFn: mockLwwPullFetch as unknown as typeof fetch,
    });

    await scheduler.start();

    // Execute pull cycle
    const pullResult = await scheduler.runPullCycle();
    assert.ok(pullResult);
    assert.equal(pullResult.appliedCount, 1);

    // Verify Customer record won LWW and has version=2
    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.name, `Cloud Winner ${testRunId}`);
    assert.equal(cust.phone, "999");
    assert.equal(cust.priceTier, PriceTier.WHOLESALE);
    assert.equal(cust.creditAllowed, true);
    assert.equal(cust.version, 2);
    assert.equal(cust.lastOperationId, cloudOpId);

    await scheduler.stop();
  });
});
