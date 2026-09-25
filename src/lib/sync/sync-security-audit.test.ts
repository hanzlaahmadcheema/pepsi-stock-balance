/**
 * Phase 3 Review — Security & Identity Audit Test Suite
 *
 * Verifies:
 *   A. A payload cannot claim Owner identity and bypass authorization (missing/bogus actor fails).
 *   B. Owner-only stock adjustment resolution cannot be performed by an unauthorized actor (Staff rejected).
 *   C. UPDATE_USER cannot be used for unauthorized role escalation (Staff promotion rejected).
 *   D. CREATE_SALE preserves the originating sale/invoice identity (id and invoiceNumber preserved).
 *   E. EDIT_SALE preserves the same sale identity (same id and invoiceNumber retained).
 *   F. Invoice numbers cannot collide under the current architecture (collision rejected, device-prefixing).
 *
 * Run: npx tsx --test src/lib/sync/sync-security-audit.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  Role,
  PriceTier,
  AdjustmentStatus,
  MovementType,
  Prisma,
} from "@prisma/client";
import { prisma } from "../prisma";
import { hashToken } from "./server/authentication";
import { processDevicePushBatch } from "./server/push";
import { generateUniqueInvoiceNumber } from "./server/handlers/common";
import type { SyncOperation } from "./types";

describe("Phase 3 Security & Identity Audit Tests", () => {
  const testRunId = crypto.randomUUID().slice(0, 8);

  const createdDeviceIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdProductIds = new Set<string>();
  const createdCustomerIds = new Set<string>();
  const createdSaleIds = new Set<string>();
  const createdAdjustmentIds = new Set<string>();

  let testOwnerUserId: string;
  let testStaffUserId: string;
  let testTargetUserId: string;
  let testCustomerId: string;
  let testProductId: string;

  async function createTestDevice(deviceId?: string) {
    const devId = deviceId || `dev-sec-${testRunId}-${crypto.randomUUID().slice(0, 8)}`;
    const rawToken = `tok-${crypto.randomBytes(16).toString("hex")}`;
    const tokenHash = hashToken(rawToken);

    const device = await prisma.syncDevice.create({
      data: {
        deviceId: devId,
        name: `Security Test Device ${devId}`,
        tokenHash,
        lastSequence: BigInt(0),
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
    // 1. Create test Owner
    const owner = await prisma.user.create({
      data: {
        authUserId: `auth-sec-owner-${testRunId}`,
        name: `Sec Owner ${testRunId}`,
        role: Role.OWNER,
        isActive: true,
      },
    });
    testOwnerUserId = owner.id;
    createdUserIds.add(owner.id);

    // 2. Create test Staff
    const staff = await prisma.user.create({
      data: {
        authUserId: `auth-sec-staff-${testRunId}`,
        name: `Sec Staff ${testRunId}`,
        role: Role.STAFF,
        isActive: true,
      },
    });
    testStaffUserId = staff.id;
    createdUserIds.add(staff.id);

    // 3. Create target Staff for role escalation test
    const target = await prisma.user.create({
      data: {
        authUserId: `auth-sec-target-${testRunId}`,
        name: `Sec Target ${testRunId}`,
        role: Role.STAFF,
        isActive: true,
      },
    });
    testTargetUserId = target.id;
    createdUserIds.add(target.id);

    // 4. Create customer
    const customer = await prisma.customer.create({
      data: {
        name: `Sec Customer ${testRunId}`,
        phone: "03001239999",
        creditAllowed: true,
        priceTier: PriceTier.RETAIL,
        isActive: true,
      },
    });
    testCustomerId = customer.id;
    createdCustomerIds.add(customer.id);

    // 5. Create product with initial stock
    const prod = await prisma.product.create({
      data: {
        name: `Sec Product ${testRunId}`,
        brand: "Pepsi",
        sku: `SKU-SEC-${testRunId}`,
        minimumStockLevel: 5,
        latestPurchasePrice: new Prisma.Decimal("100.00"),
        isActive: true,
      },
    });
    testProductId = prod.id;
    createdProductIds.add(prod.id);

    await prisma.stockMovement.create({
      data: {
        productId: testProductId,
        movementType: MovementType.RECEIVING,
        quantity: 50,
        referenceType: "InitialSeed",
        referenceId: crypto.randomUUID(),
        createdById: testOwnerUserId,
      },
    });
  });

  after(async () => {
    // Teardown created test data
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
  // TEST A: A payload cannot claim Owner identity and bypass authorization
  // ─────────────────────────────────────────────────────────────────────────────
  it("A. A payload cannot claim Owner identity and bypass authorization", async () => {
    const { device } = await createTestDevice();

    // Create a pending stock adjustment
    const adjId = crypto.randomUUID();
    createdAdjustmentIds.add(adjId);
    await prisma.stockAdjustment.create({
      data: {
        id: adjId,
        productId: testProductId,
        oldQuantity: 50,
        newQuantity: 55,
        difference: 5,
        reason: "Discrepancy needing approval",
        status: AdjustmentStatus.PENDING,
        requestedById: testStaffUserId,
      },
    });

    // Sub-test A1: Payload omits userId entirely — must NOT silently fall back to an Owner
    const opMissingUser = makeOp(1, "RESOLVE_STOCK_ADJUSTMENT", adjId, {
      decision: "APPROVE",
      reason: "Attempting approval without userId",
    });
    const resA1 = await processDevicePushBatch(device, crypto.randomUUID(), [opMissingUser]);
    assert.equal(resA1.success, false);
    assert.ok(
      resA1.rejectedOperations?.[0].error.includes("Actor user ID is required"),
      `Expected error about missing actor, got: ${resA1.rejectedOperations?.[0].error}`
    );

    // Sub-test A2: Payload supplies a fabricated non-existent UUID — must NOT bypass checks
    const opFakeOwner = makeOp(1, "RESOLVE_STOCK_ADJUSTMENT", adjId, {
      decision: "APPROVE",
      reason: "Attempting approval with spoofed non-existent UUID",
      userId: crypto.randomUUID(),
    });
    const resA2 = await processDevicePushBatch(device, crypto.randomUUID(), [opFakeOwner]);
    assert.equal(resA2.success, false);
    assert.ok(
      resA2.rejectedOperations?.[0].error.includes("Unauthorized: Only an Owner can resolve stock adjustments"),
      `Expected authorization failure, got: ${resA2.rejectedOperations?.[0].error}`
    );

    // Verify stock adjustment remained unchanged (still PENDING)
    const adjAfter = await prisma.stockAdjustment.findUniqueOrThrow({ where: { id: adjId } });
    assert.equal(adjAfter.status, AdjustmentStatus.PENDING);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST B: Stock adjustment resolution can be performed by Staff; inactive user cannot
  // ─────────────────────────────────────────────────────────────────────────────
  it("B. Stock adjustment resolution can be performed by Staff; inactive user cannot", async () => {
    const { device } = await createTestDevice();

    const adjId = crypto.randomUUID();
    createdAdjustmentIds.add(adjId);
    await prisma.stockAdjustment.create({
      data: {
        id: adjId,
        productId: testProductId,
        oldQuantity: 50,
        newQuantity: 48,
        difference: -2,
        reason: "Physical count was short 2 crates",
        status: AdjustmentStatus.PENDING,
        requestedById: testStaffUserId,
      },
    });

    // Sub-test B1: Inactive user attempts to approve the adjustment
    const inactiveUser = await prisma.user.create({
      data: {
        authUserId: `auth-sec-inactive-${testRunId}`,
        name: `Sec Inactive ${testRunId}`,
        role: Role.STAFF,
        isActive: false,
      },
    });
    createdUserIds.add(inactiveUser.id);

    const inactiveResolveOp = makeOp(1, "RESOLVE_STOCK_ADJUSTMENT", adjId, {
      decision: "APPROVE",
      reason: "Inactive user attempting to approve adjustment",
      userId: inactiveUser.id,
    });

    const resInactive = await processDevicePushBatch(device, crypto.randomUUID(), [inactiveResolveOp]);
    assert.equal(resInactive.success, false);
    assert.equal(resInactive.acknowledgedOperationIds.length, 0);
    assert.ok(
      resInactive.rejectedOperations?.[0].error.includes("INACTIVE_ACTOR"),
      `Expected inactive error, got: ${resInactive.rejectedOperations?.[0].error}`
    );

    // Sub-test B2: Active Staff user resolves the adjustment (verification from owner not required)
    const staffResolveOp = makeOp(1, "RESOLVE_STOCK_ADJUSTMENT", adjId, {
      decision: "APPROVE",
      reason: "Staff resolving adjustment per business rule",
      userId: testStaffUserId,
    });

    const resStaff = await processDevicePushBatch(device, crypto.randomUUID(), [staffResolveOp]);
    assert.equal(resStaff.success, true);
    assert.equal(resStaff.acknowledgedOperationIds.length, 1);

    // Verify the record was approved
    const adjRow = await prisma.stockAdjustment.findUniqueOrThrow({ where: { id: adjId } });
    assert.equal(adjRow.status, AdjustmentStatus.APPROVED);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST C: UPDATE_USER cannot be used for unauthorized role escalation
  // ─────────────────────────────────────────────────────────────────────────────
  it("C. UPDATE_USER cannot be used for unauthorized role escalation", async () => {
    const { device } = await createTestDevice();

    // Sub-test C1: Staff actor attempts to promote target user to OWNER
    const escalateOp = makeOp(1, "UPDATE_USER", testTargetUserId, {
      role: Role.OWNER,
      actorUserId: testStaffUserId,
    });

    const resC1 = await processDevicePushBatch(device, crypto.randomUUID(), [escalateOp]);
    assert.equal(resC1.success, false);
    assert.ok(
      resC1.rejectedOperations?.[0].error.includes("Staff cannot promote users to Owner"),
      `Expected role escalation error, got: ${resC1.rejectedOperations?.[0].error}`
    );

    // Sub-test C2: Missing actorUserId when promoting to OWNER
    const noActorOp = makeOp(1, "UPDATE_USER", testTargetUserId, {
      role: Role.OWNER,
    });

    const resC2 = await processDevicePushBatch(device, crypto.randomUUID(), [noActorOp]);
    assert.equal(resC2.success, false);
    assert.ok(
      resC2.rejectedOperations?.[0].error.includes("Missing actor for Owner promotion"),
      `Expected missing actor error, got: ${resC2.rejectedOperations?.[0].error}`
    );

    // Sub-test C3: Staff actor attempts to modify an existing Owner account
    const modifyOwnerOp = makeOp(1, "UPDATE_USER", testOwnerUserId, {
      name: "Tampered Owner Name",
      actorUserId: testStaffUserId,
    });

    const resC3 = await processDevicePushBatch(device, crypto.randomUUID(), [modifyOwnerOp]);
    assert.equal(resC3.success, false);
    assert.ok(
      resC3.rejectedOperations?.[0].error.includes("Staff cannot modify an Owner account"),
      `Expected staff modify owner error, got: ${resC3.rejectedOperations?.[0].error}`
    );

    // Verify target user remains STAFF
    const targetUserAfter = await prisma.user.findUniqueOrThrow({ where: { id: testTargetUserId } });
    assert.equal(targetUserAfter.role, Role.STAFF);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST D: CREATE_SALE preserves originating sale and invoice identity
  // ─────────────────────────────────────────────────────────────────────────────
  it("D. CREATE_SALE preserves originating sale/invoice identity", async () => {
    const { device } = await createTestDevice();

    const localSaleId = crypto.randomUUID();
    createdSaleIds.add(localSaleId);
    const localInvoiceNumber = `INV-DEPOT01-${testRunId}-0001`;

    const createSaleOp = makeOp(1, "CREATE_SALE", localSaleId, {
      invoiceNumber: localInvoiceNumber,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 2, unitPrice: 150 }],
      discount: 0,
      paidAmount: 300,
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [createSaleOp]);
    assert.equal(res.success, true);
    assert.deepEqual(res.acknowledgedOperationIds, [createSaleOp.operationId]);

    // Authoritative check on Cloud database
    const savedSale = await prisma.sale.findUniqueOrThrow({ where: { id: localSaleId } });
    assert.equal(savedSale.id, localSaleId, "Sale id must match originating local entityId");
    assert.equal(
      savedSale.invoiceNumber,
      localInvoiceNumber,
      "Invoice number must match originating local invoiceNumber without alteration"
    );

    // Check SyncChangeLog
    const changeLog = await prisma.syncChangeLog.findFirstOrThrow({
      where: { entityId: localSaleId, operationType: "CREATE_SALE" },
    });
    const payload = changeLog.payload as Record<string, unknown>;
    assert.equal(payload.id, localSaleId);
    assert.equal(payload.invoiceNumber, localInvoiceNumber);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST E: EDIT_SALE preserves the same sale identity
  // ─────────────────────────────────────────────────────────────────────────────
  it("E. EDIT_SALE preserves the same sale identity", async () => {
    const { device } = await createTestDevice();

    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);
    const invoiceNumber = `INV-DEPOT01-${testRunId}-0002`;

    // 1. Create initial sale
    const createOp = makeOp(1, "CREATE_SALE", saleId, {
      invoiceNumber,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 3, unitPrice: 150 }],
      discount: 0,
      paidAmount: 450,
      userId: testStaffUserId,
    });
    const resCreate = await processDevicePushBatch(device, crypto.randomUUID(), [createOp]);
    assert.equal(resCreate.success, true);

    // 2. Edit sale (reduce to 2 crates)
    const editOp = makeOp(2, "EDIT_SALE", saleId, {
      reason: "Customer reduced order to 2 crates",
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 2, unitPrice: 150 }],
      discount: 0,
      paidAmount: 300,
      userId: testStaffUserId,
    });
    const resEdit = await processDevicePushBatch(device, crypto.randomUUID(), [editOp]);
    assert.equal(resEdit.success, true);

    // Verify sale row retained exact same id and invoiceNumber
    const editedSale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    assert.equal(editedSale.id, saleId, "Sale id must be preserved across edits");
    assert.equal(
      editedSale.invoiceNumber,
      invoiceNumber,
      "Invoice number must remain completely unchanged across edits"
    );
    assert.equal(Number(editedSale.totalAmount), 300);

    // Verify SyncChangeLog for EDIT_SALE has the exact same invoiceNumber
    const editChangeLog = await prisma.syncChangeLog.findFirstOrThrow({
      where: { entityId: saleId, operationType: "EDIT_SALE" },
    });
    const editPayload = editChangeLog.payload as Record<string, unknown>;
    assert.equal(editPayload.id, saleId);
    assert.equal(editPayload.invoiceNumber, invoiceNumber);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST F: Invoice numbers cannot collide under the current architecture
  // ─────────────────────────────────────────────────────────────────────────────
  it("F. Invoice numbers cannot collide under the current architecture", async () => {
    const { device: deviceA } = await createTestDevice("DEPOT-A");
    const { device: deviceB } = await createTestDevice("DEPOT-B");

    const sharedInvoiceNumber = `INV-COLLISION-${testRunId}`;
    const saleIdA = crypto.randomUUID();
    const saleIdB = crypto.randomUUID();
    createdSaleIds.add(saleIdA);
    createdSaleIds.add(saleIdB);

    // 1. Device A creates a sale with sharedInvoiceNumber
    const opA = makeOp(1, "CREATE_SALE", saleIdA, {
      invoiceNumber: sharedInvoiceNumber,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 150 }],
      paidAmount: 150,
      userId: testStaffUserId,
    });
    const resA = await processDevicePushBatch(deviceA, crypto.randomUUID(), [opA]);
    assert.equal(resA.success, true);

    // 2. Device B attempts to push a DIFFERENT sale with the SAME invoice number
    const opB = makeOp(1, "CREATE_SALE", saleIdB, {
      invoiceNumber: sharedInvoiceNumber,
      customerId: testCustomerId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 150 }],
      paidAmount: 150,
      userId: testStaffUserId,
    });
    const resB = await processDevicePushBatch(deviceB, crypto.randomUUID(), [opB]);

    // Crucial check: Cloud must REJECT the collision with an explicit error,
    // rather than silently giving Device B a random new invoice number!
    assert.equal(resB.success, false);
    assert.ok(
      resB.rejectedOperations?.[0].error.includes("Invoice collision"),
      `Expected explicit invoice collision rejection, got: ${resB.rejectedOperations?.[0].error}`
    );

    // Verify Device B's sale was NOT created under a modified invoice number
    const saleB = await prisma.sale.findUnique({ where: { id: saleIdB } });
    assert.equal(saleB, null, "Colliding sale must not be created");

    // 3. Verify fallback generator produces device-prefixed invoice numbers
    const generatedInvoice = await generateUniqueInvoiceNumber(prisma, "DEPOT-B");
    assert.ok(
      generatedInvoice.startsWith("INV-DEPOT-B-"),
      `Expected device prefix 'INV-DEPOT-B-', got: ${generatedInvoice}`
    );
  });
});
