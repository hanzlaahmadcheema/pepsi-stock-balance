import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../prisma";
import { calculateFifoCostForSaleItem, recalculateAllSalesFifo } from "./fifo";
import { MovementType, SaleStatus, SaleType } from "@prisma/client";

describe("FIFO Inventory Acquisition Costing Engine", () => {
  let testUserId: string;
  let testSupplierId: string;

  beforeEach(async () => {
    // Ensure a test user exists
    const user = await prisma.user.upsert({
      where: { id: "00000000-0000-0000-0000-000000000001" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000001",
        authUserId: "00000000-0000-0000-0000-000000000001",
        name: "Test Admin",
        role: "OWNER",
        isActive: true,
      },
    });
    testUserId = user.id;

    // Ensure a test supplier exists
    const supplier = await prisma.supplier.upsert({
      where: { id: "00000000-0000-0000-0000-000000000002" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000002",
        name: "Test Beverages Co",
        isActive: true,
      },
    });
    testSupplierId = supplier.id;
  });

  it("1. Falls back to product.latestPurchasePrice when no receiving batches exist", async () => {
    const product = await prisma.product.create({
      data: {
        name: "FIFO Baseline Product",
        brand: "Pepsi",
        sku: `SKU-FIFO-0-${Date.now()}`,
        latestPurchasePrice: 180,
      },
    });

    const result = await calculateFifoCostForSaleItem(prisma, product.id, 3);
    assert.equal(result.unitCost, 180);
    assert.equal(result.totalCost, 540);
    assert.equal(result.consumedBatches.length, 0);

    await prisma.product.delete({ where: { id: product.id } });
  });

  it("2. Exact user scenario: 1 unit @ 190, 1 unit @ 200, sold 2 units -> profit 30", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Product A",
        brand: "Pepsi",
        sku: `SKU-USER-SCENARIO-${Date.now()}`,
        latestPurchasePrice: 200,
      },
    });

    const retailPrice = 210;

    // Receiving 1: Cost 190, Qty 1 (older)
    const rec1 = await prisma.receiving.create({
      data: {
        supplierId: testSupplierId,
        receivedAt: new Date("2026-09-01T10:00:00Z"),
        createdById: testUserId,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            purchasePrice: 190,
            totalCost: 190,
          },
        },
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        movementType: MovementType.RECEIVING,
        quantity: 1,
        referenceType: "Receiving",
        referenceId: rec1.id,
        createdById: testUserId,
      },
    });

    // Receiving 2: Cost 200, Qty 1 (newer)
    const rec2 = await prisma.receiving.create({
      data: {
        supplierId: testSupplierId,
        receivedAt: new Date("2026-09-02T10:00:00Z"),
        createdById: testUserId,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            purchasePrice: 200,
            totalCost: 200,
          },
        },
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        movementType: MovementType.RECEIVING,
        quantity: 1,
        referenceType: "Receiving",
        referenceId: rec2.id,
        createdById: testUserId,
      },
    });

    // Sale: Qty 2
    const fifoResult = await calculateFifoCostForSaleItem(prisma, product.id, 2);

    // Total Cost should be 190 + 200 = 390
    assert.equal(fifoResult.totalCost, 390);
    // Unit Cost should be 390 / 2 = 195
    assert.equal(fifoResult.unitCost, 195);
    assert.equal(fifoResult.consumedBatches.length, 2);
    assert.equal(fifoResult.consumedBatches[0].unitPurchasePrice, 190);
    assert.equal(fifoResult.consumedBatches[0].quantityTaken, 1);
    assert.equal(fifoResult.consumedBatches[1].unitPurchasePrice, 200);
    assert.equal(fifoResult.consumedBatches[1].quantityTaken, 1);

    // Total Revenue = 2 * 210 = 420
    const totalRevenue = 2 * retailPrice;
    const profitGained = totalRevenue - fifoResult.totalCost;
    // Profit Should Gain: 30 (NOT 20)!
    assert.equal(profitGained, 30);

    // Clean up
    await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
    await prisma.receivingItem.deleteMany({ where: { productId: product.id } });
    await prisma.receiving.deleteMany({ where: { id: { in: [rec1.id, rec2.id] } } });
    await prisma.product.delete({ where: { id: product.id } });
  });

  it("3. Consumes batches sequentially across multiple sales in chronological order", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Sequential Test Product",
        brand: "Pepsi",
        sku: `SKU-SEQ-${Date.now()}`,
        latestPurchasePrice: 170,
      },
    });

    // Batch 1: 10 @ 140
    const rec1 = await prisma.receiving.create({
      data: {
        supplierId: testSupplierId,
        receivedAt: new Date("2026-09-01T08:00:00Z"),
        createdById: testUserId,
        items: {
          create: {
            productId: product.id,
            quantity: 10,
            purchasePrice: 140,
            totalCost: 1400,
          },
        },
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        movementType: MovementType.RECEIVING,
        quantity: 10,
        referenceType: "Receiving",
        referenceId: rec1.id,
        createdById: testUserId,
      },
    });

    // Batch 2: 10 @ 160
    const rec2 = await prisma.receiving.create({
      data: {
        supplierId: testSupplierId,
        receivedAt: new Date("2026-09-02T08:00:00Z"),
        createdById: testUserId,
        items: {
          create: {
            productId: product.id,
            quantity: 10,
            purchasePrice: 160,
            totalCost: 1600,
          },
        },
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        movementType: MovementType.RECEIVING,
        quantity: 10,
        referenceType: "Receiving",
        referenceId: rec2.id,
        createdById: testUserId,
      },
    });

    // Sale 1: Sells 7 units (should take 7 @ 140)
    const sale1 = await prisma.sale.create({
      data: {
        invoiceNumber: `INV-SEQ-1-${Date.now()}`,
        saleType: SaleType.RETAIL,
        status: SaleStatus.COMPLETED,
        subtotal: 1400,
        discount: 0,
        totalAmount: 1400,
        paidAmount: 1400,
        creditAmount: 0,
        soldAt: new Date("2026-09-03T10:00:00Z"),
        createdById: testUserId,
        items: {
          create: {
            productId: product.id,
            quantity: 7,
            unitPrice: 200,
            totalAmount: 1400,
            purchaseCostAtSale: 140,
          },
        },
      },
    });

    // Sale 2: Sells 5 units (should take remaining 3 @ 140 and 2 @ 160)
    // Cost = (3 * 140) + (2 * 160) = 420 + 320 = 740. Unit cost = 740 / 5 = 148.
    const fifoResultSale2 = await calculateFifoCostForSaleItem(prisma, product.id, 5);
    assert.equal(fifoResultSale2.totalCost, 740);
    assert.equal(fifoResultSale2.unitCost, 148);
    assert.equal(fifoResultSale2.consumedBatches.length, 2);
    assert.equal(fifoResultSale2.consumedBatches[0].quantityTaken, 3);
    assert.equal(fifoResultSale2.consumedBatches[0].unitPurchasePrice, 140);
    assert.equal(fifoResultSale2.consumedBatches[1].quantityTaken, 2);
    assert.equal(fifoResultSale2.consumedBatches[1].unitPurchasePrice, 160);

    // Clean up
    await prisma.saleItem.deleteMany({ where: { saleId: sale1.id } });
    await prisma.sale.delete({ where: { id: sale1.id } });
    await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
    await prisma.receivingItem.deleteMany({ where: { productId: product.id } });
    await prisma.receiving.deleteMany({ where: { id: { in: [rec1.id, rec2.id] } } });
    await prisma.product.delete({ where: { id: product.id } });
  });

  it("4. recalculateAllSalesFifo fixes historical sales recorded with inaccurate purchase costs", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Backfill Test Product",
        brand: "Pepsi",
        sku: `SKU-BACKFILL-${Date.now()}`,
        latestPurchasePrice: 160,
      },
    });

    // Batch 1: 1 @ 150
    const rec1 = await prisma.receiving.create({
      data: {
        supplierId: testSupplierId,
        receivedAt: new Date("2026-09-01T08:00:00Z"),
        createdById: testUserId,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            purchasePrice: 150,
            totalCost: 150,
          },
        },
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        movementType: MovementType.RECEIVING,
        quantity: 1,
        referenceType: "Receiving",
        referenceId: rec1.id,
        createdById: testUserId,
      },
    });

    // Batch 2: 1 @ 160
    const rec2 = await prisma.receiving.create({
      data: {
        supplierId: testSupplierId,
        receivedAt: new Date("2026-09-02T08:00:00Z"),
        createdById: testUserId,
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            purchasePrice: 160,
            totalCost: 160,
          },
        },
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        movementType: MovementType.RECEIVING,
        quantity: 1,
        referenceType: "Receiving",
        referenceId: rec2.id,
        createdById: testUserId,
      },
    });

    // Historical sale recorded with latestPurchasePrice = 160 instead of FIFO (155)
    const sale = await prisma.sale.create({
      data: {
        invoiceNumber: `INV-HIST-${Date.now()}`,
        saleType: SaleType.RETAIL,
        status: SaleStatus.COMPLETED,
        subtotal: 340,
        discount: 0,
        totalAmount: 340,
        paidAmount: 340,
        creditAmount: 0,
        soldAt: new Date("2026-09-03T10:00:00Z"),
        createdById: testUserId,
        items: {
          create: {
            productId: product.id,
            quantity: 2,
            unitPrice: 170,
            totalAmount: 340,
            purchaseCostAtSale: 160, // Old inaccurate cost
          },
        },
      },
    });

    // Run recalculation
    const recount = await recalculateAllSalesFifo(prisma);
    assert.ok(recount.updatedCount >= 1);

    // Verify sale item purchaseCostAtSale is now 155
    const updatedItem = await prisma.saleItem.findFirst({
      where: { saleId: sale.id },
    });
    assert.equal(Number(updatedItem?.purchaseCostAtSale), 155);

    // Running recalculation again should result in 0 updates (idempotent)
    const idempotentRecount = await recalculateAllSalesFifo(prisma);
    assert.equal(idempotentRecount.updatedCount, 0);

    // Clean up
    await prisma.saleItem.deleteMany({ where: { saleId: sale.id } });
    await prisma.sale.delete({ where: { id: sale.id } });
    await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
    await prisma.receivingItem.deleteMany({ where: { productId: product.id } });
    await prisma.receiving.deleteMany({ where: { id: { in: [rec1.id, rec2.id] } } });
    await prisma.product.delete({ where: { id: product.id } });
  });
});
