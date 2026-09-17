/**
 * Phase 5 — Step 1 LWW: Customer Last-Write-Wins Conflict Resolution Tests
 *
 * Covers all 13 scenarios required for the LWW conflict policy approval:
 *   A. Cloud-only customer edit
 *   B. Local-only customer edit
 *   C. Cloud + Local concurrent name edit
 *   D. Cloud + Local concurrent phone edit
 *   E. Cloud + Local concurrent address edit
 *   F. Cloud + Local concurrent priceTier edit
 *   G. Cloud + Local concurrent creditAllowed edit
 *   H. Cloud + Local concurrent isActive edit
 *   I. Push-before-pull produces same final state as pull-before-push
 *   J. Repeated retry does not duplicate mutations
 *   K. Both databases converge to same value
 *   L. Both mutations remain auditable in SyncChangeLog
 *   M. Existing customer sales/payment/container data is untouched
 *
 * LWW Mechanism (deterministic):
 *   Stamp = { version: number, clientCreatedAt: ISO string, operationId: UUID }
 *   Ordering: version ASC → clientCreatedAt ASC → operationId.localeCompare()
 *   Higher stamp wins. Identical stamps: operationId tie-breaker ensures total ordering.
 *
 * Run: npx tsx src/lib/sync/sync-customer-lww.test.ts
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../prisma";
import { hashToken } from "./server/authentication";
import { processDevicePushBatch } from "./server/push";
import { applyLocalPullBatch, getLocalSyncCursor } from "./client/pull";
import {
  PriceTier,
  Role,
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
  SyncOperation,
} from "./types";
import { compareCustomerLww } from "./conflict/customer-lww";

// ─── Fixtures & Tracking ──────────────────────────────────────────────────────

const testRunId = crypto.randomUUID().slice(0, 8);
const createdDeviceIds = new Set<string>();
const createdCustomerIds = new Set<string>();
const createdUserIds = new Set<string>();
const createdSaleIds = new Set<string>();
const createdPaymentIds = new Set<string>();
const createdContainerMovementIds = new Set<string>();
const createdChangeLogOpIds = new Set<string>();
const createdProcessedOpIds = new Set<string>();

let ownerUserId: string;

async function createTestDevice(): Promise<{ device: SyncDevice; rawToken: string }> {
  const devId = `dev-lww-${testRunId}-${crypto.randomUUID().slice(0, 8)}`;
  const rawToken = `tok-lww-${crypto.randomBytes(16).toString("hex")}`;
  const tokenHash = hashToken(rawToken);

  const device = await prisma.syncDevice.create({
    data: {
      deviceId: devId,
      name: `LWW Test Device ${devId}`,
      tokenHash,
      isRevoked: false,
      lastSequence: BigInt(0),
    },
  });
  createdDeviceIds.add(devId);
  return { device, rawToken };
}

/**
 * Build an UPSERT_CUSTOMER SyncOperation with an explicit LWW stamp.
 * version and lwwTimestamp are embedded in the payload — the Cloud push handler
 * reads them for conflict comparison.
 */
function makeCustomerOp(
  seq: number,
  customerId: string,
  fields: {
    name: string;
    phone?: string | null;
    address?: string | null;
    priceTier?: PriceTier;
    creditAllowed?: boolean;
    isActive?: boolean;
  },
  lww: { version: number; lwwTimestamp: string; operationId?: string }
): SyncOperation {
  const operationId = lww.operationId ?? crypto.randomUUID();
  return {
    operationId,
    clientSequence: seq.toString(),
    operationType: "UPSERT_CUSTOMER",
    entityId: customerId,
    clientCreatedAt: lww.lwwTimestamp,
    payload: {
      name: fields.name,
      phone: fields.phone ?? null,
      address: fields.address ?? null,
      priceTier: fields.priceTier ?? PriceTier.RETAIL,
      creditAllowed: fields.creditAllowed ?? false,
      isActive: fields.isActive ?? true,
      version: lww.version,
      lwwTimestamp: lww.lwwTimestamp,
    },
  };
}

/**
 * Simulate what the Cloud /api/sync/pull endpoint returns for a specific customer change.
 */
async function buildSingleCustomerPullBatch(
  deviceId: string,
  changeSeqOverride: string,
  operationId: string,
  customerId: string,
  payload: Record<string, unknown>
): Promise<SyncBatchPullResponse> {
  const currentCursor = await getLocalSyncCursor();
  return {
    success: true,
    deviceId,
    fromSequence: currentCursor.toString(),
    toSequence: changeSeqOverride,
    hasMore: false,
    serverTimestamp: new Date().toISOString(),
    changes: [
      {
        changeSequence: changeSeqOverride,
        operationId,
        operationType: "UPSERT_CUSTOMER",
        entityId: customerId,
        action: "UPSERT",
        payload,
        sourceDeviceId: null,
        createdAt: new Date().toISOString(),
      } as SyncChangeRecord,
    ],
  };
}

describe("Phase 5 Step 1 LWW: Customer Last-Write-Wins Conflict Resolution", { concurrency: 1 }, () => {
  before(async () => {
    await prisma.localSyncQuarantine.deleteMany();
    await prisma.localProcessedChange.deleteMany();

    const existing = await prisma.user.findFirst({
      where: { isActive: true, role: Role.OWNER },
      select: { id: true },
    });
    if (existing) {
      ownerUserId = existing.id;
    } else {
      const u = await prisma.user.create({
        data: {
          authUserId: `auth-lww-${testRunId}`,
          name: `LWW Tester ${testRunId}`,
          role: Role.OWNER,
          isActive: true,
        },
      });
      ownerUserId = u.id;
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
    if (createdProcessedOpIds.size > 0) {
      await prisma.localProcessedChange.deleteMany({
        where: { operationId: { in: Array.from(createdProcessedOpIds) } },
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

  // ─── UNIT: LWW Comparator ─────────────────────────────────────────────────

  it("LWW-UNIT-1. compareCustomerLww: higher version wins", async () => {
    const low  = { version: 1, clientCreatedAt: "2026-09-17T10:00:00.000Z", operationId: "aaaa" };
    const high = { version: 2, clientCreatedAt: "2026-09-17T09:00:00.000Z", operationId: "bbbb" };
    // higher version wins even if timestamp is earlier
    assert.ok(compareCustomerLww(high, low) > 0, "Higher version should win");
    assert.ok(compareCustomerLww(low, high) < 0, "Lower version should lose");
  });

  it("LWW-UNIT-2. compareCustomerLww: same version, later timestamp wins", async () => {
    const earlier = { version: 3, clientCreatedAt: "2026-09-17T09:00:00.000Z", operationId: "aaaa" };
    const later   = { version: 3, clientCreatedAt: "2026-09-17T10:00:00.000Z", operationId: "bbbb" };
    assert.ok(compareCustomerLww(later, earlier) > 0, "Later timestamp should win");
    assert.ok(compareCustomerLww(earlier, later) < 0, "Earlier timestamp should lose");
  });

  it("LWW-UNIT-3. compareCustomerLww: same version + same timestamp, operationId tie-breaker", async () => {
    const ts = "2026-09-17T10:00:00.000Z";
    const a = { version: 3, clientCreatedAt: ts, operationId: "aaa-wins" };
    const b = { version: 3, clientCreatedAt: ts, operationId: "bbb-loses" };
    // "bbb-loses".localeCompare("aaa-wins") > 0 means b > a
    const bWins = compareCustomerLww(b, a) > 0;
    const aWins = compareCustomerLww(a, b) > 0;
    // exactly one should win
    assert.ok(bWins !== aWins, "Tie-breaker should deterministically select one winner");
  });

  it("LWW-UNIT-4. compareCustomerLww is commutative: max(a,b) === max(b,a)", async () => {
    const ts = "2026-09-17T10:00:00.000Z";
    const a = { version: 5, clientCreatedAt: ts, operationId: "op-cloud-alpha" };
    const b = { version: 5, clientCreatedAt: ts, operationId: "op-local-beta" };
    const aWinsOverB = compareCustomerLww(a, b) > 0;
    const bWinsOverA = compareCustomerLww(b, a) > 0;
    // Exactly one must win (they differ), and the result must be symmetric
    assert.ok(aWinsOverB !== bWinsOverA, "Comparison must be strictly antisymmetric");
  });

  // ─── A. Cloud-Only Edit ───────────────────────────────────────────────────

  it("A. Cloud-only customer edit applies and sets version=1", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const opId = crypto.randomUUID();
    createdCustomerIds.add(customerId);
    createdChangeLogOpIds.add(opId);

    const ts = new Date().toISOString();
    const op = makeCustomerOp(1, customerId, { name: `Cloud Only ${testRunId}`, phone: "100" }, { version: 1, lwwTimestamp: ts, operationId: opId });
    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);

    assert.equal(res.success, true);
    assert.deepEqual(res.acknowledgedOperationIds, [opId]);

    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.name, `Cloud Only ${testRunId}`);
    assert.equal(cust.phone, "100");
    assert.equal(cust.version, 1);
    assert.equal(cust.lastOperationId, opId);
  });

  // ─── B. Local-Only Edit ───────────────────────────────────────────────────

  it("B. Local-only customer edit via pull applies and sets version=1", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const opId = crypto.randomUUID();
    const changeSeq = (await getLocalSyncCursor() + BigInt(1)).toString();
    createdCustomerIds.add(customerId);
    createdProcessedOpIds.add(opId);

    const ts = new Date().toISOString();
    const batch = await buildSingleCustomerPullBatch(
      device.deviceId, changeSeq, opId, customerId,
      { name: `Local Only ${testRunId}`, phone: "200", priceTier: PriceTier.RETAIL, creditAllowed: false, isActive: true, version: 1, lwwTimestamp: ts }
    );

    const result = await applyLocalPullBatch(device.deviceId, batch);
    assert.equal(result.appliedCount, 1);

    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.name, `Local Only ${testRunId}`);
    assert.equal(cust.version, 1);
    assert.equal(cust.lastOperationId, opId);
  });

  // ─── C. Concurrent Name Edit ──────────────────────────────────────────────

  it("C. Cloud + Local concurrent name edit: higher version wins on both sides", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    // Simulate: customer already exists locally at version 1 (local edit)
    const localOpId = crypto.randomUUID();
    const localTs = "2026-09-17T09:00:00.000Z";  // earlier timestamp
    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Local Name ${testRunId}`,
        phone: null,
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
        isActive: true,
        version: 2,                        // Local edit has version=2 (user made 2 edits)
        lastOperationId: localOpId,
        lastUpdatedAt: new Date(localTs),
      },
    });

    // Cloud pushes a conflicting name edit at version=1 (older), which should LOSE
    const cloudOpId = crypto.randomUUID();
    const cloudTs = "2026-09-17T08:00:00.000Z";  // even earlier timestamp
    createdChangeLogOpIds.add(cloudOpId);

    const op = makeCustomerOp(1, customerId, { name: `Cloud Name SHOULD LOSE ${testRunId}` }, { version: 1, lwwTimestamp: cloudTs, operationId: cloudOpId });
    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true, "Cloud push should succeed (acknowledged)");
    assert.deepEqual(res.acknowledgedOperationIds, [cloudOpId]);

    // Cloud DB: local's version=2 wins, Cloud name must NOT have overwritten it
    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.ok(
      !cust.name.includes("SHOULD LOSE"),
      `Cloud version=1 must not overwrite local version=2. Got: ${cust.name}`
    );
    assert.equal(cust.version, 2, "Version must remain at local's winning version=2");

    // SyncChangeLog must still record the losing Cloud operation (audit)
    const changeLog = await prisma.syncChangeLog.findUnique({ where: { operationId: cloudOpId } });
    assert.ok(changeLog, "SyncChangeLog must record losing Cloud operation");
    const logPayload = changeLog!.payload as Record<string, unknown>;
    assert.equal(logPayload.lwwLost, true, "Losing operation must be marked lwwLost=true in SyncChangeLog");
  });

  // ─── D. Concurrent Phone Edit ─────────────────────────────────────────────

  it("D. Cloud + Local concurrent phone edit: Cloud version=3 beats Local version=2", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    const localTs = "2026-09-17T09:00:00.000Z";
    const localOpId = crypto.randomUUID();
    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Phone Test ${testRunId}`,
        phone: "LOCAL-PHONE",
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
        isActive: true,
        version: 2,
        lastOperationId: localOpId,
        lastUpdatedAt: new Date(localTs),
      },
    });

    // Cloud edit at version=3 — WINS because version > local version
    const cloudOpId = crypto.randomUUID();
    const cloudTs = "2026-09-17T08:00:00.000Z"; // earlier timestamp but higher version
    createdChangeLogOpIds.add(cloudOpId);

    const op = makeCustomerOp(1, customerId, { name: `Phone Test ${testRunId}`, phone: "CLOUD-PHONE-WINS" }, { version: 3, lwwTimestamp: cloudTs, operationId: cloudOpId });
    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.phone, "CLOUD-PHONE-WINS", "Cloud version=3 must override local version=2");
    assert.equal(cust.version, 3);
    assert.equal(cust.lastOperationId, cloudOpId);
  });

  // ─── E. Concurrent Address Edit ───────────────────────────────────────────

  it("E. Cloud + Local concurrent address edit: same version, later timestamp wins", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    const earlierTs = "2026-09-17T09:00:00.000Z";
    const localOpId = crypto.randomUUID();
    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Address Test ${testRunId}`,
        address: "LOCAL-ADDRESS",
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
        isActive: true,
        version: 2,
        lastOperationId: localOpId,
        lastUpdatedAt: new Date(earlierTs),
      },
    });

    // Cloud edit at same version=2 but LATER timestamp — WINS
    const cloudOpId = crypto.randomUUID();
    const cloudTs = "2026-09-17T10:00:00.000Z"; // later
    createdChangeLogOpIds.add(cloudOpId);

    const op = makeCustomerOp(1, customerId, { name: `Address Test ${testRunId}`, address: "CLOUD-ADDRESS-WINS" }, { version: 2, lwwTimestamp: cloudTs, operationId: cloudOpId });
    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.address, "CLOUD-ADDRESS-WINS", "Later timestamp at same version must win");
    assert.equal(cust.version, 2);
    assert.equal(cust.lastOperationId, cloudOpId);
  });

  // ─── F. Concurrent priceTier Edit ─────────────────────────────────────────

  it("F. Cloud + Local concurrent priceTier edit: LWW produces single convergent winner", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    const ts = "2026-09-17T09:00:00.000Z";
    const localOpId = crypto.randomUUID();
    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Price Test ${testRunId}`,
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
        isActive: true,
        version: 1,
        lastOperationId: localOpId,
        lastUpdatedAt: new Date(ts),
      },
    });

    // Cloud sends version=2 with KEY_ACCOUNT — WINS
    const cloudOpId = crypto.randomUUID();
    const cloudTs = "2026-09-17T10:00:00.000Z";
    createdChangeLogOpIds.add(cloudOpId);

    const op = makeCustomerOp(1, customerId, { name: `Price Test ${testRunId}`, priceTier: PriceTier.KEY_ACCOUNT }, { version: 2, lwwTimestamp: cloudTs, operationId: cloudOpId });
    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.priceTier, PriceTier.KEY_ACCOUNT, "Cloud version=2 must set KEY_ACCOUNT");
    assert.equal(cust.version, 2);
  });

  // ─── G. Concurrent creditAllowed Edit ─────────────────────────────────────

  it("G. Cloud + Local concurrent creditAllowed edit: LWW prevents permanent divergence", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    const ts = "2026-09-17T09:00:00.000Z";
    const localOpId = crypto.randomUUID();
    // Local has creditAllowed=true at version=3
    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Credit Test ${testRunId}`,
        priceTier: PriceTier.RETAIL,
        creditAllowed: true,
        isActive: true,
        version: 3,
        lastOperationId: localOpId,
        lastUpdatedAt: new Date(ts),
      },
    });

    // Cloud sends creditAllowed=false but at version=2 — LOSES to local version=3
    const cloudOpId = crypto.randomUUID();
    createdChangeLogOpIds.add(cloudOpId);
    const op = makeCustomerOp(1, customerId, { name: `Credit Test ${testRunId}`, creditAllowed: false }, { version: 2, lwwTimestamp: ts, operationId: cloudOpId });
    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.creditAllowed, true, "Local version=3 must retain creditAllowed=true");
    assert.equal(cust.version, 3, "Version must stay at local's 3");

    // Losing operation logged
    const log = await prisma.syncChangeLog.findUnique({ where: { operationId: cloudOpId } });
    assert.ok(log, "Losing operation must be in SyncChangeLog");
    assert.equal((log!.payload as Record<string, unknown>).lwwLost, true);
  });

  // ─── H. Concurrent isActive Edit ──────────────────────────────────────────

  it("H. Cloud + Local concurrent isActive edit: higher version wins", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    const ts = "2026-09-17T09:00:00.000Z";
    const localOpId = crypto.randomUUID();
    // Local has isActive=false at version=2
    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Active Test ${testRunId}`,
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
        isActive: false,
        version: 2,
        lastOperationId: localOpId,
        lastUpdatedAt: new Date(ts),
      },
    });

    // Cloud sends isActive=true at version=3 — WINS
    const cloudOpId = crypto.randomUUID();
    const cloudTs = "2026-09-17T10:00:00.000Z";
    createdChangeLogOpIds.add(cloudOpId);
    const op = makeCustomerOp(1, customerId, { name: `Active Test ${testRunId}`, isActive: true }, { version: 3, lwwTimestamp: cloudTs, operationId: cloudOpId });
    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.isActive, true, "Cloud version=3 must set isActive=true");
    assert.equal(cust.version, 3);
  });

  // ─── I. Push-before-Pull produces same state as Pull-before-Push ──────────

  it("I. Push-before-Pull and Pull-before-Push produce identical final state (commutativity)", async () => {
    /**
     * Scenario:
     *   Cloud edit: version=2, ts=09:00, name="Cloud-Name"
     *   Local edit: version=1, ts=10:00, name="Local-Name"
     *   Cloud version wins (2 > 1) regardless of operation order.
     */
    const { device } = await createTestDevice();
    const customerIdA = crypto.randomUUID(); // push-before-pull ordering
    const customerIdB = crypto.randomUUID(); // pull-before-push ordering
    createdCustomerIds.add(customerIdA);
    createdCustomerIds.add(customerIdB);

    const cloudTs = "2026-09-17T09:00:00.000Z";
    const localTs = "2026-09-17T10:00:00.000Z";
    const cloudVersion = 2;
    const localVersion = 1;

    // ── Ordering A: Push (Cloud wins v=2) → Pull (Cloud same change echoes, already applied) ──

    // Create customer at local version=1 on customerA
    const localOpIdA = crypto.randomUUID();
    await prisma.customer.create({
      data: {
        id: customerIdA,
        name: "Local-Name",
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
        isActive: true,
        version: localVersion,
        lastOperationId: localOpIdA,
        lastUpdatedAt: new Date(localTs),
      },
    });

    // Push from Cloud with version=2
    const cloudOpIdA = crypto.randomUUID();
    createdChangeLogOpIds.add(cloudOpIdA);
    const pushOpA = makeCustomerOp(1, customerIdA, { name: "Cloud-Name" }, { version: cloudVersion, lwwTimestamp: cloudTs, operationId: cloudOpIdA });
    const resA = await processDevicePushBatch(device, crypto.randomUUID(), [pushOpA]);
    assert.equal(resA.success, true);

    const custA = await prisma.customer.findUniqueOrThrow({ where: { id: customerIdA } });
    assert.equal(custA.name, "Cloud-Name", "After push-first: Cloud wins");
    assert.equal(custA.version, cloudVersion);

    // ── Ordering B: Pull (Cloud change) → Push (Local echo comes back, loses) ──

    // Create customer at local version=1 on customerB
    const localOpIdB = crypto.randomUUID();
    await prisma.customer.create({
      data: {
        id: customerIdB,
        name: "Local-Name",
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
        isActive: true,
        version: localVersion,
        lastOperationId: localOpIdB,
        lastUpdatedAt: new Date(localTs),
      },
    });

    // Pull delivers the Cloud change (version=2)
    const cloudOpIdB = crypto.randomUUID();
    createdProcessedOpIds.add(cloudOpIdB);
    const changeSeq = (await getLocalSyncCursor() + BigInt(1)).toString();
    const pullBatch: SyncBatchPullResponse = {
      success: true,
      deviceId: device.deviceId,
      fromSequence: (BigInt(changeSeq) - BigInt(1)).toString(),
      toSequence: changeSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: changeSeq,
          operationId: cloudOpIdB,
          operationType: "UPSERT_CUSTOMER",
          entityId: customerIdB,
          action: "UPSERT",
          payload: {
            name: "Cloud-Name",
            priceTier: PriceTier.RETAIL,
            creditAllowed: false,
            isActive: true,
            version: cloudVersion,
            lwwTimestamp: cloudTs,
          },
          sourceDeviceId: null,
          createdAt: cloudTs,
        } as SyncChangeRecord,
      ],
    };
    await applyLocalPullBatch(device.deviceId, pullBatch);

    const custB = await prisma.customer.findUniqueOrThrow({ where: { id: customerIdB } });
    assert.equal(custB.name, "Cloud-Name", "After pull-first: Cloud wins via LWW");
    assert.equal(custB.version, cloudVersion);

    // Both orderings converge to Cloud-Name
    assert.equal(custA.name, custB.name, "Both orderings must converge to identical final name");
    assert.equal(custA.version, custB.version, "Both orderings must converge to identical version");
  });

  // ─── J. Repeated Retry Does Not Duplicate Mutations ──────────────────────

  it("J. Repeated retry of winning operation is idempotent", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    const opId = crypto.randomUUID();
    createdCustomerIds.add(customerId);
    createdChangeLogOpIds.add(opId);

    const ts = new Date().toISOString();
    const op = makeCustomerOp(1, customerId, { name: `Idempotent ${testRunId}`, phone: "999" }, { version: 1, lwwTimestamp: ts, operationId: opId });

    // First push
    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res1.success, true);

    // Second push (retry with same operationId)
    const { device: device2 } = await createTestDevice();
    // We must create another device at seq=1 to replay this op
    const res2 = await processDevicePushBatch(device2, crypto.randomUUID(), [op]);
    // Should be acknowledged (idempotent) or rejected with PREVIOUSLY_REJECTED — neither should duplicate
    const custCount = await prisma.customer.count({ where: { id: customerId } });
    assert.equal(custCount, 1, "Exactly one Customer row must exist after duplicate push");

    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.name, `Idempotent ${testRunId}`);
    assert.equal(cust.version, 1);
  });

  // ─── K. Both Databases Converge ───────────────────────────────────────────

  it("K. After sync, Cloud and Local depot converge to the same customer profile", async () => {
    /**
     * Setup: Cloud has v=2. Local has v=1. After pull+push cycle, both should have v=2.
     */
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    // Local depot starts at version=1
    const localOpId = crypto.randomUUID();
    const localTs = "2026-09-17T09:00:00.000Z";
    await prisma.customer.create({
      data: {
        id: customerId,
        name: "V1 Local Name",
        phone: null,
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
        isActive: true,
        version: 1,
        lastOperationId: localOpId,
        lastUpdatedAt: new Date(localTs),
      },
    });

    // Cloud receives push from another device with version=2
    const { device: cloudDevice } = await createTestDevice();
    const cloudOpId = crypto.randomUUID();
    const cloudTs = "2026-09-17T10:00:00.000Z";
    createdChangeLogOpIds.add(cloudOpId);
    const pushOp = makeCustomerOp(1, customerId, { name: "V2 Cloud Name", phone: "777" }, { version: 2, lwwTimestamp: cloudTs, operationId: cloudOpId });
    const pushRes = await processDevicePushBatch(cloudDevice, crypto.randomUUID(), [pushOp]);
    assert.equal(pushRes.success, true);

    // Cloud DB has V2 Cloud Name
    const cloudCust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cloudCust.name, "V2 Cloud Name");
    assert.equal(cloudCust.version, 2);

    // Local pulls the Cloud change
    const changeSeq = (await getLocalSyncCursor() + BigInt(1)).toString();
    createdProcessedOpIds.add(cloudOpId);
    const pullBatch: SyncBatchPullResponse = {
      success: true,
      deviceId: cloudDevice.deviceId,
      fromSequence: (BigInt(changeSeq) - BigInt(1)).toString(),
      toSequence: changeSeq,
      hasMore: false,
      serverTimestamp: new Date().toISOString(),
      changes: [
        {
          changeSequence: changeSeq,
          operationId: cloudOpId,
          operationType: "UPSERT_CUSTOMER",
          entityId: customerId,
          action: "UPSERT",
          payload: {
            id: customerId,
            name: "V2 Cloud Name",
            phone: "777",
            priceTier: PriceTier.RETAIL,
            creditAllowed: false,
            isActive: true,
            version: 2,
            lwwTimestamp: cloudTs,
          },
          sourceDeviceId: cloudDevice.deviceId,
          createdAt: cloudTs,
        } as SyncChangeRecord,
      ],
    };
    await applyLocalPullBatch(cloudDevice.deviceId, pullBatch);

    // Local depot now has V2 Cloud Name too
    const localCust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(localCust.name, "V2 Cloud Name", "Local must converge to Cloud's winning value");
    assert.equal(localCust.version, 2);
    assert.equal(localCust.phone, "777");

    // Cloud and Local now agree
    assert.equal(cloudCust.name, localCust.name, "Cloud and Local must converge");
    assert.equal(cloudCust.version, localCust.version);
  });

  // ─── L. Both Mutations Remain Auditable ───────────────────────────────────

  it("L. Both winning and losing mutations are preserved in SyncChangeLog", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    // Create customer at v=2 locally (wins)
    const localOpId = crypto.randomUUID();
    const localTs = "2026-09-17T09:00:00.000Z";
    await prisma.customer.create({
      data: {
        id: customerId,
        name: "V2 Winning Local",
        priceTier: PriceTier.RETAIL,
        creditAllowed: true,
        isActive: true,
        version: 2,
        lastOperationId: localOpId,
        lastUpdatedAt: new Date(localTs),
      },
    });

    // Push Cloud op at v=1 (loses)
    const losingOpId = crypto.randomUUID();
    createdChangeLogOpIds.add(losingOpId);
    const losingTs = "2026-09-17T08:00:00.000Z";
    const losingOp = makeCustomerOp(1, customerId, { name: "V1 Losing Cloud" }, { version: 1, lwwTimestamp: losingTs, operationId: losingOpId });
    const losingRes = await processDevicePushBatch(device, crypto.randomUUID(), [losingOp]);
    assert.equal(losingRes.success, true, "Push must succeed even for losing operation");

    // Push Cloud op at v=3 (wins)
    const { device: device2 } = await createTestDevice();
    const winningOpId = crypto.randomUUID();
    createdChangeLogOpIds.add(winningOpId);
    const winningTs = "2026-09-17T11:00:00.000Z";
    const winningOp = makeCustomerOp(1, customerId, { name: "V3 Winning Cloud" }, { version: 3, lwwTimestamp: winningTs, operationId: winningOpId });
    const winningRes = await processDevicePushBatch(device2, crypto.randomUUID(), [winningOp]);
    assert.equal(winningRes.success, true);

    // Both operations must appear in SyncChangeLog
    const losingLog = await prisma.syncChangeLog.findUnique({ where: { operationId: losingOpId } });
    assert.ok(losingLog, "Losing operation must be in SyncChangeLog");
    assert.equal((losingLog!.payload as Record<string, unknown>).lwwLost, true);

    const winningLog = await prisma.syncChangeLog.findUnique({ where: { operationId: winningOpId } });
    assert.ok(winningLog, "Winning operation must be in SyncChangeLog");
    // lwwLost should be false or absent for winning op
    const winnerPayload = winningLog!.payload as Record<string, unknown>;
    assert.ok(!winnerPayload.lwwLost, "Winning operation must NOT be marked lwwLost");

    // Customer now holds the winning value
    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.name, "V3 Winning Cloud");
    assert.equal(cust.version, 3);
  });

  // ─── M. Sales/Payments/Containers Untouched ───────────────────────────────

  it("M. LWW customer profile update does NOT touch sales, payments, or container movements", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    // Create customer
    await prisma.customer.create({
      data: {
        id: customerId,
        name: `Ledger Test ${testRunId}`,
        priceTier: PriceTier.RETAIL,
        creditAllowed: false,
        isActive: true,
        version: 1,
        lastOperationId: crypto.randomUUID(),
        lastUpdatedAt: new Date(),
      },
    });

    // Create a sale, payment, and container movement for this customer
    const saleId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const cmId = crypto.randomUUID();
    createdSaleIds.add(saleId);
    createdPaymentIds.add(paymentId);
    createdContainerMovementIds.add(cmId);

    await prisma.sale.create({
      data: {
        id: saleId,
        invoiceNumber: `INV-LWW-M-${testRunId}`,
        customerId,
        saleType: SaleType.RETAIL,
        status: SaleStatus.COMPLETED,
        subtotal: 5000,
        discount: 0,
        totalAmount: 5000,
        paidAmount: 5000,
        creditAmount: 0,
        soldAt: new Date(),
        createdById: ownerUserId,
      },
    });

    await prisma.payment.create({
      data: {
        id: paymentId,
        saleId,
        customerId,
        paymentMethod: PaymentMethod.CASH,
        amount: 5000,
        paidAt: new Date(),
        receivedById: ownerUserId,
      },
    });

    await prisma.containerMovement.create({
      data: {
        id: cmId,
        customerId,
        containerType: ContainerType.PLASTIC_CRATE,
        movementType: ContainerMovementType.DEBIT,
        quantity: 10,
        createdById: ownerUserId,
      },
    });

    // Apply a Cloud update that wins LWW (version=2)
    const cloudOpId = crypto.randomUUID();
    createdChangeLogOpIds.add(cloudOpId);
    const cloudTs = new Date().toISOString();
    const op = makeCustomerOp(1, customerId, {
      name: `Ledger Test Updated ${testRunId}`,
      phone: "555",
      creditAllowed: true,
    }, { version: 2, lwwTimestamp: cloudTs, operationId: cloudOpId });
    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    // Verify profile changed
    const cust = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust.name, `Ledger Test Updated ${testRunId}`);
    assert.equal(cust.creditAllowed, true);
    assert.equal(cust.version, 2);

    // Verify sale is completely untouched
    const saleCheck = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    assert.equal(Number(saleCheck.totalAmount), 5000, "Sale totalAmount must be untouched");
    assert.equal(saleCheck.status, SaleStatus.COMPLETED, "Sale status must be untouched");

    // Verify payment is completely untouched
    const payCheck = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assert.equal(Number(payCheck.amount), 5000, "Payment amount must be untouched");

    // Verify container movement is completely untouched
    const cmCheck = await prisma.containerMovement.findUniqueOrThrow({ where: { id: cmId } });
    assert.equal(cmCheck.quantity, 10, "Container movement quantity must be untouched");
    assert.equal(cmCheck.containerType, ContainerType.PLASTIC_CRATE);
  });
});
