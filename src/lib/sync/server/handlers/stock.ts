/**
 * Phase 3 Sync — Stock Counts and Adjustment Domain Push Handlers
 *
 * Handles:
 *   - SUBMIT_STOCK_COUNT: Records physical counts and discrepancies.
 *     CRITICAL: Does NOT automatically create StockAdjustment records.
 *   - RESOLVE_STOCK_ADJUSTMENT: Respects Owner approval workflow; creates ADJUSTMENT_ADD/SUB
 *     stock movements only on APPROVE, enforces non-negative stock, updates adjustment status.
 */

import {
  DailyClosingStatus,
  AdjustmentStatus,
  MovementType,
  Role,
  Prisma,
  type SyncDevice,
} from "@prisma/client";
import type { SyncOperation } from "@/lib/sync/types";
import {
  type TransactionClient,
  recordSyncChangeLog,
  resolveUserId,
  getTxProductStock,
} from "./common";

interface StockCountItemPayload {
  productId: string;
  physicalQuantity: number;
  reason?: string;
}

interface SubmitStockCountPayload {
  businessDate: string; // YYYY-MM-DD
  counts: StockCountItemPayload[];
  notes?: string;
  userId?: string;
  actorUserId?: string;
}

interface ResolveAdjustmentPayload {
  decision: "APPROVE" | "REJECT";
  reason: string;
  userId?: string;
  actorUserId?: string;
}

export async function handleSubmitStockCount(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as SubmitStockCountPayload;

  if (!payload || !payload.businessDate) {
    throw new Error("Business date is required for stock count submission.");
  }

  if (!Array.isArray(payload.counts) || payload.counts.length === 0) {
    throw new Error("Stock count must include at least one counted product.");
  }

  const dateObj = new Date(payload.businessDate);
  if (isNaN(dateObj.getTime())) {
    throw new Error("Invalid business date format.");
  }

  const userId = await resolveUserId(
    tx,
    payload.userId || payload.actorUserId,
    "submitting stock count"
  );

  for (const c of payload.counts) {
    if (!c.productId) {
      throw new Error("Valid productId is required for each counted item.");
    }
    if (!Number.isInteger(c.physicalQuantity) || c.physicalQuantity < 0) {
      throw new Error("Physical stock quantity must be a non-negative whole number of crates.");
    }
  }

  // 1. Find or create DailyClosing session
  let closing = await tx.dailyClosing.findUnique({
    where: { businessDate: dateObj },
  });

  if (closing && closing.status === DailyClosingStatus.CLOSED) {
    throw new Error(
      `A stock count has already been finalized and closed for ${payload.businessDate}.`
    );
  }

  if (!closing) {
    closing = await tx.dailyClosing.create({
      data: {
        id: operation.entityId,
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
        notes: payload.notes?.trim() || null,
      },
    });
  }

  let hasDiscrepancy = false;

  // 2. Process each counted product
  for (const c of payload.counts) {
    const systemStock = await getTxProductStock(tx, c.productId);
    const difference = c.physicalQuantity - systemStock;

    if (difference !== 0) {
      hasDiscrepancy = true;
    }

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

    // NOTE: In Phase 3, per architecture freeze, StockAdjustment is NOT auto-created here.
    // Inventory anomalies/corrections are decoupled from physical stock-count submission.
  }

  // 3. Update count session status
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

  // 4. Audit Log
  await tx.auditLog.create({
    data: {
      userId,
      action: "SUBMIT_STOCK_COUNT",
      entityType: "DailyClosing",
      entityId: closing.id,
      deviceId: device.deviceId,
      newValues: {
        businessDate: payload.businessDate,
        status: newStatus,
        hasDiscrepancy,
        countsCount: payload.counts.length,
      },
      reason: hasDiscrepancy
        ? "Physical stock count submitted with discrepancies via sync"
        : "Physical stock count verified via sync",
    },
  });

  // 5. SyncChangeLog
  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "SUBMIT_STOCK_COUNT",
    entityId: closing.id,
    action: "UPSERT",
    payload: {
      id: closing.id,
      businessDate: payload.businessDate,
      hasDiscrepancy,
      status: newStatus,
      counts: payload.counts,
    },
    sourceDeviceId: device.deviceId,
  });
}

export async function handleResolveStockAdjustment(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as ResolveAdjustmentPayload;

  const trimmedReason = payload.reason?.trim();
  if (!trimmedReason || trimmedReason.length < 3) {
    throw new Error(
      `A mandatory reason (at least 3 characters) is required to ${payload.decision?.toLowerCase()} this adjustment.`
    );
  }

  if (payload.decision !== "APPROVE" && payload.decision !== "REJECT") {
    throw new Error("Decision must be either 'APPROVE' or 'REJECT'.");
  }

  const rawActorId = payload.userId || payload.actorUserId;
  if (!rawActorId || typeof rawActorId !== "string" || !rawActorId.trim()) {
    throw new Error("Actor user ID is required to resolve a stock adjustment. MISSING_ACTOR_IDENTITY");
  }

  const actor = await tx.user.findUnique({
    where: { id: rawActorId.trim() },
    select: { id: true, role: true, name: true, isActive: true },
  });

  if (!actor) {
    throw new Error(
      "Unauthorized: Only an Owner can resolve stock adjustments. Referenced actor user ID not found. UNKNOWN_ACTOR"
    );
  }

  if (!actor.isActive) {
    throw new Error(
      `Unauthorized: Only an Owner can resolve stock adjustments. Referenced actor user '${actor.name}' is inactive. INACTIVE_ACTOR`
    );
  }

  if (actor.role !== Role.OWNER) {
    throw new Error("Unauthorized: Only an Owner can resolve stock adjustments.");
  }

  const userId = actor.id;

  // 1. Fetch adjustment
  const adjustment = await tx.stockAdjustment.findUnique({
    where: { id: operation.entityId },
    include: { product: true },
  });

  if (!adjustment) {
    throw new Error("Stock adjustment record not found.");
  }

  if (adjustment.status !== AdjustmentStatus.PENDING) {
    throw new Error(
      `This adjustment has already been ${adjustment.status.toLowerCase()} and cannot be modified.`
    );
  }

  // 2. Concurrency Lock: Lock product row
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${adjustment.productId}::uuid FOR UPDATE`;

  // 3. Recalculate authoritative current stock
  const currentStock = await getTxProductStock(tx, adjustment.productId);
  const now = new Date();

  if (payload.decision === "APPROVE") {
    if (adjustment.difference < 0) {
      const cratesToDeduct = Math.abs(adjustment.difference);
      if (currentStock < cratesToDeduct) {
        throw new Error(
          `Cannot approve adjustment for "${adjustment.product.name}": deducting ${cratesToDeduct} crates would result in negative stock. Current available stock is only ${currentStock} crates.`
        );
      }
    }

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
        notes: `Stock adjustment approved via sync: ${trimmedReason}`,
        createdById: userId,
      },
    });

    await tx.stockAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: AdjustmentStatus.APPROVED,
        approvedById: userId,
        approvedAt: now,
        oldQuantity: currentStock,
        newQuantity: currentStock + adjustment.difference,
      },
    });
  } else {
    // REJECT
    await tx.stockAdjustment.update({
      where: { id: adjustment.id },
      data: {
        status: AdjustmentStatus.REJECTED,
        approvedById: userId,
        approvedAt: now,
        rejectionReason: trimmedReason,
      },
    });
  }

  // 4. Check if parent closing can be verified
  const match = adjustment.reason.match(/\[Count:\s*([a-f0-9\-]+)\]/i);
  const closingId = match ? match[1] : null;

  if (closingId) {
    const pendingCount = await tx.stockAdjustment.count({
      where: {
        reason: { contains: closingId },
        status: AdjustmentStatus.PENDING,
      },
    });

    if (pendingCount === 0) {
      await tx.dailyClosing.updateMany({
        where: { id: closingId },
        data: { stockVerified: true },
      });
    }
  }

  // 5. Audit Log
  await tx.auditLog.create({
    data: {
      userId,
      action: payload.decision === "APPROVE" ? "APPROVE_STOCK_ADJUSTMENT" : "REJECT_STOCK_ADJUSTMENT",
      entityType: "StockAdjustment",
      entityId: adjustment.id,
      deviceId: device.deviceId,
      newValues: {
        status: payload.decision === "APPROVE" ? AdjustmentStatus.APPROVED : AdjustmentStatus.REJECTED,
        difference: adjustment.difference,
        decisionReason: trimmedReason,
      },
      reason: trimmedReason,
    },
  });

  // 6. SyncChangeLog
  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "RESOLVE_STOCK_ADJUSTMENT",
    entityId: adjustment.id,
    action: "UPSERT",
    payload: {
      id: adjustment.id,
      productId: adjustment.productId,
      difference: adjustment.difference,
      oldQuantity: currentStock,
      newQuantity: payload.decision === "APPROVE" ? currentStock + adjustment.difference : currentStock,
      status: payload.decision === "APPROVE" ? "APPROVED" : "REJECTED",
      reason: trimmedReason,
      approvedById: userId,
    },
    sourceDeviceId: device.deviceId,
  });
}
