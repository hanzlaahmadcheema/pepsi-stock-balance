import { prisma } from "@/lib/prisma";
import { MovementType, Prisma } from "@prisma/client";
import { recalculateAllSalesFifo } from "@/lib/inventory/fifo";
import { enqueueOutbox } from "@/lib/sync/outbox";

export type ReceivingListItem = {
  id: string;
  referenceNumber: string | null;
  receivedAt: Date;
  supplierName: string;
  createdByName: string;
  totalCrates: number;
  itemsCount: number;
  isPosted: boolean;
  totalCost?: string; // Only provided to OWNER
};

export type ReceivingItemData = {
  id: string;
  productId: string;
  productName: string;
  brand: string;
  quantity: number;
  purchasePrice?: string;
  totalCost?: string;
};

export type ReceivingDetailsData = {
  id: string;
  referenceNumber: string | null;
  receivedAt: Date;
  notes: string | null;
  createdAt: Date;
  supplierId: string;
  supplierName: string;
  createdByName: string;
  isPosted: boolean;
  totalCrates: number;
  totalCost?: string;
  items: ReceivingItemData[];
};

/**
 * Lists all receiving records with posted status and total crates calculation.
 */
export async function listReceivings(isOwner = false): Promise<ReceivingListItem[]> {
  const receivings = await prisma.receiving.findMany({
    orderBy: { receivedAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: {
        select: {
          quantity: true,
          totalCost: true,
        },
      },
    },
  });

  if (receivings.length === 0) {
    return [];
  }

  const receivingIds = receivings.map((r) => r.id);

  // Determine posted status via StockMovement ledger
  const postedMovements = await prisma.stockMovement.findMany({
    where: {
      referenceType: "Receiving",
      referenceId: { in: receivingIds },
    },
    select: { referenceId: true },
    distinct: ["referenceId"],
  });

  const postedSet = new Set(postedMovements.map((m) => m.referenceId));

  return receivings.map((r) => {
    const totalCrates = r.items.reduce((acc, item) => acc + item.quantity, 0);
    const sumCost = r.items.reduce((acc, item) => acc.add(item.totalCost), new Prisma.Decimal(0));
    const isPosted = postedSet.has(r.id);

    const base: ReceivingListItem = {
      id: r.id,
      referenceNumber: r.referenceNumber,
      receivedAt: r.receivedAt,
      supplierName: r.supplier.name,
      createdByName: r.createdBy.name,
      totalCrates,
      itemsCount: r.items.length,
      isPosted,
    };

    if (isOwner) {
      base.totalCost = sumCost.toFixed(2);
    }

    return base;
  });
}

/**
 * Retrieves a single receiving record with its full line items.
 */
export async function getReceivingDetails(
  receivingId: string,
  isOwner = false
): Promise<ReceivingDetailsData | null> {
  const receiving = await prisma.receiving.findUnique({
    where: { id: receivingId },
    include: {
      supplier: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, brand: true } },
        },
      },
    },
  });

  if (!receiving) {
    return null;
  }

  const movementsCount = await prisma.stockMovement.count({
    where: {
      referenceType: "Receiving",
      referenceId: receivingId,
    },
  });

  const isPosted = movementsCount > 0;
  const totalCrates = receiving.items.reduce((acc, item) => acc + item.quantity, 0);
  const sumCost = receiving.items.reduce(
    (acc, item) => acc.add(item.totalCost),
    new Prisma.Decimal(0)
  );

  const items: ReceivingItemData[] = receiving.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    brand: item.product.brand,
    quantity: item.quantity,
    ...(isOwner
      ? {
          purchasePrice: item.purchasePrice.toString(),
          totalCost: item.totalCost.toString(),
        }
      : {}),
  }));

  const details: ReceivingDetailsData = {
    id: receiving.id,
    referenceNumber: receiving.referenceNumber,
    receivedAt: receiving.receivedAt,
    notes: receiving.notes,
    createdAt: receiving.createdAt,
    supplierId: receiving.supplier.id,
    supplierName: receiving.supplier.name,
    createdByName: receiving.createdBy.name,
    isPosted,
    totalCrates,
    items,
  };

  if (isOwner) {
    details.totalCost = sumCost.toFixed(2);
  }

  return details;
}

export type CreateReceivingInput = {
  supplierId: string;
  referenceNumber?: string | null;
  receivedAt: Date;
  notes?: string | null;
  items: {
    productId: string;
    quantity: number;
    purchasePrice: number;
  }[];
  postImmediately: boolean;
  userId: string;
};

/**
 * Creates a receiving record. If postImmediately is true, commits atomically to StockMovement
 * and updates Product.latestPurchasePrice in a single Prisma transaction.
 */
export async function createReceivingTransaction(input: CreateReceivingInput) {
  const { supplierId, referenceNumber, receivedAt, notes, items, postImmediately, userId } = input;

  return prisma.$transaction(async (tx) => {
    // 1. Create receiving record
    const receiving = await tx.receiving.create({
      data: {
        supplierId,
        referenceNumber: referenceNumber || null,
        receivedAt,
        notes: notes || null,
        createdById: userId,
      },
    });

    // 2. Create line items
    for (const item of items) {
      const totalCost = new Prisma.Decimal((item.quantity * item.purchasePrice).toFixed(2));
      await tx.receivingItem.create({
        data: {
          receivingId: receiving.id,
          productId: item.productId,
          quantity: item.quantity,
          purchasePrice: new Prisma.Decimal(item.purchasePrice.toFixed(2)),
          totalCost,
        },
      });

      // 3. If posting immediately, create stock movement and update latest purchase price
      if (postImmediately) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            movementType: MovementType.RECEIVING,
            quantity: item.quantity,
            referenceType: "Receiving",
            referenceId: receiving.id,
            notes: `Receiving delivery #${referenceNumber || receiving.id.slice(0, 8)}`,
            createdById: userId,
          },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: {
            latestPurchasePrice: new Prisma.Decimal(item.purchasePrice.toFixed(2)),
          },
        });
      }
    }

    // 4. Create immutable AuditLog
    await tx.auditLog.create({
      data: {
        userId,
        action: postImmediately ? "CREATE_AND_POST_RECEIVING" : "CREATE_DRAFT_RECEIVING",
        entityType: "Receiving",
        entityId: receiving.id,
        newValues: {
          referenceNumber,
          supplierId,
          receivedAt: receiving.receivedAt.toISOString(),
          itemsCount: items.length,
          postImmediately,
        },
        reason: `Goods receiving #${referenceNumber || receiving.id.slice(0, 8)} recorded`,
      },
    });

    // 5. If posted immediately, synchronize FIFO costing on historical sales and enqueue sync
    if (postImmediately) {
      await recalculateAllSalesFifo(tx);

      await enqueueOutbox(tx, "POST_RECEIVING", receiving.id, {
        supplierId,
        referenceNumber,
        receivedAt: receiving.receivedAt.toISOString(),
        notes: receiving.notes,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          purchasePrice: i.purchasePrice,
        })),
        userId,
      });
    }

    return receiving;
  });
}

/**
 * Posts an existing draft receiving atomically:
 * Creates StockMovement records and updates Product.latestPurchasePrice.
 */
export async function postReceivingTransaction(receivingId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const receiving = await tx.receiving.findUnique({
      where: { id: receivingId },
      include: { items: true },
    });

    if (!receiving) {
      throw new Error("Receiving record not found.");
    }

    const existingMovements = await tx.stockMovement.count({
      where: {
        referenceType: "Receiving",
        referenceId: receivingId,
      },
    });

    if (existingMovements > 0) {
      throw new Error("This receiving record has already been posted to the stock ledger.");
    }

    // Post every line item into StockMovement and update latest purchase price
    for (const item of receiving.items) {
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          movementType: MovementType.RECEIVING,
          quantity: item.quantity,
          referenceType: "Receiving",
          referenceId: receiving.id,
          notes: `Receiving delivery #${receiving.referenceNumber || receiving.id.slice(0, 8)}`,
          createdById: userId,
        },
      });

      await tx.product.update({
        where: { id: item.productId },
        data: {
          latestPurchasePrice: item.purchasePrice,
        },
      });
    }

    // Create immutable AuditLog
    await tx.auditLog.create({
      data: {
        userId,
        action: "POST_RECEIVING",
        entityType: "Receiving",
        entityId: receiving.id,
        newValues: {
          referenceNumber: receiving.referenceNumber,
          itemsCount: receiving.items.length,
          postedAt: new Date().toISOString(),
        },
        reason: `Draft receiving #${receiving.referenceNumber || receiving.id.slice(0, 8)} posted to stock ledger`,
      },
    });

    // Reconcile FIFO acquisition costs across historical sales
    await recalculateAllSalesFifo(tx);

    // Enqueue for Cloud Sync
    await enqueueOutbox(tx, "POST_RECEIVING", receiving.id, {
      supplierId: receiving.supplierId,
      referenceNumber: receiving.referenceNumber,
      receivedAt: receiving.receivedAt.toISOString(),
      notes: receiving.notes,
      items: receiving.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        purchasePrice: Number(i.purchasePrice),
      })),
      userId,
    });

    return receiving;
  });
}

/**
 * Deletes a draft receiving.
 * Strictly blocks deletion if receiving has already been posted.
 */
export async function deleteDraftReceiving(receivingId: string) {
  const movements = await prisma.stockMovement.count({
    where: {
      referenceType: "Receiving",
      referenceId: receivingId,
    },
  });

  if (movements > 0) {
    throw new Error("Security rule: Posted receiving cannot be deleted as it is recorded in the stock ledger.");
  }

  return prisma.receiving.delete({
    where: { id: receivingId },
  });
}
