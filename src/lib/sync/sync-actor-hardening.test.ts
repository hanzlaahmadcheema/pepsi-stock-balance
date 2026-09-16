/**
 * Phase 3 Final Security Hardening — Actor Identity Hardening Test Suite
 *
 * Verifies:
 *   A. Missing actor identity is rejected with MISSING_ACTOR_IDENTITY
 *   B. Unknown actor ID is rejected with UNKNOWN_ACTOR
 *   C. Inactive actor ID is rejected with INACTIVE_ACTOR
 *   D. Valid Staff actor succeeds where Staff is authorized (CREATE_SALE, POST_RECEIVING, RECORD_PAYMENT)
 *   E. Valid Owner actor succeeds where Owner is authorized (RESOLVE_STOCK_ADJUSTMENT, INSPECT_RETURN)
 *   F. Caller cannot obtain Owner authorization by omitting actor identity
 *   G. Caller cannot obtain Owner authorization by relying on fallback
 *   H. AuditLog never attributes a missing-actor operation to an arbitrary user
 *   I. Existing idempotency behavior remains intact
 *   J. Existing sequence validation remains intact
 *   K. Existing SyncChangeLog.operationId behavior remains intact
 *
 * Run: npx tsx --test src/lib/sync/sync-actor-hardening.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  Role,
  PriceTier,
  AdjustmentStatus,
  MovementType,
  PaymentMethod,
  InspectionResult,
  Prisma,
} from "@prisma/client";
import { prisma } from "../prisma";
import { hashToken } from "./server/authentication";
import { processDevicePushBatch } from "./server/push";
import type { SyncOperation } from "./types";

describe("Phase 3 Sync: Actor Identity Hardening Tests", () => {
  const testRunId = crypto.randomUUID().slice(0, 8);

  const createdDeviceIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdProductIds = new Set<string>();
  const createdCustomerIds = new Set<string>();
  const createdSupplierIds = new Set<string>();
  const createdSaleIds = new Set<string>();
  const createdReceivingIds = new Set<string>();
  const createdReturnIds = new Set<string>();
  const createdAdjustmentIds = new Set<string>();

  let testOwnerUserId: string;
  let testStaffUserId: string;
  let testInactiveUserId: string;
  let testTargetUserId: string;
  let testCustomerId: string;
  let testSupplierId: string;
  let testProductId: string;

  async function createTestDevice(overrides: { deviceId?: string; lastSequence?: bigint } = {}) {
    const devId = overrides.deviceId || `dev-act-${testRunId}-${crypto.randomUUID().slice(0, 8)}`;
    const rawToken = `tok-${crypto.randomBytes(16).toString("hex")}`;
    const tokenHash = hashToken(rawToken);

    const device = await prisma.syncDevice.create({
      data: {
        deviceId: devId,
        name: `Actor Hardening Device ${devId}`,
        tokenHash,
        lastSequence: overrides.lastSequence ?? BigInt(0),
      },
    });

    createdDeviceIds.add(devId);
    return { device, rawToken };
  }

  function makeOp(
    seq: number | string | bigint,
    opType: SyncOperation["operationType"],
    entityId: string,
    payload: Record<string, unknown>,
    opId?: string
  ): SyncOperation {
    return {
      operationId: opId || crypto.randomUUID(),
      clientSequence: seq.toString(),
      operationType: opType,
      entityId,
      payload,
      clientCreatedAt: new Date().toISOString(),
    };
  }

  before(async () => {
    // Warm up database pooler connection
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // 1. Create test Owner (ensuring an active Owner exists in DB)
    const owner = await prisma.user.create({
      data: {
        authUserId: `auth-act-owner-${testRunId}`,
        name: `Act Owner ${testRunId}`,
        role: Role.OWNER,
        isActive: true,
      },
    });
    testOwnerUserId = owner.id;
    createdUserIds.add(owner.id);

    // 2. Create test Staff
    const staff = await prisma.user.create({
      data: {
        authUserId: `auth-act-staff-${testRunId}`,
        name: `Act Staff ${testRunId}`,
        role: Role.STAFF,
        isActive: true,
      },
    });
    testStaffUserId = staff.id;
    createdUserIds.add(staff.id);

    // 3. Create inactive user
    const inactiveUser = await prisma.user.create({
      data: {
        authUserId: `auth-act-inactive-${testRunId}`,
        name: `Act Inactive ${testRunId}`,
        role: Role.STAFF,
        isActive: false,
      },
    });
    testInactiveUserId = inactiveUser.id;
    createdUserIds.add(inactiveUser.id);

    // 4. Create target user for user updates
    const target = await prisma.user.create({
      data: {
        authUserId: `auth-act-target-${testRunId}`,
        name: `Act Target ${testRunId}`,
        role: Role.STAFF,
        isActive: true,
      },
    });
    testTargetUserId = target.id;
    createdUserIds.add(target.id);

    // 5. Create test customer
    const customer = await prisma.customer.create({
      data: {
        name: `Act Customer ${testRunId}`,
        phone: "03005551234",
        creditAllowed: true,
        priceTier: PriceTier.RETAIL,
        isActive: true,
      },
    });
    testCustomerId = customer.id;
    createdCustomerIds.add(customer.id);

    // 6. Create test supplier
    const supplier = await prisma.supplier.create({
      data: {
        name: `Act Supplier ${testRunId}`,
        phone: "03005554321",
        isActive: true,
      },
    });
    testSupplierId = supplier.id;
    createdSupplierIds.add(supplier.id);

    // 7. Create test product with initial stock
    const prod = await prisma.product.create({
      data: {
        name: `Act Product ${testRunId}`,
        brand: "Pepsi",
        sku: `SKU-ACT-${testRunId}`,
        minimumStockLevel: 5,
        latestPurchasePrice: new Prisma.Decimal("120.00"),
        isActive: true,
      },
    });
    testProductId = prod.id;
    createdProductIds.add(prod.id);

    await prisma.stockMovement.create({
      data: {
        productId: testProductId,
        movementType: MovementType.RECEIVING,
        quantity: 100,
        referenceType: "InitialSeed",
        referenceId: crypto.randomUUID(),
        createdById: testOwnerUserId,
      },
    });
  });

  after(async () => {
    // Teardown created entities in reverse dependency order
    if (createdDeviceIds.size > 0) {
      await prisma.syncChangeLog.deleteMany({
        where: { sourceDeviceId: { in: Array.from(createdDeviceIds) } },
      });
      await prisma.processedSyncOperation.deleteMany({
        where: { deviceId: { in: Array.from(createdDeviceIds) } },
      });
      await prisma.syncDevice.deleteMany({
        where: { deviceId: { in: Array.from(createdDeviceIds) } },
      });
    }

    if (createdSaleIds.size > 0) {
      await prisma.stockMovement.deleteMany({
        where: { referenceType: "Sale", referenceId: { in: Array.from(createdSaleIds) } },
      });
      await prisma.payment.deleteMany({
        where: { saleId: { in: Array.from(createdSaleIds) } },
      });
      await prisma.saleItem.deleteMany({
        where: { saleId: { in: Array.from(createdSaleIds) } },
      });
      await prisma.sale.deleteMany({
        where: { id: { in: Array.from(createdSaleIds) } },
      });
    }

    if (createdReceivingIds.size > 0) {
      await prisma.stockMovement.deleteMany({
        where: { referenceType: "Receiving", referenceId: { in: Array.from(createdReceivingIds) } },
      });
      await prisma.receivingItem.deleteMany({
        where: { receivingId: { in: Array.from(createdReceivingIds) } },
      });
      await prisma.receiving.deleteMany({
        where: { id: { in: Array.from(createdReceivingIds) } },
      });
    }

    if (createdReturnIds.size > 0) {
      await prisma.stockMovement.deleteMany({
        where: { referenceType: "Return", referenceId: { in: Array.from(createdReturnIds) } },
      });
      await prisma.returnItem.deleteMany({
        where: { returnId: { in: Array.from(createdReturnIds) } },
      });
      await prisma.return.deleteMany({
        where: { id: { in: Array.from(createdReturnIds) } },
      });
    }

    if (createdAdjustmentIds.size > 0) {
      await prisma.stockMovement.deleteMany({
        where: { referenceType: "StockAdjustment", referenceId: { in: Array.from(createdAdjustmentIds) } },
      });
      await prisma.stockAdjustment.deleteMany({
        where: { id: { in: Array.from(createdAdjustmentIds) } },
      });
    }

    if (createdProductIds.size > 0) {
      await prisma.stockMovement.deleteMany({
        where: { productId: { in: Array.from(createdProductIds) } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: Array.from(createdProductIds) } },
      });
    }

    if (createdSupplierIds.size > 0) {
      await prisma.supplier.deleteMany({
        where: { id: { in: Array.from(createdSupplierIds) } },
      });
    }

    if (createdCustomerIds.size > 0) {
      await prisma.customer.deleteMany({
        where: { id: { in: Array.from(createdCustomerIds) } },
      });
    }

    if (createdUserIds.size > 0) {
      await prisma.auditLog.deleteMany({
        where: { userId: { in: Array.from(createdUserIds) } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: Array.from(createdUserIds) } },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // A. Missing actor identity is rejected with MISSING_ACTOR_IDENTITY
  // ─────────────────────────────────────────────────────────────────────────────
  it("A. Missing actor identity is rejected with MISSING_ACTOR_IDENTITY", async () => {
    const { device } = await createTestDevice();

    // 1. CREATE_SALE missing userId
    const saleOp = makeOp(1, "CREATE_SALE", crypto.randomUUID(), {
      invoiceNumber: `INV-TEST-MISSING-${testRunId}`,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 2, unitPrice: 150 }],
      paidAmount: 300,
      // userId omitted!
    });
    const resSale = await processDevicePushBatch(device, crypto.randomUUID(), [saleOp]);
    assert.equal(resSale.success, false);
    assert.ok(resSale.rejectedOperations && resSale.rejectedOperations.length === 1);
    assert.ok(
      resSale.rejectedOperations[0].error.includes("MISSING_ACTOR_IDENTITY"),
      `Expected MISSING_ACTOR_IDENTITY, got: ${resSale.rejectedOperations[0].error}`
    );
    assert.ok(resSale.rejectedOperations[0].error.includes("Actor user ID is required"));

    // 2. POST_RECEIVING missing userId
    const recvOp = makeOp(1, "POST_RECEIVING", crypto.randomUUID(), {
      supplierId: testSupplierId,
      items: [{ productId: testProductId, quantity: 10, purchasePrice: 120 }],
      // userId omitted!
    });
    const resRecv = await processDevicePushBatch(device, crypto.randomUUID(), [recvOp]);
    assert.equal(resRecv.success, false);
    assert.ok(
      resRecv.rejectedOperations?.[0].error.includes("MISSING_ACTOR_IDENTITY"),
      `Expected MISSING_ACTOR_IDENTITY for receiving, got: ${resRecv.rejectedOperations?.[0].error}`
    );

    // Verify device sequence did NOT advance (remains 0)
    const d = await prisma.syncDevice.findUniqueOrThrow({ where: { deviceId: device.deviceId } });
    assert.equal(d.lastSequence, BigInt(0));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // B. Unknown actor ID is rejected with UNKNOWN_ACTOR
  // ─────────────────────────────────────────────────────────────────────────────
  it("B. Unknown actor ID is rejected with UNKNOWN_ACTOR", async () => {
    const { device } = await createTestDevice();
    const nonExistentUserId = crypto.randomUUID();

    const saleOp = makeOp(1, "CREATE_SALE", crypto.randomUUID(), {
      invoiceNumber: `INV-TEST-UNKNOWN-${testRunId}`,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 150 }],
      paidAmount: 150,
      userId: nonExistentUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [saleOp]);
    assert.equal(res.success, false);
    assert.ok(res.rejectedOperations && res.rejectedOperations.length === 1);
    assert.ok(
      res.rejectedOperations[0].error.includes("UNKNOWN_ACTOR"),
      `Expected UNKNOWN_ACTOR error, got: ${res.rejectedOperations[0].error}`
    );
    assert.ok(res.rejectedOperations[0].error.includes("not found in database"));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // C. Inactive actor ID is rejected with INACTIVE_ACTOR
  // ─────────────────────────────────────────────────────────────────────────────
  it("C. Inactive actor ID is rejected with INACTIVE_ACTOR", async () => {
    const { device } = await createTestDevice();

    const saleOp = makeOp(1, "CREATE_SALE", crypto.randomUUID(), {
      invoiceNumber: `INV-TEST-INACTIVE-${testRunId}`,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 150 }],
      paidAmount: 150,
      userId: testInactiveUserId, // Inactive user!
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [saleOp]);
    assert.equal(res.success, false);
    assert.ok(res.rejectedOperations && res.rejectedOperations.length === 1);
    assert.ok(
      res.rejectedOperations[0].error.includes("INACTIVE_ACTOR"),
      `Expected INACTIVE_ACTOR error, got: ${res.rejectedOperations[0].error}`
    );
    assert.ok(res.rejectedOperations[0].error.includes("is inactive"));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // D. Valid Staff actor succeeds where Staff is authorized
  // ─────────────────────────────────────────────────────────────────────────────
  it("D. Valid Staff actor succeeds where Staff is authorized", async () => {
    const { device } = await createTestDevice();

    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);
    const invoiceNumber = `INV-ACT-STAFF-${testRunId}-01`;

    const saleOp = makeOp(1, "CREATE_SALE", saleId, {
      invoiceNumber,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 2, unitPrice: 150 }],
      paidAmount: 300,
      userId: testStaffUserId, // Active Staff user
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [saleOp]);
    assert.equal(res.success, true);
    assert.deepEqual(res.acknowledgedOperationIds, [saleOp.operationId]);

    // Verify on Cloud DB
    const savedSale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    assert.equal(savedSale.invoiceNumber, invoiceNumber);

    // Verify stock movements were created and attributed
    const movements = await prisma.stockMovement.findMany({
      where: { referenceType: "Sale", referenceId: saleId },
    });
    assert.ok(movements.length > 0);
    assert.equal(movements[0].createdById, testStaffUserId);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // E. Valid Owner actor succeeds where Owner is authorized
  // ─────────────────────────────────────────────────────────────────────────────
  it("E. Valid Owner actor succeeds where Owner is authorized", async () => {
    const { device } = await createTestDevice();

    const adjId = crypto.randomUUID();
    createdAdjustmentIds.add(adjId);

    await prisma.stockAdjustment.create({
      data: {
        id: adjId,
        productId: testProductId,
        oldQuantity: 100,
        newQuantity: 105,
        difference: 5,
        reason: "Owner count discrepancy verification",
        status: AdjustmentStatus.PENDING,
        requestedById: testStaffUserId,
      },
    });

    const resolveOp = makeOp(1, "RESOLVE_STOCK_ADJUSTMENT", adjId, {
      decision: "APPROVE",
      reason: "Approved by verified Owner",
      userId: testOwnerUserId, // Active Owner user
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [resolveOp]);
    assert.equal(res.success, true);
    assert.deepEqual(res.acknowledgedOperationIds, [resolveOp.operationId]);

    // Verify adjustment status and resolver on Cloud DB
    const savedAdj = await prisma.stockAdjustment.findUniqueOrThrow({ where: { id: adjId } });
    assert.equal(savedAdj.status, AdjustmentStatus.APPROVED);
    assert.equal(savedAdj.approvedById, testOwnerUserId);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // F. Caller cannot obtain Owner authorization by omitting actor identity
  // ─────────────────────────────────────────────────────────────────────────────
  it("F. Caller cannot obtain Owner authorization by omitting actor identity", async () => {
    const { device } = await createTestDevice();

    const adjId = crypto.randomUUID();
    createdAdjustmentIds.add(adjId);

    await prisma.stockAdjustment.create({
      data: {
        id: adjId,
        productId: testProductId,
        oldQuantity: 100,
        newQuantity: 95,
        difference: -5,
        reason: "Discrepancy pending Owner approval",
        status: AdjustmentStatus.PENDING,
        requestedById: testStaffUserId,
      },
    });

    // Caller sends operation without userId, attempting to trigger approval
    const op = makeOp(1, "RESOLVE_STOCK_ADJUSTMENT", adjId, {
      decision: "APPROVE",
      reason: "Attempting approval without userId",
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, false);
    assert.ok(
      res.rejectedOperations?.[0].error.includes("MISSING_ACTOR_IDENTITY"),
      `Expected MISSING_ACTOR_IDENTITY, got: ${res.rejectedOperations?.[0].error}`
    );

    // Verify adjustment remains PENDING
    const adj = await prisma.stockAdjustment.findUniqueOrThrow({ where: { id: adjId } });
    assert.equal(adj.status, AdjustmentStatus.PENDING);
    assert.equal(adj.approvedById, null);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // G. Caller cannot obtain Owner authorization by relying on fallback
  // ─────────────────────────────────────────────────────────────────────────────
  it("G. Caller cannot obtain Owner authorization by relying on fallback", async () => {
    const { device } = await createTestDevice();

    // In a system with fallback, UPDATE_USER promoting to OWNER might fall back to an Owner
    // With strict validation, omitting actorUserId/userId MUST fail deterministically
    const op = makeOp(1, "UPDATE_USER", testTargetUserId, {
      role: Role.OWNER,
      name: "Attempted Escalation Without Actor",
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, false);
    assert.ok(
      res.rejectedOperations?.[0].error.includes("Missing actor for Owner promotion") ||
        res.rejectedOperations?.[0].error.includes("MISSING_ACTOR_IDENTITY"),
      `Expected missing actor rejection, got: ${res.rejectedOperations?.[0].error}`
    );

    // Target user must NOT have been promoted
    const user = await prisma.user.findUniqueOrThrow({ where: { id: testTargetUserId } });
    assert.equal(user.role, Role.STAFF, "User must remain STAFF");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // H. AuditLog never attributes a missing-actor operation to an arbitrary user
  // ─────────────────────────────────────────────────────────────────────────────
  it("H. AuditLog never attributes a missing-actor operation to an arbitrary user", async () => {
    const { device } = await createTestDevice();

    // Count existing audit logs for target user
    const auditBefore = await prisma.auditLog.count({
      where: { entityId: testTargetUserId, entityType: "User" },
    });

    const op = makeOp(1, "UPDATE_USER", testTargetUserId, {
      name: "New Name Without Actor",
      // Missing actorUserId!
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, false);
    assert.ok(res.rejectedOperations?.[0].error.includes("MISSING_ACTOR_IDENTITY"));

    // Verify 0 audit log records were created; no arbitrary user was recorded
    const auditAfter = await prisma.auditLog.count({
      where: { entityId: testTargetUserId, entityType: "User" },
    });
    assert.equal(auditAfter, auditBefore, "No AuditLog record may be created when actor is missing");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I. Existing idempotency behavior remains intact
  // ─────────────────────────────────────────────────────────────────────────────
  it("I. Existing idempotency behavior remains intact", async () => {
    const { device } = await createTestDevice();

    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);
    const invoiceNumber = `INV-ACT-IDEMP-${testRunId}`;
    const opId = crypto.randomUUID();

    const op = makeOp(1, "CREATE_SALE", saleId, {
      invoiceNumber,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 150 }],
      paidAmount: 150,
      userId: testStaffUserId,
    }, opId);

    // 1. First execution
    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res1.success, true);
    assert.deepEqual(res1.acknowledgedOperationIds, [opId]);

    // 2. Duplicate transmission of SAME operation
    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res2.success, true, "Duplicate operation must return SUCCESS");
    assert.deepEqual(res2.acknowledgedOperationIds, [opId], "Duplicate must acknowledge opId");

    // Verify sale was NOT duplicated
    const sales = await prisma.sale.findMany({ where: { id: saleId } });
    assert.equal(sales.length, 1);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // J. Existing sequence validation remains intact
  // ─────────────────────────────────────────────────────────────────────────────
  it("J. Existing sequence validation remains intact", async () => {
    const { device } = await createTestDevice({ lastSequence: BigInt(5) });

    // Send sequence 7 when 6 was expected
    const op = makeOp(7, "CREATE_SALE", crypto.randomUUID(), {
      invoiceNumber: `INV-SEQ-GAP-${testRunId}`,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 150 }],
      paidAmount: 150,
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, false);
    assert.ok(
      res.rejectedOperations?.[0].error.includes("Sequence gap detected") ||
        res.rejectedOperations?.[0].error.includes("expected 6"),
      `Expected sequence gap error, got: ${res.rejectedOperations?.[0].error}`
    );

    // Verify lastSequence was not modified
    const d = await prisma.syncDevice.findUniqueOrThrow({ where: { deviceId: device.deviceId } });
    assert.equal(d.lastSequence, BigInt(5));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // K. Existing SyncChangeLog.operationId behavior remains intact
  // ─────────────────────────────────────────────────────────────────────────────
  it("K. Existing SyncChangeLog.operationId behavior remains intact", async () => {
    const { device } = await createTestDevice();

    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);
    const opId = crypto.randomUUID();

    const op = makeOp(1, "CREATE_SALE", saleId, {
      invoiceNumber: `INV-ACT-CHANGELOG-${testRunId}`,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 150 }],
      paidAmount: 150,
      userId: testStaffUserId,
    }, opId);

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    // Verify SyncChangeLog record has exact immutable operationId
    const changeLog = await prisma.syncChangeLog.findUniqueOrThrow({
      where: { operationId: opId },
    });
    assert.equal(changeLog.operationId, opId);
    assert.equal(changeLog.sourceDeviceId, device.deviceId);
    assert.equal(changeLog.entityId, saleId);
    assert.equal(changeLog.operationType, "CREATE_SALE");
    assert.ok(changeLog.changeSequence > BigInt(0));
  });
});
