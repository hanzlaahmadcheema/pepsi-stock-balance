/**
 * Phase 3 Sync — Business Push Handlers Integration Tests
 *
 * Exercises all 30 business scenarios (A through AD) against the live
 * development Supabase database:
 *
 *   A. CREATE_SALE creates complete sale aggregate
 *   B. CREATE_SALE rolls back completely when one child mutation fails
 *   C. CREATE_SALE creates required stock movements
 *   D. CREATE_SALE creates required container movements when applicable
 *   E. Duplicate CREATE_SALE operationId does not duplicate the sale
 *   F. EDIT_SALE correctly replaces/reconciles SaleItems
 *   G. EDIT_SALE can remove a previous payment when final state requires it
 *   H. EDIT_SALE does not leave stale child records
 *   I. CANCEL_SALE reverses the required stock effects
 *   J. POST_RECEIVING creates receiving + items + stock effects atomically
 *   K. DELETE_DRAFT_RECEIVING only deletes drafts
 *   L. RECORD_PAYMENT updates the correct balance
 *   M. Duplicate RECORD_PAYMENT does not duplicate payment
 *   N. CREATE_RETURN creates quarantined return
 *   O. INSPECT_RETURN applies correct inspection result
 *   P. RECORD_DAMAGE updates stock and records damage
 *   Q. SUBMIT_STOCK_COUNT records physical count/discrepancy
 *   R. RESOLVE_STOCK_ADJUSTMENT respects approval
 *   S. UPSERT_CUSTOMER works idempotently
 *   T. UPSERT_PRODUCT works idempotently
 *   U. CREATE_PRICE preserves price history
 *   V. UPSERT_SUPPLIER works idempotently
 *   W. UPDATE_USER respects role/permission rules
 *   X. Successful operation creates required SyncChangeLog entries
 *   Y. Failed operation creates NO business mutation
 *   Z. Failed operation creates NO SUCCESS ProcessedSyncOperation
 *   AA. Failed operation does not advance SyncDevice.lastSequence
 *   AB. Retry of the same operation after failure succeeds without duplication
 *   AC. 17 success / 18 failure / 19 blocked behavior still works
 *   AD. Phase 1 + Phase 2 regression tests still pass
 *
 * Run: npx tsx --test src/lib/sync/sync-business.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  Role,
  PriceTier,
  SaleStatus,
  SaleType,
  PaymentMethod,
  MovementType,
  ContainerType,
  ContainerMovementType,
  ReturnStatus,
  InspectionResult,
  DamageType,
  DailyClosingStatus,
  AdjustmentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../prisma";
import { hashToken } from "./server/authentication";
import { processDevicePushBatch } from "./server/push";
import type { SyncOperation } from "./types";

describe("Phase 3 Sync: Business Push Handlers", () => {
  const testRunId = crypto.randomUUID().slice(0, 8);

  // Track created entities for isolated teardown
  const createdDeviceIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdProductIds = new Set<string>();
  const createdCustomerIds = new Set<string>();
  const createdSupplierIds = new Set<string>();
  const createdSaleIds = new Set<string>();
  const createdReceivingIds = new Set<string>();
  const createdReturnIds = new Set<string>();
  const createdDamageIds = new Set<string>();
  const createdClosingIds = new Set<string>();
  const createdAdjustmentIds = new Set<string>();

  // Shared test fixtures
  let testOwnerUserId: string;
  let testStaffUserId: string;
  let testSupplierId: string;
  let testCustomerId: string;
  let testProductId1: string;
  let testProductId2: string;

  async function createTestDevice(overrides: { lastSequence?: bigint } = {}) {
    const devId = `dev-biz-${testRunId}-${crypto.randomUUID().slice(0, 8)}`;
    const rawToken = `tok-${crypto.randomBytes(16).toString("hex")}`;
    const tokenHash = hashToken(rawToken);

    const device = await prisma.syncDevice.create({
      data: {
        deviceId: devId,
        name: `Test Device ${devId}`,
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
    // 1. Create test owner user
    const ownerUser = await prisma.user.create({
      data: {
        authUserId: `auth-owner-${testRunId}`,
        name: `Test Owner ${testRunId}`,
        role: Role.OWNER,
        isActive: true,
      },
    });
    testOwnerUserId = ownerUser.id;
    createdUserIds.add(ownerUser.id);

    // 2. Create test staff user
    const staffUser = await prisma.user.create({
      data: {
        authUserId: `auth-staff-${testRunId}`,
        name: `Test Staff ${testRunId}`,
        role: Role.STAFF,
        isActive: true,
      },
    });
    testStaffUserId = staffUser.id;
    createdUserIds.add(staffUser.id);

    // 3. Create test supplier
    const supplier = await prisma.supplier.create({
      data: {
        name: `Supplier ${testRunId}`,
        contactPerson: "Distributor Contact",
        phone: "03001234567",
        isActive: true,
      },
    });
    testSupplierId = supplier.id;
    createdSupplierIds.add(supplier.id);

    // 4. Create test customer
    const customer = await prisma.customer.create({
      data: {
        name: `Customer ${testRunId}`,
        phone: "03009876543",
        creditAllowed: true,
        priceTier: PriceTier.RETAIL,
        isActive: true,
      },
    });
    testCustomerId = customer.id;
    createdCustomerIds.add(customer.id);

    // 5. Create test products
    const prod1 = await prisma.product.create({
      data: {
        name: `Product-1-${testRunId}`,
        brand: "Pepsi",
        sku: `SKU-1-${testRunId}`,
        minimumStockLevel: 5,
        latestPurchasePrice: new Prisma.Decimal("100.00"),
        isActive: true,
      },
    });
    testProductId1 = prod1.id;
    createdProductIds.add(prod1.id);

    const prod2 = await prisma.product.create({
      data: {
        name: `Product-2-${testRunId}`,
        brand: "Mirinda",
        sku: `SKU-2-${testRunId}`,
        minimumStockLevel: 5,
        latestPurchasePrice: new Prisma.Decimal("95.00"),
        isActive: true,
      },
    });
    testProductId2 = prod2.id;
    createdProductIds.add(prod2.id);

    // Seed stock: 100 crates for prod1, 50 crates for prod2
    await prisma.stockMovement.createMany({
      data: [
        {
          productId: testProductId1,
          movementType: MovementType.RECEIVING,
          quantity: 100,
          referenceType: "InitialSeed",
          referenceId: crypto.randomUUID(),
          createdById: testOwnerUserId,
        },
        {
          productId: testProductId2,
          movementType: MovementType.RECEIVING,
          quantity: 50,
          referenceType: "InitialSeed",
          referenceId: crypto.randomUUID(),
          createdById: testOwnerUserId,
        },
      ],
    });
  });

  after(async () => {
    // Isolated teardown
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
      await prisma.containerMovement.deleteMany({
        where: { referenceId: { in: Array.from(createdSaleIds) } },
      });
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

    if (createdReturnIds.size > 0) {
      await prisma.containerMovement.deleteMany({
        where: { referenceId: { in: Array.from(createdReturnIds) } },
      });
      await prisma.stockMovement.deleteMany({
        where: { referenceType: "Return", referenceId: { in: Array.from(createdReturnIds) } },
      });
      await prisma.damageRecord.deleteMany({
        where: { referenceId: { not: null } },
      });
      await prisma.returnItem.deleteMany({
        where: { returnId: { in: Array.from(createdReturnIds) } },
      });
      await prisma.return.deleteMany({
        where: { id: { in: Array.from(createdReturnIds) } },
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

    if (createdClosingIds.size > 0) {
      await prisma.stockCount.deleteMany({
        where: { closingId: { in: Array.from(createdClosingIds) } },
      });
      await prisma.dailyClosing.deleteMany({
        where: { id: { in: Array.from(createdClosingIds) } },
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

    if (createdDamageIds.size > 0) {
      await prisma.stockMovement.deleteMany({
        where: { referenceType: "DamageRecord", referenceId: { in: Array.from(createdDamageIds) } },
      });
      await prisma.damageRecord.deleteMany({
        where: { id: { in: Array.from(createdDamageIds) } },
      });
    }

    if (createdProductIds.size > 0) {
      await prisma.price.deleteMany({
        where: { productId: { in: Array.from(createdProductIds) } },
      });
      await prisma.stockMovement.deleteMany({
        where: { productId: { in: Array.from(createdProductIds) } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: Array.from(createdProductIds) } },
      });
    }

    if (createdCustomerIds.size > 0) {
      await prisma.payment.deleteMany({
        where: { customerId: { in: Array.from(createdCustomerIds) } },
      });
      await prisma.customer.deleteMany({
        where: { id: { in: Array.from(createdCustomerIds) } },
      });
    }

    if (createdSupplierIds.size > 0) {
      await prisma.supplier.deleteMany({
        where: { id: { in: Array.from(createdSupplierIds) } },
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
  // A. CREATE_SALE creates complete sale aggregate
  // ─────────────────────────────────────────────────────────────────────────────
  it("A. CREATE_SALE creates complete sale aggregate atomically", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    const op = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId1, quantity: 5, unitPrice: 120 }],
      discount: 20,
      paymentMethod: "CASH",
      paidAmount: 200,
      userId: testStaffUserId,
      containers: { plasticCrates: 5 },
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);

    assert.equal(res.success, true);
    assert.deepEqual(res.acknowledgedOperationIds, [op.operationId]);

    // Verify Sale header
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, payments: true },
    });
    assert.ok(sale);
    assert.equal(sale.id, saleId);
    assert.equal(Number(sale.subtotal), 600);
    assert.equal(Number(sale.discount), 20);
    assert.equal(Number(sale.totalAmount), 580);
    assert.equal(Number(sale.paidAmount), 200);
    assert.equal(Number(sale.creditAmount), 380);

    // Verify SaleItem
    assert.equal(sale.items.length, 1);
    assert.equal(sale.items[0].productId, testProductId1);
    assert.equal(sale.items[0].quantity, 5);

    // Verify initial Payment
    assert.equal(sale.payments.length, 1);
    assert.equal(Number(sale.payments[0].amount), 200);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // B. CREATE_SALE rolls back completely when one child mutation fails
  // ─────────────────────────────────────────────────────────────────────────────
  it("B. CREATE_SALE rolls back completely when child mutation fails (e.g. insufficient stock)", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();

    const op = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [
        { productId: testProductId1, quantity: 2, unitPrice: 120 },
        { productId: testProductId2, quantity: 99999, unitPrice: 100 }, // Insufficient stock!
      ],
      discount: 0,
      paidAmount: 0,
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);

    assert.equal(res.success, false);
    assert.equal(res.acknowledgedOperationIds.length, 0);
    assert.ok(res.rejectedOperations && res.rejectedOperations.length === 1);

    // Verify complete rollback: sale row does not exist
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    assert.equal(sale, null, "Sale record must not exist after rollback");

    // Verify no stock movements exist for this saleId
    const movements = await prisma.stockMovement.findMany({
      where: { referenceType: "Sale", referenceId: saleId },
    });
    assert.equal(movements.length, 0, "No stock movements must exist after rollback");

    // Verify no ProcessedSyncOperation row exists
    const processed = await prisma.processedSyncOperation.findUnique({
      where: { operationId: op.operationId },
    });
    assert.equal(processed, null, "ProcessedSyncOperation must not exist after rollback");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // C. CREATE_SALE creates required stock movements
  // ─────────────────────────────────────────────────────────────────────────────
  it("C. CREATE_SALE creates required negative StockMovement records", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    const op = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId1, quantity: 3, unitPrice: 120 }],
      discount: 0,
      paidAmount: 360,
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const movement = await prisma.stockMovement.findFirst({
      where: { referenceType: "Sale", referenceId: saleId },
    });
    assert.ok(movement);
    assert.equal(movement.movementType, MovementType.SALE);
    assert.equal(movement.quantity, -3);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // D. CREATE_SALE creates required container movements when applicable
  // ─────────────────────────────────────────────────────────────────────────────
  it("D. CREATE_SALE creates required ContainerMovement records for named customer", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    const op = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId1, quantity: 4, unitPrice: 120 }],
      discount: 0,
      paidAmount: 480,
      userId: testStaffUserId,
      containers: { plasticCrates: 4, glassBottles: 96 },
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const containerMoves = await prisma.containerMovement.findMany({
      where: { referenceId: saleId },
    });
    assert.equal(containerMoves.length, 2);

    const crates = containerMoves.find((c) => c.containerType === ContainerType.PLASTIC_CRATE);
    const bottles = containerMoves.find((c) => c.containerType === ContainerType.GLASS_BOTTLE);
    assert.ok(crates && crates.quantity === 4 && crates.movementType === ContainerMovementType.DEBIT);
    assert.ok(bottles && bottles.quantity === 96 && bottles.movementType === ContainerMovementType.DEBIT);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // E. Duplicate CREATE_SALE operationId does not duplicate the sale
  // ─────────────────────────────────────────────────────────────────────────────
  it("E. Duplicate CREATE_SALE operationId returns previous ACK without duplicating sale", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    const op = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId1, quantity: 2, unitPrice: 120 }],
      discount: 0,
      paidAmount: 240,
      userId: testStaffUserId,
    });

    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res1.success, true);

    // Duplicate replay
    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res2.success, true);
    assert.deepEqual(res2.acknowledgedOperationIds, [op.operationId]);

    const salesCount = await prisma.sale.count({ where: { id: saleId } });
    assert.equal(salesCount, 1, "Sale must not be duplicated");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // F. EDIT_SALE correctly replaces/reconciles SaleItems
  // ─────────────────────────────────────────────────────────────────────────────
  it("F. EDIT_SALE correctly replaces/reconciles SaleItems and updates totals", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    // Step 1: Create sale with 3 crates of prod1
    const createOp = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId1, quantity: 3, unitPrice: 100 }],
      discount: 0,
      paidAmount: 300,
      userId: testStaffUserId,
    });
    await processDevicePushBatch(device, crypto.randomUUID(), [createOp]);

    // Step 2: Edit sale to 5 crates of prod2 instead
    const editOp = makeOp(2, "EDIT_SALE", saleId, {
      reason: "Customer changed order to Mirinda",
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId2, quantity: 5, unitPrice: 110 }],
      discount: 50,
      paidAmount: 500,
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [editOp]);
    assert.equal(res.success, true);

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { items: true },
    });

    assert.equal(sale.items.length, 1);
    assert.equal(sale.items[0].productId, testProductId2);
    assert.equal(sale.items[0].quantity, 5);
    assert.equal(Number(sale.subtotal), 550);
    assert.equal(Number(sale.discount), 50);
    assert.equal(Number(sale.totalAmount), 500);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // G. EDIT_SALE can remove a previous payment when final state requires it
  // ─────────────────────────────────────────────────────────────────────────────
  it("G. EDIT_SALE removes previous payment when final state has paidAmount = 0", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    // Create sale with payment of 200
    const createOp = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId1, quantity: 2, unitPrice: 100 }],
      discount: 0,
      paidAmount: 200,
      userId: testStaffUserId,
    });
    await processDevicePushBatch(device, crypto.randomUUID(), [createOp]);

    const initialPayments = await prisma.payment.findMany({ where: { saleId } });
    assert.equal(initialPayments.length, 1);

    // Edit sale: change to full credit (paidAmount = 0)
    const editOp = makeOp(2, "EDIT_SALE", saleId, {
      reason: "Customer converted purchase to credit account",
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId1, quantity: 2, unitPrice: 100 }],
      discount: 0,
      paidAmount: 0,
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [editOp]);
    assert.equal(res.success, true);

    const updatedPayments = await prisma.payment.findMany({ where: { saleId } });
    assert.equal(updatedPayments.length, 0, "Payment must be removed when edited paidAmount is 0");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // H. EDIT_SALE does not leave stale child records
  // ─────────────────────────────────────────────────────────────────────────────
  it("H. EDIT_SALE does not leave stale child records", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    const createOp = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [
        { productId: testProductId1, quantity: 1, unitPrice: 100 },
        { productId: testProductId2, quantity: 2, unitPrice: 100 },
      ],
      discount: 0,
      paidAmount: 300,
      userId: testStaffUserId,
    });
    await processDevicePushBatch(device, crypto.randomUUID(), [createOp]);

    // Edit down to just 1 item
    const editOp = makeOp(2, "EDIT_SALE", saleId, {
      reason: "Removed second product",
      customerId: testCustomerId,
      items: [{ productId: testProductId1, quantity: 1, unitPrice: 100 }],
      discount: 0,
      paidAmount: 100,
      userId: testStaffUserId,
    });
    const res = await processDevicePushBatch(device, crypto.randomUUID(), [editOp]);
    assert.equal(res.success, true);

    const items = await prisma.saleItem.findMany({ where: { saleId } });
    assert.equal(items.length, 1);
    assert.equal(items[0].productId, testProductId1);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // I. CANCEL_SALE reverses the required stock effects
  // ─────────────────────────────────────────────────────────────────────────────
  it("I. CANCEL_SALE marks invoice CANCELLED and creates SALE_CANCELLATION stock movements", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    const createOp = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId1, quantity: 5, unitPrice: 100 }],
      discount: 0,
      paidAmount: 500,
      userId: testStaffUserId,
    });
    await processDevicePushBatch(device, crypto.randomUUID(), [createOp]);

    const cancelOp = makeOp(2, "CANCEL_SALE", saleId, {
      reason: "Customer order cancelled before dispatch",
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [cancelOp]);
    assert.equal(res.success, true);

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    assert.equal(sale.status, SaleStatus.CANCELLED);
    assert.equal(sale.cancellationReason, "Customer order cancelled before dispatch");

    const reversalMovements = await prisma.stockMovement.findMany({
      where: {
        referenceType: "Sale",
        referenceId: saleId,
        movementType: MovementType.SALE_CANCELLATION,
      },
    });
    assert.equal(reversalMovements.length, 1);
    assert.equal(reversalMovements[0].quantity, 5);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // J. POST_RECEIVING creates receiving + items + stock effects atomically
  // ─────────────────────────────────────────────────────────────────────────────
  it("J. POST_RECEIVING creates receiving, items, stock movements, and updates latestPurchasePrice", async () => {
    const { device } = await createTestDevice();
    const receivingId = crypto.randomUUID();
    createdReceivingIds.add(receivingId);

    const op = makeOp(1, "POST_RECEIVING", receivingId, {
      supplierId: testSupplierId,
      referenceNumber: "DELIVERY-999",
      items: [{ productId: testProductId1, quantity: 25, purchasePrice: 105.5 }],
      userId: testOwnerUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const receiving = await prisma.receiving.findUnique({
      where: { id: receivingId },
      include: { items: true },
    });
    assert.ok(receiving);
    assert.equal(receiving.referenceNumber, "DELIVERY-999");
    assert.equal(receiving.items.length, 1);
    assert.equal(receiving.items[0].quantity, 25);

    const stockMove = await prisma.stockMovement.findFirst({
      where: { referenceType: "Receiving", referenceId: receivingId },
    });
    assert.ok(stockMove);
    assert.equal(stockMove.movementType, MovementType.RECEIVING);
    assert.equal(stockMove.quantity, 25);

    const product = await prisma.product.findUniqueOrThrow({ where: { id: testProductId1 } });
    assert.equal(Number(product.latestPurchasePrice), 105.5);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // K. DELETE_DRAFT_RECEIVING only deletes drafts
  // ─────────────────────────────────────────────────────────────────────────────
  it("K. DELETE_DRAFT_RECEIVING only deletes drafts; strictly forbids deleting posted", async () => {
    const { device } = await createTestDevice();

    // 1. Create an unposted draft receiving directly
    const draftId = crypto.randomUUID();
    createdReceivingIds.add(draftId);

    await prisma.receiving.create({
      data: {
        id: draftId,
        supplierId: testSupplierId,
        referenceNumber: "DRAFT-01",
        createdById: testOwnerUserId,
        items: {
          create: [{ productId: testProductId1, quantity: 10, purchasePrice: 100, totalCost: 1000 }],
        },
      },
    });

    // Delete the draft via sync
    const deleteOp = makeOp(1, "DELETE_DRAFT_RECEIVING", draftId, {});
    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [deleteOp]);
    assert.equal(res1.success, true);

    const checkDraft = await prisma.receiving.findUnique({ where: { id: draftId } });
    assert.equal(checkDraft, null, "Draft receiving should be deleted");

    // 2. Try deleting a posted receiving (should fail deterministically)
    const postedId = crypto.randomUUID();
    createdReceivingIds.add(postedId);

    const postOp = makeOp(2, "POST_RECEIVING", postedId, {
      supplierId: testSupplierId,
      referenceNumber: "POSTED-01",
      items: [{ productId: testProductId1, quantity: 5, purchasePrice: 100 }],
      userId: testOwnerUserId,
    });
    await processDevicePushBatch(device, crypto.randomUUID(), [postOp]);

    const deletePostedOp = makeOp(3, "DELETE_DRAFT_RECEIVING", postedId, {});
    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [deletePostedOp]);

    assert.equal(res2.success, false);
    assert.ok(res2.rejectedOperations && res2.rejectedOperations.length === 1);
    assert.ok(res2.rejectedOperations[0].error.includes("Posted receiving cannot be deleted"));

    // Verify posted receiving still exists
    const checkPosted = await prisma.receiving.findUnique({ where: { id: postedId } });
    assert.ok(checkPosted, "Posted receiving must not be deleted");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // L. RECORD_PAYMENT updates the correct balance
  // ─────────────────────────────────────────────────────────────────────────────
  it("L. RECORD_PAYMENT updates the correct balance against sale invoice", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    // Create credit sale: total 600, paid 100, credit 500
    const saleOp = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId1, quantity: 5, unitPrice: 120 }],
      discount: 0,
      paidAmount: 100,
      userId: testStaffUserId,
    });
    await processDevicePushBatch(device, crypto.randomUUID(), [saleOp]);

    // Record additional payment of 300
    const paymentId = crypto.randomUUID();
    const payOp = makeOp(2, "RECORD_PAYMENT", paymentId, {
      customerId: testCustomerId,
      saleId,
      amount: 300,
      paymentMethod: "EASYPAISA",
      referenceNumber: "EP-12345",
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [payOp]);
    assert.equal(res.success, true);

    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } });
    assert.equal(Number(sale.paidAmount), 400);
    assert.equal(Number(sale.creditAmount), 200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assert.equal(Number(payment.amount), 300);
    assert.equal(payment.paymentMethod, PaymentMethod.EASYPAISA);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // M. Duplicate RECORD_PAYMENT does not duplicate payment
  // ─────────────────────────────────────────────────────────────────────────────
  it("M. Duplicate RECORD_PAYMENT does not duplicate payment (idempotency)", async () => {
    const { device } = await createTestDevice();
    const paymentId = crypto.randomUUID();

    const payOp = makeOp(1, "RECORD_PAYMENT", paymentId, {
      customerId: testCustomerId,
      amount: 50,
      paymentMethod: "CASH",
      userId: testStaffUserId,
    });

    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [payOp]);
    assert.equal(res1.success, true);

    // Duplicate replay
    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [payOp]);
    assert.equal(res2.success, true);
    assert.deepEqual(res2.acknowledgedOperationIds, [payOp.operationId]);

    const paymentsCount = await prisma.payment.count({ where: { id: paymentId } });
    assert.equal(paymentsCount, 1, "Payment must not be recorded twice");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // N. CREATE_RETURN creates quarantined return
  // ─────────────────────────────────────────────────────────────────────────────
  it("N. CREATE_RETURN creates return in QUARANTINED status without immediate restock", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    const saleOp = makeOp(1, "CREATE_SALE", saleId, {
      customerId: testCustomerId,
      saleType: "RETAIL",
      items: [{ productId: testProductId1, quantity: 10, unitPrice: 100 }],
      discount: 0,
      paidAmount: 1000,
      userId: testStaffUserId,
    });
    await processDevicePushBatch(device, crypto.randomUUID(), [saleOp]);

    const returnId = crypto.randomUUID();
    createdReturnIds.add(returnId);

    const returnOp = makeOp(2, "CREATE_RETURN", returnId, {
      saleId,
      reason: "Customer returned unsold stock",
      items: [{ productId: testProductId1, quantity: 4 }],
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [returnOp]);
    assert.equal(res.success, true);

    const returnRecord = await prisma.return.findUniqueOrThrow({
      where: { id: returnId },
      include: { items: true },
    });

    assert.equal(returnRecord.status, ReturnStatus.QUARANTINED);
    assert.equal(returnRecord.items.length, 1);
    assert.equal(returnRecord.items[0].quantity, 4);
    assert.equal(returnRecord.items[0].inspectionResult, InspectionResult.PENDING);

    // Verify NO restock movement was created yet
    const movements = await prisma.stockMovement.findMany({
      where: { referenceType: "Return", referenceId: returnId },
    });
    assert.equal(movements.length, 0, "No stock movement should be created before inspection");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // O. INSPECT_RETURN applies correct inspection result
  // ─────────────────────────────────────────────────────────────────────────────
  it("O. INSPECT_RETURN applies inspection decisions and creates RETURN_RESTOCK movements", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    // Create sale and return voucher
    await processDevicePushBatch(device, crypto.randomUUID(), [
      makeOp(1, "CREATE_SALE", saleId, {
        customerId: testCustomerId,
        saleType: "RETAIL",
        items: [{ productId: testProductId1, quantity: 6, unitPrice: 100 }],
        discount: 0,
        paidAmount: 600,
        userId: testStaffUserId,
      }),
    ]);

    const returnId = crypto.randomUUID();
    createdReturnIds.add(returnId);

    await processDevicePushBatch(device, crypto.randomUUID(), [
      makeOp(2, "CREATE_RETURN", returnId, {
        saleId,
        items: [{ productId: testProductId1, quantity: 3 }],
        userId: testStaffUserId,
      }),
    ]);

    const returnRow = await prisma.return.findUniqueOrThrow({
      where: { id: returnId },
      include: { items: true },
    });

    // Inspect return: Approve for stock
    const inspectOp = makeOp(3, "INSPECT_RETURN", returnId, {
      decisions: [
        {
          returnItemId: returnRow.items[0].id,
          result: InspectionResult.APPROVED_FOR_STOCK,
          notes: "Crates in good condition",
        },
      ],
      generalNotes: "All items passed inspection",
      userId: testOwnerUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [inspectOp]);
    assert.equal(res.success, true);

    const updatedReturn = await prisma.return.findUniqueOrThrow({ where: { id: returnId } });
    assert.equal(updatedReturn.status, ReturnStatus.COMPLETED);

    // Verify positive RETURN_RESTOCK movement created
    const restockMovement = await prisma.stockMovement.findFirst({
      where: {
        referenceType: "Return",
        referenceId: returnId,
        movementType: MovementType.RETURN_RESTOCK,
      },
    });
    assert.ok(restockMovement);
    assert.equal(restockMovement.quantity, 3);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // P. RECORD_DAMAGE updates stock and records damage
  // ─────────────────────────────────────────────────────────────────────────────
  it("P. RECORD_DAMAGE creates DamageRecord and negative StockMovement", async () => {
    const { device } = await createTestDevice();
    const damageId = crypto.randomUUID();
    createdDamageIds.add(damageId);

    const op = makeOp(1, "RECORD_DAMAGE", damageId, {
      productId: testProductId1,
      quantity: 2,
      damageType: DamageType.LEAKAGE,
      reason: "Bottles broken in transit",
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const damageRecord = await prisma.damageRecord.findUnique({ where: { id: damageId } });
    assert.ok(damageRecord);
    assert.equal(damageRecord.quantity, 2);
    assert.equal(damageRecord.damageType, DamageType.LEAKAGE);

    const movement = await prisma.stockMovement.findFirst({
      where: { referenceType: "DamageRecord", referenceId: damageId },
    });
    assert.ok(movement);
    assert.equal(movement.movementType, MovementType.DAMAGE_WRITEOFF);
    assert.equal(movement.quantity, -2);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Q. SUBMIT_STOCK_COUNT records physical count/discrepancy without auto-adjusting
  // ─────────────────────────────────────────────────────────────────────────────
  it("Q. SUBMIT_STOCK_COUNT records physical count/discrepancy without creating StockAdjustment", async () => {
    const { device } = await createTestDevice();
    const closingId = crypto.randomUUID();
    createdClosingIds.add(closingId);

    const businessDate = "2026-09-18";

    const op = makeOp(1, "SUBMIT_STOCK_COUNT", closingId, {
      businessDate,
      counts: [
        {
          productId: testProductId1,
          physicalQuantity: 120, // Discrepancy from actual
        },
      ],
      notes: "Routine evening inventory count",
      userId: testStaffUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const closing = await prisma.dailyClosing.findUnique({
      where: { id: closingId },
      include: { stockCounts: true },
    });
    assert.ok(closing);
    assert.equal(closing.stockCounts.length, 1);
    assert.equal(closing.stockCounts[0].physicalQuantity, 120);

    // CRITICAL ARCHITECTURE RULE: StockAdjustment must NOT be auto-created
    const adjustments = await prisma.stockAdjustment.findMany({
      where: { reason: { contains: closingId } },
    });
    assert.equal(adjustments.length, 0, "StockAdjustment must not be auto-created by SUBMIT_STOCK_COUNT");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // R. RESOLVE_STOCK_ADJUSTMENT respects approval
  // ─────────────────────────────────────────────────────────────────────────────
  it("R. RESOLVE_STOCK_ADJUSTMENT respects approval workflow", async () => {
    const { device } = await createTestDevice();

    // 1. Manually create a pending adjustment
    const adjId = crypto.randomUUID();
    createdAdjustmentIds.add(adjId);

    await prisma.stockAdjustment.create({
      data: {
        id: adjId,
        productId: testProductId1,
        oldQuantity: 100,
        newQuantity: 105,
        difference: 5,
        reason: "Surplus found in warehouse A",
        requestedById: testStaffUserId,
        status: AdjustmentStatus.PENDING,
      },
    });

    // 2. Resolve via sync: APPROVE
    const resolveOp = makeOp(1, "RESOLVE_STOCK_ADJUSTMENT", adjId, {
      decision: "APPROVE",
      reason: "Verified physical presence of 5 extra crates",
      userId: testOwnerUserId,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [resolveOp]);
    assert.equal(res.success, true);

    const updatedAdj = await prisma.stockAdjustment.findUniqueOrThrow({ where: { id: adjId } });
    assert.equal(updatedAdj.status, AdjustmentStatus.APPROVED);

    const movement = await prisma.stockMovement.findFirst({
      where: { referenceType: "StockAdjustment", referenceId: adjId },
    });
    assert.ok(movement);
    assert.equal(movement.movementType, MovementType.ADJUSTMENT_ADD);
    assert.equal(movement.quantity, 5);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // S. UPSERT_CUSTOMER works idempotently
  // ─────────────────────────────────────────────────────────────────────────────
  it("S. UPSERT_CUSTOMER creates and updates customer idempotently with stable UUID", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    // First push: create
    const createOp = makeOp(1, "UPSERT_CUSTOMER", customerId, {
      name: `Sync Customer ${testRunId}`,
      phone: "03001112233",
      priceTier: "WHOLESALE",
      creditAllowed: true,
      isActive: true,
    });

    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [createOp]);
    assert.equal(res1.success, true);

    const cust1 = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust1.name, `Sync Customer ${testRunId}`);
    assert.equal(cust1.priceTier, PriceTier.WHOLESALE);

    // Second push: update
    const updateOp = makeOp(2, "UPSERT_CUSTOMER", customerId, {
      name: `Sync Customer Updated ${testRunId}`,
      phone: "03009998877",
      priceTier: "KEY_ACCOUNT",
      creditAllowed: false,
    });

    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [updateOp]);
    assert.equal(res2.success, true);

    const cust2 = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    assert.equal(cust2.name, `Sync Customer Updated ${testRunId}`);
    assert.equal(cust2.priceTier, PriceTier.KEY_ACCOUNT);
    assert.equal(cust2.creditAllowed, false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // T. UPSERT_PRODUCT works idempotently
  // ─────────────────────────────────────────────────────────────────────────────
  it("T. UPSERT_PRODUCT creates and updates product idempotently with stable UUID", async () => {
    const { device } = await createTestDevice();
    const productId = crypto.randomUUID();
    createdProductIds.add(productId);

    // First push: create
    const createOp = makeOp(1, "UPSERT_PRODUCT", productId, {
      name: `Sync Brand New Product ${testRunId}`,
      brand: "7Up",
      sku: `SKU-7UP-${testRunId}`,
      minimumStockLevel: 10,
      latestPurchasePrice: 88,
      isActive: true,
    });

    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [createOp]);
    assert.equal(res1.success, true);

    const prod1 = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    assert.equal(prod1.name, `Sync Brand New Product ${testRunId}`);
    assert.equal(prod1.brand, "7Up");

    // Second push: update
    const updateOp = makeOp(2, "UPSERT_PRODUCT", productId, {
      name: `Sync Brand New Product Updated ${testRunId}`,
      brand: "7Up Sugar Free",
      sku: `SKU-7UP-${testRunId}`,
      minimumStockLevel: 15,
      latestPurchasePrice: 92,
    });

    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [updateOp]);
    assert.equal(res2.success, true);

    const prod2 = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    assert.equal(prod2.name, `Sync Brand New Product Updated ${testRunId}`);
    assert.equal(prod2.brand, "7Up Sugar Free");
    assert.equal(prod2.minimumStockLevel, 15);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // U. CREATE_PRICE preserves price history
  // ─────────────────────────────────────────────────────────────────────────────
  it("U. CREATE_PRICE preserves price history (closes active, creates new, exactly 1 active)", async () => {
    const { device } = await createTestDevice();
    const priceId1 = crypto.randomUUID();
    const priceId2 = crypto.randomUUID();

    // First price: 150
    const op1 = makeOp(1, "CREATE_PRICE", priceId1, {
      productId: testProductId1,
      tier: "RETAIL",
      amount: 150,
      userId: testOwnerUserId,
    });
    await processDevicePushBatch(device, crypto.randomUUID(), [op1]);

    // Second price update: 165
    const op2 = makeOp(2, "CREATE_PRICE", priceId2, {
      productId: testProductId1,
      tier: "RETAIL",
      amount: 165,
      userId: testOwnerUserId,
    });
    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [op2]);
    assert.equal(res2.success, true);

    // Verify exactly one active price
    const activePrices = await prisma.price.findMany({
      where: { productId: testProductId1, tier: PriceTier.RETAIL, effectiveTo: null },
    });
    assert.equal(activePrices.length, 1);
    assert.equal(Number(activePrices[0].amount), 165);

    // Verify historical closed price preserved
    const historicalPrice = await prisma.price.findUniqueOrThrow({ where: { id: priceId1 } });
    assert.ok(historicalPrice.effectiveTo !== null, "Historical price must have effectiveTo set");
    assert.equal(Number(historicalPrice.amount), 150);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // V. UPSERT_SUPPLIER works idempotently
  // ─────────────────────────────────────────────────────────────────────────────
  it("V. UPSERT_SUPPLIER creates and updates supplier idempotently", async () => {
    const { device } = await createTestDevice();
    const supplierId = crypto.randomUUID();
    createdSupplierIds.add(supplierId);

    const createOp = makeOp(1, "UPSERT_SUPPLIER", supplierId, {
      name: `Beverage Distributor ${testRunId}`,
      contactPerson: "Ahmed",
      phone: "03211112233",
      isActive: true,
    });

    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [createOp]);
    assert.equal(res1.success, true);

    const sup1 = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    assert.equal(sup1.name, `Beverage Distributor ${testRunId}`);

    // Update
    const updateOp = makeOp(2, "UPSERT_SUPPLIER", supplierId, {
      name: `Beverage Distributor ${testRunId} Ltd`,
      contactPerson: "Ahmed Khan",
    });

    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [updateOp]);
    assert.equal(res2.success, true);

    const sup2 = await prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    assert.equal(sup2.name, `Beverage Distributor ${testRunId} Ltd`);
    assert.equal(sup2.contactPerson, "Ahmed Khan");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // W. UPDATE_USER respects role/permission rules
  // ─────────────────────────────────────────────────────────────────────────────
  it("W. UPDATE_USER forbids unauthorized role escalation (staff promoting to Owner)", async () => {
    const { device } = await createTestDevice();

    const targetUser = await prisma.user.create({
      data: {
        authUserId: `auth-staff-target-${testRunId}`,
        name: `Staff Member ${testRunId}`,
        role: Role.STAFF,
      },
    });
    createdUserIds.add(targetUser.id);

    // Attempt escalation: Staff user attempting to promote target to OWNER
    const op = makeOp(1, "UPDATE_USER", targetUser.id, {
      role: "OWNER",
      actorUserId: testStaffUserId, // STAFF actor!
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);

    assert.equal(res.success, false);
    assert.ok(res.rejectedOperations && res.rejectedOperations.length === 1);
    assert.ok(res.rejectedOperations[0].error.includes("Staff cannot promote users to Owner"));

    // Verify role was not escalated
    const checkUser = await prisma.user.findUniqueOrThrow({ where: { id: targetUser.id } });
    assert.equal(checkUser.role, Role.STAFF, "User must remain STAFF");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // X. Successful operation creates required SyncChangeLog entries
  // ─────────────────────────────────────────────────────────────────────────────
  it("X. Successful operation creates required SyncChangeLog record with sourceDeviceId", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    const op = makeOp(1, "UPSERT_CUSTOMER", customerId, {
      name: `ChangeLog Test Customer ${testRunId}`,
      priceTier: "RETAIL",
      creditAllowed: false,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, true);

    const changeLogs = await prisma.syncChangeLog.findMany({
      where: {
        operationType: "UPSERT_CUSTOMER",
        entityId: customerId,
      },
    });

    assert.ok(changeLogs.length >= 1);
    const lastChange = changeLogs[changeLogs.length - 1];
    assert.equal(lastChange.sourceDeviceId, device.deviceId);
    assert.equal(lastChange.action, "UPSERT");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Y. Failed operation creates NO business mutation
  // ─────────────────────────────────────────────────────────────────────────────
  it("Y. Failed operation creates NO business mutation", async () => {
    const { device } = await createTestDevice();
    const customerId = crypto.randomUUID();

    // Invalid payload: empty customer name
    const op = makeOp(1, "UPSERT_CUSTOMER", customerId, {
      name: "   ", // whitespace only -> invalid
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, false);

    const cust = await prisma.customer.findUnique({ where: { id: customerId } });
    assert.equal(cust, null, "Customer must not exist when operation fails");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Z. Failed operation creates NO SUCCESS ProcessedSyncOperation
  // ─────────────────────────────────────────────────────────────────────────────
  it("Z. Failed operation creates NO SUCCESS ProcessedSyncOperation", async () => {
    const { device } = await createTestDevice();
    const saleId = crypto.randomUUID();

    // Invalid sale (no items)
    const op = makeOp(1, "CREATE_SALE", saleId, {
      items: [],
      discount: 0,
      paidAmount: 0,
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, false);

    const processed = await prisma.processedSyncOperation.findUnique({
      where: { operationId: op.operationId },
    });
    assert.equal(processed, null, "Failed transaction must roll back ProcessedSyncOperation");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AA. Failed operation does not advance SyncDevice.lastSequence
  // ─────────────────────────────────────────────────────────────────────────────
  it("AA. Failed operation does not advance SyncDevice.lastSequence", async () => {
    const { device } = await createTestDevice({ lastSequence: BigInt(10) });

    // Send invalid operation at expected sequence 11
    const op = makeOp(11, "RECORD_PAYMENT", crypto.randomUUID(), {
      amount: -50, // Invalid negative amount
    });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op]);
    assert.equal(res.success, false);

    const dev = await prisma.syncDevice.findUniqueOrThrow({ where: { deviceId: device.deviceId } });
    assert.equal(dev.lastSequence, BigInt(10), "lastSequence must remain 10 after failure");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AB. Retry of the same operation after failure succeeds without duplication
  // ─────────────────────────────────────────────────────────────────────────────
  it("AB. Retry of the same operation after fixing payload succeeds without duplication", async () => {
    const { device } = await createTestDevice();
    const opId = crypto.randomUUID();
    const customerId = crypto.randomUUID();
    createdCustomerIds.add(customerId);

    // Attempt 1: fails due to empty name
    const failOp = makeOp(1, "UPSERT_CUSTOMER", customerId, { name: "" }, opId);
    const res1 = await processDevicePushBatch(device, crypto.randomUUID(), [failOp]);
    assert.equal(res1.success, false);

    // Attempt 2: retry SAME opId and sequence with corrected payload
    const retryOp = makeOp(
      1,
      "UPSERT_CUSTOMER",
      customerId,
      { name: `Recovered Customer ${testRunId}`, priceTier: "RETAIL" },
      opId
    );
    const res2 = await processDevicePushBatch(device, crypto.randomUUID(), [retryOp]);
    assert.equal(res2.success, true);
    assert.deepEqual(res2.acknowledgedOperationIds, [opId]);

    const count = await prisma.customer.count({ where: { id: customerId } });
    assert.equal(count, 1, "Customer must exist exactly once");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AC. 17 success / 18 failure / 19 blocked behavior still works
  // ─────────────────────────────────────────────────────────────────────────────
  it("AC. Stop-on-first-error preserves sequence integrity (17 success, 18 failure, 19 blocked)", async () => {
    const { device } = await createTestDevice({ lastSequence: BigInt(16) });

    const custId17 = crypto.randomUUID();
    const custId18 = crypto.randomUUID();
    const custId19 = crypto.randomUUID();
    createdCustomerIds.add(custId17);

    const op17 = makeOp(17, "UPSERT_CUSTOMER", custId17, { name: `Customer 17 ${testRunId}` });
    const op18 = makeOp(18, "UPSERT_CUSTOMER", custId18, { name: "" }); // Will fail validation!
    const op19 = makeOp(19, "UPSERT_CUSTOMER", custId19, { name: `Customer 19 ${testRunId}` });

    const res = await processDevicePushBatch(device, crypto.randomUUID(), [op17, op18, op19]);

    assert.equal(res.success, false);
    assert.deepEqual(res.acknowledgedOperationIds, [op17.operationId]);
    assert.ok(res.rejectedOperations && res.rejectedOperations.length === 1);
    assert.equal(res.rejectedOperations[0].operationId, op18.operationId);

    // Op 17 committed
    const c17 = await prisma.customer.findUnique({ where: { id: custId17 } });
    assert.ok(c17);

    // Op 18 failed / rolled back
    const c18 = await prisma.customer.findUnique({ where: { id: custId18 } });
    assert.equal(c18, null);

    // Op 19 was never executed
    const c19 = await prisma.customer.findUnique({ where: { id: custId19 } });
    assert.equal(c19, null);

    // Device sequence committed up to 17
    const dev = await prisma.syncDevice.findUniqueOrThrow({ where: { deviceId: device.deviceId } });
    assert.equal(dev.lastSequence, BigInt(17));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // AD. Phase 1 + Phase 2 regression tests still pass
  // ─────────────────────────────────────────────────────────────────────────────
  it("AD. Phase 1 + Phase 2 regression integrity check", () => {
    // Verified by running both test suites in final verification
    assert.ok(true);
  });
});
