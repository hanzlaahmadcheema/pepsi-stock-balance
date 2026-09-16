/**
 * Phase 3 Final Review — Sync Change Identity Verification Test Suite
 *
 * Verifies:
 *   A. Successful pushed operation creates SyncChangeLog with the same operationId.
 *   B. Retrying the same operationId does not create another SyncChangeLog event (idempotency).
 *   C. Different operations on the same entity have distinct operationIds.
 *   D. changeSequence remains the ordering cursor and is not treated as operation identity.
 *   E. Other business operations (Payment, Receiving, Stock) populate operationId in SyncChangeLog.
 *
 * Run: npx tsx --test src/lib/sync/sync-change-identity.test.ts
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  Role,
  PriceTier,
  MovementType,
  Prisma,
} from "@prisma/client";
import { prisma } from "../prisma";
import { hashToken } from "./server/authentication";
import { processDevicePushBatch } from "./server/push";
import type { SyncOperation } from "./types";

describe("Phase 3 Sync Change Identity Tests", () => {
  const testRunId = crypto.randomUUID().slice(0, 8);

  const createdDeviceIds = new Set<string>();
  const createdUserIds = new Set<string>();
  const createdProductIds = new Set<string>();
  const createdCustomerIds = new Set<string>();
  const createdSupplierIds = new Set<string>();
  const createdSaleIds = new Set<string>();
  const createdReceivingIds = new Set<string>();
  const createdPaymentIds = new Set<string>();
  const createdStockClosingIds = new Set<string>();

  let testUserId: string;
  let testCustomerId: string;
  let testProductId: string;
  let testSupplierId: string;

  async function createTestDevice(deviceId?: string) {
    const devId = deviceId || `dev-id-${testRunId}-${crypto.randomUUID().slice(0, 8)}`;
    const rawToken = `tok-${crypto.randomBytes(16).toString("hex")}`;
    const tokenHash = hashToken(rawToken);

    const device = await prisma.syncDevice.create({
      data: {
        deviceId: devId,
        name: `Change Identity Test Device ${devId}`,
        tokenHash,
        lastSequence: BigInt(0),
      },
    });

    createdDeviceIds.add(devId);
    return device;
  }

  before(async () => {
    // 1. Create a test owner user
    const user = await prisma.user.create({
      data: {
        authUserId: `auth-id-${testRunId}`,
        name: `User Identity ${testRunId}`,
        role: Role.OWNER,
        isActive: true,
      },
    });
    testUserId = user.id;
    createdUserIds.add(testUserId);

    // 2. Create a test customer
    const customer = await prisma.customer.create({
      data: {
        name: `Customer Identity ${testRunId}`,
        priceTier: PriceTier.RETAIL,
        creditAllowed: true,
      },
    });
    testCustomerId = customer.id;
    createdCustomerIds.add(testCustomerId);

    // 3. Create a test product with initial stock
    const product = await prisma.product.create({
      data: {
        name: `Product Identity ${testRunId}`,
        sku: `SKU-ID-${testRunId}`,
        brand: "Pepsi",
        minimumStockLevel: 5,
        latestPurchasePrice: new Prisma.Decimal("100.00"),
        isActive: true,
        prices: {
          create: {
            tier: PriceTier.RETAIL,
            amount: new Prisma.Decimal("150.00"),
            createdById: testUserId,
          },
        },
      },
    });
    testProductId = product.id;
    createdProductIds.add(testProductId);

    // Seed stock movement: 100 crates
    await prisma.stockMovement.create({
      data: {
        productId: testProductId,
        movementType: MovementType.RECEIVING,
        quantity: 100,
        referenceType: "InitialSeed",
        referenceId: crypto.randomUUID(),
        createdById: testUserId,
      },
    });

    // 4. Create a test supplier
    const supplier = await prisma.supplier.create({
      data: {
        name: `Supplier Identity ${testRunId}`,
      },
    });
    testSupplierId = supplier.id;
    createdSupplierIds.add(testSupplierId);
  });

  after(async () => {
    // Clean up created entities in reverse dependency order
    for (const devId of createdDeviceIds) {
      await prisma.processedSyncOperation.deleteMany({ where: { deviceId: devId } });
    }
    for (const devId of createdDeviceIds) {
      await prisma.syncChangeLog.deleteMany({ where: { sourceDeviceId: devId } });
    }
    if (createdStockClosingIds.size > 0) {
      await prisma.stockCount.deleteMany({
        where: { closingId: { in: Array.from(createdStockClosingIds) } },
      });
      await prisma.dailyClosing.deleteMany({
        where: { id: { in: Array.from(createdStockClosingIds) } },
      });
    }
    for (const paymentId of createdPaymentIds) {
      await prisma.auditLog.deleteMany({ where: { entityId: paymentId } });
      await prisma.payment.deleteMany({ where: { id: paymentId } });
    }
    for (const receivingId of createdReceivingIds) {
      await prisma.auditLog.deleteMany({ where: { entityId: receivingId } });
      await prisma.receivingItem.deleteMany({ where: { receivingId } });
      await prisma.receiving.deleteMany({ where: { id: receivingId } });
    }
    for (const saleId of createdSaleIds) {
      await prisma.auditLog.deleteMany({ where: { entityId: saleId } });
      await prisma.saleItem.deleteMany({ where: { saleId } });
      await prisma.sale.deleteMany({ where: { id: saleId } });
    }
    for (const prodId of createdProductIds) {
      await prisma.stockMovement.deleteMany({ where: { productId: prodId } });
      await prisma.price.deleteMany({ where: { productId: prodId } });
      await prisma.product.deleteMany({ where: { id: prodId } });
    }
    for (const suppId of createdSupplierIds) {
      await prisma.supplier.deleteMany({ where: { id: suppId } });
    }
    if (createdCustomerIds.size > 0) {
      await prisma.payment.deleteMany({
        where: { customerId: { in: Array.from(createdCustomerIds) } },
      });
      await prisma.customer.deleteMany({
        where: { id: { in: Array.from(createdCustomerIds) } },
      });
    }
    for (const devId of createdDeviceIds) {
      await prisma.syncDevice.deleteMany({ where: { deviceId: devId } });
    }
    for (const uId of createdUserIds) {
      await prisma.auditLog.deleteMany({ where: { userId: uId } });
      await prisma.user.deleteMany({ where: { id: uId } });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Requirement A: Successful pushed operation creates SyncChangeLog with operationId
  // ───────────────────────────────────────────────────────────────────────────
  it("A: Successful pushed operation creates SyncChangeLog with the same operationId", async () => {
    const device = await createTestDevice();
    const operationId = crypto.randomUUID();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    const operation: SyncOperation = {
      operationId,
      clientSequence: "1",
      operationType: "CREATE_SALE",
      entityId: saleId,
      payload: {
        customerId: testCustomerId,
        saleType: "RETAIL",
        paymentMethod: "CASH",
        paidAmount: 300,
        subtotal: 300,
        totalAmount: 300,
        userId: testUserId,
        items: [
          {
            productId: testProductId,
            quantity: 2,
            unitPrice: 150,
            subtotal: 300,
          },
        ],
      },
      clientCreatedAt: new Date().toISOString(),
    };

    const batchResponse = await processDevicePushBatch(
      device,
      crypto.randomUUID(),
      [operation]
    );

    // Verify batch acknowledged the operation
    assert.deepEqual(batchResponse.acknowledgedOperationIds, [operationId]);
    assert.equal(batchResponse.success, true);
    assert.equal(batchResponse.rejectedOperations, undefined);

    // Verify ProcessedSyncOperation row was created atomically
    const processed = await prisma.processedSyncOperation.findUnique({
      where: { operationId },
    });
    assert.ok(processed, "ProcessedSyncOperation must exist");
    assert.equal(processed.status, "SUCCESS");
    assert.equal(processed.deviceId, device.deviceId);
    assert.equal(processed.clientSequence, BigInt(1));

    // Verify SyncChangeLog row was created with the EXACT SAME operationId
    const changeLog = await prisma.syncChangeLog.findUnique({
      where: { operationId },
    });
    assert.ok(changeLog, "SyncChangeLog must exist for the operationId");
    assert.equal(changeLog.operationId, operationId);
    assert.equal(changeLog.operationType, "CREATE_SALE");
    assert.equal(changeLog.entityId, saleId);
    assert.equal(changeLog.action, "UPSERT");
    assert.equal(changeLog.sourceDeviceId, device.deviceId);
    assert.ok(changeLog.changeSequence > BigInt(0), "changeSequence must be positive");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Requirement B: Retrying the same operationId does not create another SyncChangeLog event
  // ───────────────────────────────────────────────────────────────────────────
  it("B: Retrying the same operationId does not create another SyncChangeLog event", async () => {
    const device = await createTestDevice();
    const operationId = crypto.randomUUID();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    const operation: SyncOperation = {
      operationId,
      clientSequence: "1",
      operationType: "CREATE_SALE",
      entityId: saleId,
      payload: {
        customerId: testCustomerId,
        saleType: "RETAIL",
        paymentMethod: "CASH",
        paidAmount: 150,
        subtotal: 150,
        totalAmount: 150,
        userId: testUserId,
        items: [
          {
            productId: testProductId,
            quantity: 1,
            unitPrice: 150,
            subtotal: 150,
          },
        ],
      },
      clientCreatedAt: new Date().toISOString(),
    };

    // First push attempt
    const response1 = await processDevicePushBatch(
      device,
      crypto.randomUUID(),
      [operation]
    );
    assert.deepEqual(response1.acknowledgedOperationIds, [operationId]);

    // Count SyncChangeLog records for this operationId
    const countAfterFirstPush = await prisma.syncChangeLog.count({
      where: { operationId },
    });
    assert.equal(countAfterFirstPush, 1, "Must have exactly 1 SyncChangeLog row after first push");

    const changeAfterFirstPush = await prisma.syncChangeLog.findUnique({
      where: { operationId },
    });
    const originalSequence = changeAfterFirstPush?.changeSequence;

    // Retry the SAME operation (idempotent replay)
    const response2 = await processDevicePushBatch(
      device,
      crypto.randomUUID(),
      [operation]
    );

    // Response must acknowledge the replayed operation without error
    assert.deepEqual(response2.acknowledgedOperationIds, [operationId]);
    assert.equal(response2.success, true);
    assert.equal(response2.rejectedOperations, undefined);

    // Count SyncChangeLog records for this operationId — must remain strictly 1
    const countAfterRetry = await prisma.syncChangeLog.count({
      where: { operationId },
    });
    assert.equal(countAfterRetry, 1, "Must still have exactly 1 SyncChangeLog row after replay");

    // Sequence must not have changed
    const changeAfterRetry = await prisma.syncChangeLog.findUnique({
      where: { operationId },
    });
    assert.equal(changeAfterRetry?.changeSequence, originalSequence);

    // Verify ProcessedSyncOperation count is also strictly 1
    const processedCount = await prisma.processedSyncOperation.count({
      where: { operationId },
    });
    assert.equal(processedCount, 1, "ProcessedSyncOperation count must remain 1");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Requirement C: Different operations on the same entity have distinct operationIds
  // ───────────────────────────────────────────────────────────────────────────
  it("C: Different operations on the same entity have distinct operationIds", async () => {
    const device = await createTestDevice();
    const op1Id = crypto.randomUUID();
    const op2Id = crypto.randomUUID();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    // Op 1: CREATE_SALE
    const createOp: SyncOperation = {
      operationId: op1Id,
      clientSequence: "1",
      operationType: "CREATE_SALE",
      entityId: saleId,
      payload: {
        customerId: testCustomerId,
        saleType: "RETAIL",
        paymentMethod: "CASH",
        paidAmount: 150,
        subtotal: 150,
        totalAmount: 150,
        userId: testUserId,
        items: [
          {
            productId: testProductId,
            quantity: 1,
            unitPrice: 150,
            subtotal: 150,
          },
        ],
      },
      clientCreatedAt: new Date().toISOString(),
    };

    // Op 2: EDIT_SALE on the same saleId
    const editOp: SyncOperation = {
      operationId: op2Id,
      clientSequence: "2",
      operationType: "EDIT_SALE",
      entityId: saleId,
      payload: {
        customerId: testCustomerId,
        saleType: "RETAIL",
        discount: 10,
        reason: "Preferred customer discount applied",
        actorUserId: testUserId,
        items: [
          {
            productId: testProductId,
            quantity: 1,
            unitPrice: 150,
            subtotal: 150,
          },
        ],
      },
      clientCreatedAt: new Date().toISOString(),
    };

    const batchResponse = await processDevicePushBatch(
      device,
      crypto.randomUUID(),
      [createOp, editOp]
    );

    assert.deepEqual(batchResponse.acknowledgedOperationIds, [op1Id, op2Id]);
    assert.equal(batchResponse.success, true);
    assert.equal(batchResponse.rejectedOperations, undefined);

    // Fetch all change logs for this sale entity
    const changeLogs = await prisma.syncChangeLog.findMany({
      where: { entityId: saleId },
      orderBy: { changeSequence: "asc" },
    });

    assert.equal(changeLogs.length, 2, "There must be 2 distinct SyncChangeLog entries for the entity");

    // Verify first change log
    assert.equal(changeLogs[0].operationId, op1Id);
    assert.equal(changeLogs[0].operationType, "CREATE_SALE");
    assert.equal(changeLogs[0].entityId, saleId);

    // Verify second change log
    assert.equal(changeLogs[1].operationId, op2Id);
    assert.equal(changeLogs[1].operationType, "EDIT_SALE");
    assert.equal(changeLogs[1].entityId, saleId);

    // Verify operationIds are distinct
    assert.notEqual(changeLogs[0].operationId, changeLogs[1].operationId);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Requirement D: changeSequence remains the ordering cursor and is not treated as operation identity
  // ───────────────────────────────────────────────────────────────────────────
  it("D: changeSequence remains the ordering cursor and is not treated as operation identity", async () => {
    const device = await createTestDevice();
    const op1Id = crypto.randomUUID();
    const op2Id = crypto.randomUUID();
    const op3Id = crypto.randomUUID();
    const saleId = crypto.randomUUID();
    createdSaleIds.add(saleId);

    // Op 1: CREATE_SALE
    const createOp: SyncOperation = {
      operationId: op1Id,
      clientSequence: "1",
      operationType: "CREATE_SALE",
      entityId: saleId,
      payload: {
        customerId: testCustomerId,
        saleType: "RETAIL",
        paymentMethod: "CASH",
        paidAmount: 150,
        subtotal: 150,
        totalAmount: 150,
        userId: testUserId,
        items: [
          {
            productId: testProductId,
            quantity: 1,
            unitPrice: 150,
            subtotal: 150,
          },
        ],
      },
      clientCreatedAt: new Date().toISOString(),
    };

    // Op 2: EDIT_SALE
    const editOp: SyncOperation = {
      operationId: op2Id,
      clientSequence: "2",
      operationType: "EDIT_SALE",
      entityId: saleId,
      payload: {
        customerId: testCustomerId,
        saleType: "RETAIL",
        discount: 20,
        reason: "Manager discount",
        actorUserId: testUserId,
        items: [
          {
            productId: testProductId,
            quantity: 1,
            unitPrice: 150,
            subtotal: 150,
          },
        ],
      },
      clientCreatedAt: new Date().toISOString(),
    };

    // Op 3: CANCEL_SALE
    const cancelOp: SyncOperation = {
      operationId: op3Id,
      clientSequence: "3",
      operationType: "CANCEL_SALE",
      entityId: saleId,
      payload: {
        reason: "Customer changed mind before pickup",
        actorUserId: testUserId,
      },
      clientCreatedAt: new Date().toISOString(),
    };

    const batchResponse = await processDevicePushBatch(
      device,
      crypto.randomUUID(),
      [createOp, editOp, cancelOp]
    );

    assert.equal(batchResponse.success, true);
    assert.equal(batchResponse.rejectedOperations, undefined);
    assert.deepEqual(batchResponse.acknowledgedOperationIds, [op1Id, op2Id, op3Id]);

    const changes = await prisma.syncChangeLog.findMany({
      where: { entityId: saleId },
      orderBy: { changeSequence: "asc" },
    });

    assert.equal(changes.length, 3);

    // 1. changeSequence is strictly monotonic: seq1 < seq2 < seq3
    const seq1 = changes[0].changeSequence;
    const seq2 = changes[1].changeSequence;
    const seq3 = changes[2].changeSequence;

    assert.ok(seq1 < seq2, `Sequence 1 (${seq1}) must be strictly less than Sequence 2 (${seq2})`);
    assert.ok(seq2 < seq3, `Sequence 2 (${seq2}) must be strictly less than Sequence 3 (${seq3})`);

    // 2. operationId is the immutable identity (UUID)
    assert.equal(changes[0].operationId, op1Id);
    assert.equal(changes[1].operationId, op2Id);
    assert.equal(changes[2].operationId, op3Id);

    // 3. Each operationId uniquely finds exactly one record in SyncChangeLog
    const found1 = await prisma.syncChangeLog.findUnique({ where: { operationId: op1Id } });
    const found2 = await prisma.syncChangeLog.findUnique({ where: { operationId: op2Id } });
    const found3 = await prisma.syncChangeLog.findUnique({ where: { operationId: op3Id } });

    assert.equal(found1?.entityId, saleId);
    assert.equal(found2?.entityId, saleId);
    assert.equal(found3?.entityId, saleId);

    // 4. changeSequence can be used as a high-water mark cursor: querying > seq1 returns records 2 and 3
    const cursorQuery = await prisma.syncChangeLog.findMany({
      where: {
        entityId: saleId,
        changeSequence: { gt: seq1 },
      },
      orderBy: { changeSequence: "asc" },
    });

    assert.equal(cursorQuery.length, 2);
    assert.equal(cursorQuery[0].operationId, op2Id);
    assert.equal(cursorQuery[1].operationId, op3Id);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Requirement E: Other domain operations populate operationId in SyncChangeLog
  // ───────────────────────────────────────────────────────────────────────────
  it("E: Domain operations (RECORD_PAYMENT, POST_RECEIVING, SUBMIT_STOCK_COUNT) write operationId", async () => {
    const device = await createTestDevice();

    // 1. RECORD_PAYMENT
    const paymentOpId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    createdPaymentIds.add(paymentId);

    const paymentOp: SyncOperation = {
      operationId: paymentOpId,
      clientSequence: "1",
      operationType: "RECORD_PAYMENT",
      entityId: paymentId,
      payload: {
        customerId: testCustomerId,
        amount: 250,
        paymentMethod: "EASYPAISA",
        referenceNumber: `REF-${testRunId}-01`,
        userId: testUserId,
      },
      clientCreatedAt: new Date().toISOString(),
    };

    // 2. POST_RECEIVING
    const receivingOpId = crypto.randomUUID();
    const receivingId = crypto.randomUUID();
    createdReceivingIds.add(receivingId);

    const receivingOp: SyncOperation = {
      operationId: receivingOpId,
      clientSequence: "2",
      operationType: "POST_RECEIVING",
      entityId: receivingId,
      payload: {
        supplierId: testSupplierId,
        referenceNumber: `RCV-${testRunId}-01`,
        items: [
          {
            productId: testProductId,
            quantity: 50,
            purchasePrice: 100,
          },
        ],
        actorUserId: testUserId,
      },
      clientCreatedAt: new Date().toISOString(),
    };

    // 3. SUBMIT_STOCK_COUNT
    const stockOpId = crypto.randomUUID();
    const closingId = crypto.randomUUID();
    createdStockClosingIds.add(closingId);

    const stockOp: SyncOperation = {
      operationId: stockOpId,
      clientSequence: "3",
      operationType: "SUBMIT_STOCK_COUNT",
      entityId: closingId,
      payload: {
        businessDate: new Date().toISOString().split("T")[0],
        counts: [
          {
            productId: testProductId,
            physicalQuantity: 150,
          },
        ],
        actorUserId: testUserId,
      },
      clientCreatedAt: new Date().toISOString(),
    };

    const batchResponse = await processDevicePushBatch(
      device,
      crypto.randomUUID(),
      [paymentOp, receivingOp, stockOp]
    );

    assert.equal(batchResponse.success, true);
    assert.equal(batchResponse.rejectedOperations, undefined);
    assert.deepEqual(batchResponse.acknowledgedOperationIds, [
      paymentOpId,
      receivingOpId,
      stockOpId,
    ]);

    // Verify all 3 wrote their respective operationId into SyncChangeLog
    const paymentChange = await prisma.syncChangeLog.findUnique({
      where: { operationId: paymentOpId },
    });
    assert.ok(paymentChange, "Payment change log must exist");
    assert.equal(paymentChange.operationType, "RECORD_PAYMENT");
    assert.equal(paymentChange.entityId, paymentId);
    assert.equal(paymentChange.sourceDeviceId, device.deviceId);

    const receivingChange = await prisma.syncChangeLog.findUnique({
      where: { operationId: receivingOpId },
    });
    assert.ok(receivingChange, "Receiving change log must exist");
    assert.equal(receivingChange.operationType, "POST_RECEIVING");
    assert.equal(receivingChange.entityId, receivingId);
    assert.equal(receivingChange.sourceDeviceId, device.deviceId);

    const stockChange = await prisma.syncChangeLog.findUnique({
      where: { operationId: stockOpId },
    });
    assert.ok(stockChange, "Stock count change log must exist");
    assert.equal(stockChange.operationType, "SUBMIT_STOCK_COUNT");
    assert.equal(stockChange.entityId, closingId);
  });
});
