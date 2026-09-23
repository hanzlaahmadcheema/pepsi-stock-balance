/**
 * scripts/enqueue-unsynced.ts
 *
 * Backfill script that inspects the local depot database for historical
 * or offline records (Sales, Receivings, Customers, Payments) that were
 * committed locally but never enqueued into `SyncOutbox`.
 *
 * It safely enqueues them with deterministic or new UUIDs so the sync daemon
 * will push them to Cloud on its next cycle.
 */

import crypto from "node:crypto";
import { PrismaClient, MovementType, ContainerType, ContainerMovementType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Checking for Unsynced Local Records ===");

  // 1. Unsynced Customers
  const existingCustomerOutbox = await prisma.syncOutbox.findMany({
    where: { operationType: "UPSERT_CUSTOMER" },
    select: { entityId: true },
  });
  const customerOutboxIds = new Set(existingCustomerOutbox.map((o) => o.entityId));

  const unsyncedCustomers = await prisma.customer.findMany({
    where: {
      id: { notIn: Array.from(customerOutboxIds) },
    },
  });

  console.log(`Found ${unsyncedCustomers.length} unsynced customer(s).`);
  for (const customer of unsyncedCustomers) {
    const operationId = crypto.randomUUID();
    await prisma.syncOutbox.create({
      data: {
        operationId,
        operationType: "UPSERT_CUSTOMER",
        entityId: customer.id,
        payload: {
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          priceTier: customer.priceTier,
          creditAllowed: customer.creditAllowed,
          isActive: customer.isActive,
          version: customer.version,
          lwwTimestamp: customer.lastUpdatedAt.toISOString(),
        },
        status: "PENDING",
      },
    });
    console.log(`  -> Enqueued UPSERT_CUSTOMER for ${customer.name} (${customer.id})`);
  }

  // 2. Unsynced Sales
  const existingSaleOutbox = await prisma.syncOutbox.findMany({
    where: { operationType: "CREATE_SALE" },
    select: { entityId: true },
  });
  const saleOutboxIds = new Set(existingSaleOutbox.map((o) => o.entityId));

  const unsyncedSales = await prisma.sale.findMany({
    where: {
      status: "COMPLETED",
      id: { notIn: Array.from(saleOutboxIds) },
    },
    include: {
      items: true,
      payments: true,
    },
    orderBy: { soldAt: "asc" },
  });

  console.log(`Found ${unsyncedSales.length} unsynced completed sale(s).`);
  for (const sale of unsyncedSales) {
    // Check if containers were tracked for this sale
    const containers = await prisma.containerMovement.findMany({
      where: { referenceId: sale.id },
    });

    let plasticCrates = 0;
    let glassBottles = 0;
    for (const cm of containers) {
      if (cm.movementType === ContainerMovementType.DEBIT) {
        if (cm.containerType === ContainerType.PLASTIC_CRATE) {
          plasticCrates += cm.quantity;
        } else if (cm.containerType === ContainerType.GLASS_BOTTLE) {
          glassBottles += cm.quantity;
        }
      }
    }

    const firstPayment = sale.payments[0];
    const operationId = crypto.randomUUID();

    await prisma.syncOutbox.create({
      data: {
        operationId,
        operationType: "CREATE_SALE",
        entityId: sale.id,
        payload: {
          invoiceNumber: sale.invoiceNumber,
          customerId: sale.customerId,
          saleType: sale.saleType,
          items: sale.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
          })),
          discount: Number(sale.discount),
          paymentMethod: firstPayment?.paymentMethod || "CASH",
          paidAmount: Number(sale.paidAmount),
          containers: {
            plasticCrates,
            glassBottles,
          },
          userId: sale.createdById,
          soldAt: sale.soldAt.toISOString(),
        },
        status: "PENDING",
      },
    });
    console.log(`  -> Enqueued CREATE_SALE for Inv #${sale.invoiceNumber} (${sale.id})`);
  }

  // 3. Unsynced Receivings
  const existingReceivingOutbox = await prisma.syncOutbox.findMany({
    where: { operationType: "POST_RECEIVING" },
    select: { entityId: true },
  });
  const receivingOutboxIds = new Set(existingReceivingOutbox.map((o) => o.entityId));

  const unsyncedReceivings = await prisma.receiving.findMany({
    where: {
      id: { notIn: Array.from(receivingOutboxIds) },
    },
    include: {
      items: true,
    },
    orderBy: { receivedAt: "asc" },
  });

  console.log(`Found ${unsyncedReceivings.length} unsynced receiving(s).`);
  for (const receiving of unsyncedReceivings) {
    // Only enqueue if posted (movements exist)
    const movementsCount = await prisma.stockMovement.count({
      where: {
        referenceType: "Receiving",
        referenceId: receiving.id,
      },
    });

    if (movementsCount === 0) {
      console.log(`  -> Skipping draft receiving #${receiving.referenceNumber || receiving.id}`);
      continue;
    }

    const operationId = crypto.randomUUID();
    await prisma.syncOutbox.create({
      data: {
        operationId,
        operationType: "POST_RECEIVING",
        entityId: receiving.id,
        payload: {
          supplierId: receiving.supplierId,
          referenceNumber: receiving.referenceNumber,
          receivedAt: receiving.receivedAt.toISOString(),
          notes: receiving.notes,
          items: receiving.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            purchasePrice: Number(i.purchasePrice),
          })),
          userId: receiving.createdById,
        },
        status: "PENDING",
      },
    });
    console.log(`  -> Enqueued POST_RECEIVING for #${receiving.referenceNumber || receiving.id}`);
  }

  // 4. Unsynced Account-level Payments
  const existingPaymentOutbox = await prisma.syncOutbox.findMany({
    where: { operationType: "RECORD_PAYMENT" },
    select: { entityId: true },
  });
  const paymentOutboxIds = new Set(existingPaymentOutbox.map((o) => o.entityId));

  const unsyncedPayments = await prisma.payment.findMany({
    where: {
      saleId: null,
      id: { notIn: Array.from(paymentOutboxIds) },
    },
    orderBy: { paidAt: "asc" },
  });

  console.log(`Found ${unsyncedPayments.length} unsynced account-level payment(s).`);
  for (const p of unsyncedPayments) {
    const operationId = crypto.randomUUID();
    await prisma.syncOutbox.create({
      data: {
        operationId,
        operationType: "RECORD_PAYMENT",
        entityId: p.id,
        payload: {
          customerId: p.customerId,
          saleId: null,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          referenceNumber: p.referenceNumber,
          userId: p.receivedById,
          paidAt: p.paidAt.toISOString(),
        },
        status: "PENDING",
      },
    });
    console.log(`  -> Enqueued RECORD_PAYMENT for $${p.amount} (${p.id})`);
  }

  const finalPending = await prisma.syncOutbox.count({
    where: { status: "PENDING" },
  });
  console.log(`=== Done! Total Pending in SyncOutbox now: ${finalPending} ===`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
