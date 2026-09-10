import { prisma } from "@/lib/prisma";
import {
  DailyClosingStatus,
  AdjustmentStatus,
  MovementType,
  Prisma,
} from "@prisma/client";

export type StockCountItemInput = {
  productId: string;
  physicalQuantity: number;
  reason?: string;
};

export type SubmitStockCountInput = {
  businessDate: string; // YYYY-MM-DD
  counts: StockCountItemInput[];
  notes?: string;
};

export type PendingAdjustmentSummary = {
  id: string;
  productId: string;
  productName: string;
  productBrand: string;
  oldQuantity: number;
  newQuantity: number;
  difference: number;
  reason: string;
  requestedByName: string;
  createdAt: Date;
  closingId: string | null;
};

export type StockCountSessionSummary = {
  id: string;
  businessDate: Date;
  status: DailyClosingStatus;
  stockVerified: boolean;
  totalProductsCounted: number;
  discrepanciesCount: number;
  pendingAdjustmentsCount: number;
  closedByName: string;
  closedAt: Date | null;
};

export type StockCountDetailRow = {
  id: string;
  productId: string;
  productName: string;
  productBrand: string;
  systemQuantity: number;
  physicalQuantity: number;
  difference: number;
  countedByName: string;
  countedAt: Date;
  adjustment?: {
    id: string;
    status: AdjustmentStatus;
    reason: string;
    rejectionReason: string | null;
    approvedByName: string | null;
    approvedAt: Date | null;
  } | null;
};

export type StockCountDetails = {
  id: string;
  businessDate: Date;
  status: DailyClosingStatus;
  stockVerified: boolean;
  notes: string | null;
  closedByName: string;
  closedAt: Date | null;
  items: StockCountDetailRow[];
  auditLogs: {
    id: string;
    action: string;
    reason: string;
    userName: string;
    createdAt: Date;
  }[];
};

/**
 * Calculates authoritative on-hand stock for a single product inside a transaction.
 */
export async function getTxProductStock(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<number> {
  const movements = await tx.stockMovement.groupBy({
    by: ["productId", "movementType"],
    where: { productId },
    _sum: { quantity: true },
  });

  let stock = 0;
  for (const m of movements) {
    const qty = m._sum.quantity || 0;
    if (
      m.movementType === MovementType.RECEIVING ||
      m.movementType === MovementType.SALE_CANCELLATION ||
      m.movementType === MovementType.RETURN_RESTOCK ||
      m.movementType === MovementType.ADJUSTMENT_ADD
    ) {
      stock += Math.abs(qty);
    } else {
      stock -= Math.abs(qty);
    }
  }
  return stock;
}

/**
 * Extracts closingId from formatted adjustment reason: [Count: <uuid>] <reason>
 */
export function extractClosingIdFromReason(reasonText: string): string | null {
  const match = reasonText.match(/\[Count:\s*([a-f0-9\-]+)\]/i);
  return match ? match[1] : null;
}

/**
 * Lists all stock count sessions.
 */
export async function listStockCountSessions(): Promise<StockCountSessionSummary[]> {
  const closings = await prisma.dailyClosing.findMany({
    orderBy: { businessDate: "desc" },
    include: {
      closedBy: { select: { name: true } },
      stockCounts: true,
    },
    take: 50,
  });

  // Fetch pending adjustments count to show in summary
  const pendingAdjustments = await prisma.stockAdjustment.findMany({
    where: { status: AdjustmentStatus.PENDING },
    select: { reason: true },
  });

  const pendingMapByClosingId = new Map<string, number>();
  for (const p of pendingAdjustments) {
    const cid = extractClosingIdFromReason(p.reason);
    if (cid) {
      pendingMapByClosingId.set(cid, (pendingMapByClosingId.get(cid) || 0) + 1);
    }
  }

  return closings.map((c) => {
    const totalProductsCounted = c.stockCounts.length;
    const discrepanciesCount = c.stockCounts.filter((sc) => sc.difference !== 0).length;
    const pendingCount = pendingMapByClosingId.get(c.id) || 0;

    return {
      id: c.id,
      businessDate: c.businessDate,
      status: c.status,
      stockVerified: c.stockVerified,
      totalProductsCounted,
      discrepanciesCount,
      pendingAdjustmentsCount: pendingCount,
      closedByName: c.closedBy.name,
      closedAt: c.closedAt,
    };
  });
}

/**
 * Lists all pending stock adjustments requiring Owner approval.
 */
export async function listPendingAdjustments(): Promise<PendingAdjustmentSummary[]> {
  const adjustments = await prisma.stockAdjustment.findMany({
    where: { status: AdjustmentStatus.PENDING },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true, brand: true } },
      requestedBy: { select: { name: true } },
    },
  });

  return adjustments.map((a) => ({
    id: a.id,
    productId: a.productId,
    productName: a.product.name,
    productBrand: a.product.brand,
    oldQuantity: a.oldQuantity,
    newQuantity: a.newQuantity,
    difference: a.difference,
    reason: a.reason.replace(/\[Count:\s*[a-f0-9\-]+\]\s*/i, ""),
    requestedByName: a.requestedBy.name,
    createdAt: a.createdAt,
    closingId: extractClosingIdFromReason(a.reason),
  }));
}

/**
 * Retrieves full stock count session details with discrepancies and approval states.
 */
export async function getStockCountDetails(closingId: string): Promise<StockCountDetails | null> {
  const closing = await prisma.dailyClosing.findUnique({
    where: { id: closingId },
    include: {
      closedBy: { select: { name: true } },
      stockCounts: {
        include: {
          product: { select: { name: true, brand: true } },
          countedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!closing) return null;

  // Find adjustments linked to this count session
  const adjustments = await prisma.stockAdjustment.findMany({
    where: {
      reason: { contains: closing.id },
    },
    include: {
      approvedBy: { select: { name: true } },
    },
  });

  const adjustmentMap = new Map(adjustments.map((a) => [a.productId, a]));

  // Fetch Audit Logs
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "DailyClosing",
      entityId: closing.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
    },
  });

  const items: StockCountDetailRow[] = closing.stockCounts.map((sc) => {
    const adj = adjustmentMap.get(sc.productId);

    return {
      id: sc.id,
      productId: sc.productId,
      productName: sc.product.name,
      productBrand: sc.product.brand,
      systemQuantity: sc.systemQuantity,
      physicalQuantity: sc.physicalQuantity,
      difference: sc.difference,
      countedByName: sc.countedBy.name,
      countedAt: sc.countedAt,
      adjustment: adj
        ? {
            id: adj.id,
            status: adj.status,
            reason: adj.reason.replace(/\[Count:\s*[a-f0-9\-]+\]\s*/i, ""),
            rejectionReason: adj.rejectionReason,
            approvedByName: adj.approvedBy?.name || null,
            approvedAt: adj.approvedAt,
          }
        : null,
    };
  });

  return {
    id: closing.id,
    businessDate: closing.businessDate,
    status: closing.status,
    stockVerified: closing.stockVerified,
    notes: closing.notes,
    closedByName: closing.closedBy.name,
    closedAt: closing.closedAt,
    items,
    auditLogs: auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      reason: a.reason,
      userName: a.user.name,
      createdAt: a.createdAt,
    })),
  };
}

/**
 * Submits physical stock count.
 * Validates whole crate quantities, calculates differences,
 * creates pending StockAdjustment records for discrepancies, and updates workflow status.
 */
export async function submitStockCountTransaction(
  data: SubmitStockCountInput,
  userId: string
): Promise<{ closingId: string }> {
  const { businessDate, counts, notes } = data;

  if (!businessDate) {
    throw new Error("Business date is required.");
  }

  if (!counts || counts.length === 0) {
    throw new Error("Stock count must include at least one product.");
  }

  const dateObj = new Date(businessDate);
  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid business date.");
  }

  // Validate quantities
  for (const c of counts) {
    if (!Number.isInteger(c.physicalQuantity) || c.physicalQuantity < 0) {
      throw new Error("Physical stock quantity must be a non-negative whole number of crates.");
    }
  }

  return prisma.$transaction(async (tx) => {
    // 1. Find or create DailyClosing for this businessDate
    let closing = await tx.dailyClosing.findUnique({
      where: { businessDate: dateObj },
    });

    if (closing && closing.status === DailyClosingStatus.CLOSED) {
      throw new Error(
        `A stock count has already been finalized and closed for ${businessDate}.`
      );
    }

    if (!closing) {
      closing = await tx.dailyClosing.create({
        data: {
          businessDate: dateObj,
          totalSales: new Prisma.Decimal(0),
          totalCashExpected: new Prisma.Decimal(0),
          totalDigitalPayments: new Prisma.Decimal(0),
          totalCredit: new Prisma.Decimal(0),
          physicalCash: new Prisma.Decimal(0),
          cashDifference: new Prisma.Decimal(0),
          stockVerified: false,
          status: DailyClosingStatus.OPEN,
          closedById: userId,
          notes: notes?.trim() || null,
        },
      });
    }

    let hasDiscrepancy = false;

    // 2. Process each counted product
    for (const c of counts) {
      // Authoritative system stock right now
      const systemStock = await getTxProductStock(tx, c.productId);
      const difference = c.physicalQuantity - systemStock;

      if (difference !== 0) {
        hasDiscrepancy = true;

        if (!c.reason?.trim() || c.reason.trim().length < 3) {
          const product = await tx.product.findUnique({
            where: { id: c.productId },
            select: { name: true },
          });
          throw new Error(
            `A mandatory explanation reason is required for discrepancy on "${product?.name || "Product"}".`
          );
        }
      }

      // Upsert StockCount
      await tx.stockCount.upsert({
        where: {
          closingId_productId: {
            closingId: closing.id,
            productId: c.productId,
          },
        },
        update: {
          systemQuantity: systemStock,
          physicalQuantity: c.physicalQuantity,
          difference,
          countedById: userId,
          countedAt: new Date(),
        },
        create: {
          closingId: closing.id,
          productId: c.productId,
          systemQuantity: systemStock,
          physicalQuantity: c.physicalQuantity,
          difference,
          countedById: userId,
        },
      });

      // If difference, create or update pending StockAdjustment
      if (difference !== 0) {
        const adjustmentReason = `[Count: ${closing.id}] ${c.reason!.trim()}`;

        // Check if an adjustment already exists for this count and product
        const existingAdj = await tx.stockAdjustment.findFirst({
          where: {
            productId: c.productId,
            reason: { contains: closing.id },
            status: AdjustmentStatus.PENDING,
          },
        });

        if (existingAdj) {
          await tx.stockAdjustment.update({
            where: { id: existingAdj.id },
            data: {
              oldQuantity: systemStock,
              newQuantity: c.physicalQuantity,
              difference,
              reason: adjustmentReason,
            },
          });
        } else {
          await tx.stockAdjustment.create({
            data: {
              productId: c.productId,
              oldQuantity: systemStock,
              newQuantity: c.physicalQuantity,
              difference,
              reason: adjustmentReason,
              requestedById: userId,
              status: AdjustmentStatus.PENDING,
            },
          });
        }
      }
    }

    // 3. Update count session status:
    // If there are discrepancies, session enters IN_REVIEW pending Owner decision.
    // If no discrepancies, stockVerified = true (ready for Owner daily closing).
    const newStatus: DailyClosingStatus = hasDiscrepancy
      ? DailyClosingStatus.IN_REVIEW
      : closing.status;

    await tx.dailyClosing.update({
      where: { id: closing.id },
      data: {
        status: newStatus,
        stockVerified: !hasDiscrepancy,
      },
    });

    // 4. Create Audit Log
    await tx.auditLog.create({
      data: {
        userId,
        action: "SUBMIT_STOCK_COUNT",
        entityType: "DailyClosing",
        entityId: closing.id,
        newValues: {
          businessDate,
          status: newStatus,
          hasDiscrepancy,
          countsCount: counts.length,
        },
        reason: hasDiscrepancy
          ? "Physical stock count submitted with discrepancies (Pending Owner Approval)"
          : "Physical stock count matched system stock (Closed)",
      },
    });

    return { closingId: closing.id };
  });
}

/**
 * Resolves a stock adjustment (OWNER only).
 * Performs concurrency locking (FOR UPDATE), recalculates live stock inside transaction,
 * prevents negative inventory, creates immutable StockMovement (ADJUSTMENT_ADD / ADJUSTMENT_SUB)
 * on approval, updates adjustment status, checks parent session closure, and logs audit entry.
 */
export async function resolveAdjustmentTransaction(
  adjustmentId: string,
  decision: "APPROVE" | "REJECT",
  reason: string,
  ownerUserId: string
): Promise<{ adjustmentId: string; status: AdjustmentStatus }> {
  const trimmedReason = reason?.trim();
  if (!trimmedReason || trimmedReason.length < 3) {
    throw new Error(
      `A mandatory reason (at least 3 characters) is required to ${decision.toLowerCase()} this adjustment.`
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Fetch adjustment and verify status is PENDING
    const adjustment = await tx.stockAdjustment.findUnique({
      where: { id: adjustmentId },
      include: {
        product: true,
      },
    });

    if (!adjustment) {
      throw new Error("Stock adjustment record not found.");
    }

    if (adjustment.status !== AdjustmentStatus.PENDING) {
      throw new Error(
        `This adjustment has already been ${adjustment.status.toLowerCase()} and cannot be modified.`
      );
    }

    // 2. Concurrency Lock: Lock the product row
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${adjustment.productId}::uuid FOR UPDATE`;

    // 3. Recalculate authoritative current on-hand stock inside transaction
    const currentStock = await getTxProductStock(tx, adjustment.productId);

    const now = new Date();

    if (decision === "APPROVE") {
      // If adjustment difference is negative (subtracting crates):
      // verify that currentStock is sufficient so stock never becomes negative
      if (adjustment.difference < 0) {
        const cratesToDeduct = Math.abs(adjustment.difference);
        if (currentStock < cratesToDeduct) {
          throw new Error(
            `Cannot approve adjustment for "${adjustment.product.name}": deducting ${cratesToDeduct} crates would result in negative stock. Current available stock is only ${currentStock} crates (sales or dispatches occurred since the count was taken).`
          );
        }
      }

      // Create immutable StockMovement
      const movementType =
        adjustment.difference > 0
          ? MovementType.ADJUSTMENT_ADD
          : MovementType.ADJUSTMENT_SUB;

      await tx.stockMovement.create({
        data: {
          productId: adjustment.productId,
          movementType,
          quantity: Math.abs(adjustment.difference),
          referenceType: "StockAdjustment",
          referenceId: adjustment.id,
          notes: `Stock adjustment approved by Owner: ${trimmedReason}`,
          createdById: ownerUserId,
        },
      });

      // Update StockAdjustment
      await tx.stockAdjustment.update({
        where: { id: adjustment.id },
        data: {
          status: AdjustmentStatus.APPROVED,
          approvedById: ownerUserId,
          approvedAt: now,
          oldQuantity: currentStock, // Snapshot authoritative stock at approval time
          newQuantity: currentStock + adjustment.difference,
        },
      });
    } else {
      // REJECT: No StockMovement created
      await tx.stockAdjustment.update({
        where: { id: adjustment.id },
        data: {
          status: AdjustmentStatus.REJECTED,
          approvedById: ownerUserId,
          approvedAt: now,
          rejectionReason: trimmedReason,
        },
      });
    }

    // 4. Check if the parent count session can now be closed
    const closingId = extractClosingIdFromReason(adjustment.reason);
    if (closingId) {
      const pendingCount = await tx.stockAdjustment.count({
        where: {
          reason: { contains: closingId },
          status: AdjustmentStatus.PENDING,
        },
      });

      // If all discrepancies for this count are now approved or rejected, mark stock as verified
      if (pendingCount === 0) {
        await tx.dailyClosing.updateMany({
          where: { id: closingId },
          data: {
            stockVerified: true,
          },
        });
      }
    }

    // 5. Create Audit Log
    await tx.auditLog.create({
      data: {
        userId: ownerUserId,
        action: decision === "APPROVE" ? "APPROVE_STOCK_ADJUSTMENT" : "REJECT_STOCK_ADJUSTMENT",
        entityType: "StockAdjustment",
        entityId: adjustment.id,
        newValues: {
          status: decision === "APPROVE" ? AdjustmentStatus.APPROVED : AdjustmentStatus.REJECTED,
          difference: adjustment.difference,
          decisionReason: trimmedReason,
        },
        reason: trimmedReason,
      },
    });

    return {
      adjustmentId: adjustment.id,
      status: decision === "APPROVE" ? AdjustmentStatus.APPROVED : AdjustmentStatus.REJECTED,
    };
  }, { timeout: 15000, maxWait: 5000 });
}
