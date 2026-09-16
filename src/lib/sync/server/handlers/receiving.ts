/**
 * Phase 3 Sync — Receiving Domain Push Handlers
 *
 * Handles:
 *   - POST_RECEIVING: Atomically creates/finalizes receiving, line items, stock movements, latestPurchasePrice.
 *   - DELETE_DRAFT_RECEIVING: Deletes receiving ONLY if it is still a draft (no stock movements). Forbids deleting posted.
 */

import {
  MovementType,
  Prisma,
  type SyncDevice,
} from "@prisma/client";
import type { SyncOperation } from "@/lib/sync/types";
import {
  type TransactionClient,
  recordSyncChangeLog,
  resolveUserId,
} from "./common";

interface ReceivingItemPayload {
  productId: string;
  quantity: number;
  purchasePrice: number;
}

interface PostReceivingPayload {
  supplierId: string;
  referenceNumber?: string | null;
  receivedAt?: string;
  notes?: string | null;
  items: ReceivingItemPayload[];
  userId?: string;
  actorUserId?: string;
}

interface DeleteDraftReceivingPayload {
  userId?: string;
  actorUserId?: string;
}

export async function handlePostReceiving(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as PostReceivingPayload;

  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Receiving must contain at least one line item.");
  }

  if (!payload.supplierId) {
    throw new Error("Supplier ID is required.");
  }

  const supplier = await tx.supplier.findUnique({
    where: { id: payload.supplierId },
  });

  if (!supplier) {
    throw new Error("Supplier not found.");
  }

  const userId = await resolveUserId(
    tx,
    payload.userId || payload.actorUserId,
    "stock receiving"
  );

  for (const item of payload.items) {
    if (!item.productId) {
      throw new Error("Product ID is required for each receiving item.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Quantity must be a positive whole number of crates.");
    }
    if (typeof item.purchasePrice !== "number" || item.purchasePrice < 0) {
      throw new Error("Purchase price cannot be negative.");
    }
  }

  // Check if receiving record already exists
  const existingReceiving = await tx.receiving.findUnique({
    where: { id: operation.entityId },
  });

  const existingMovements = await tx.stockMovement.count({
    where: {
      referenceType: "Receiving",
      referenceId: operation.entityId,
    },
  });

  if (existingMovements > 0) {
    throw new Error("This receiving record has already been posted to the stock ledger.");
  }

  const receivedAt = payload.receivedAt ? new Date(payload.receivedAt) : new Date();

  // Create or update receiving header
  if (existingReceiving) {
    await tx.receiving.update({
      where: { id: operation.entityId },
      data: {
        supplierId: payload.supplierId,
        referenceNumber: payload.referenceNumber || null,
        receivedAt,
        notes: payload.notes || null,
      },
    });
    // Delete existing draft items if re-posting
    await tx.receivingItem.deleteMany({
      where: { receivingId: operation.entityId },
    });
  } else {
    await tx.receiving.create({
      data: {
        id: operation.entityId,
        supplierId: payload.supplierId,
        referenceNumber: payload.referenceNumber || null,
        receivedAt,
        notes: payload.notes || null,
        createdById: userId,
      },
    });
  }

  // Create items, create stock movements, and update latest purchase price
  for (const item of payload.items) {
    const totalCost = new Prisma.Decimal((item.quantity * item.purchasePrice).toFixed(2));

    await tx.receivingItem.create({
      data: {
        receivingId: operation.entityId,
        productId: item.productId,
        quantity: item.quantity,
        purchasePrice: new Prisma.Decimal(item.purchasePrice.toFixed(2)),
        totalCost,
      },
    });

    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        movementType: MovementType.RECEIVING,
        quantity: item.quantity,
        referenceType: "Receiving",
        referenceId: operation.entityId,
        notes: `Receiving delivery #${payload.referenceNumber || operation.entityId.slice(0, 8)}`,
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

  // Audit Log
  await tx.auditLog.create({
    data: {
      userId,
      action: "POST_RECEIVING",
      entityType: "Receiving",
      entityId: operation.entityId,
      deviceId: device.deviceId,
      newValues: {
        referenceNumber: payload.referenceNumber,
        supplierId: payload.supplierId,
        itemsCount: payload.items.length,
        postedAt: new Date().toISOString(),
      },
      reason: `Goods receiving #${payload.referenceNumber || operation.entityId.slice(0, 8)} posted via sync`,
    },
  });

  // SyncChangeLog
  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "POST_RECEIVING",
    entityId: operation.entityId,
    action: "UPSERT",
    payload: {
      id: operation.entityId,
      supplierId: payload.supplierId,
      referenceNumber: payload.referenceNumber || null,
      receivedAt: receivedAt.toISOString(),
      items: payload.items,
      isPosted: true,
    },
    sourceDeviceId: device.deviceId,
  });
}

/**
 * Handles deletion of an unposted draft receiving aggregate.
 *
 * Attribution: Device-level operation (`sourceDeviceId: device.deviceId`).
 * Draft receiving cleanup does not require a human actor foreign key relation,
 * does not write an AuditLog row, and is safely attributed to the authenticating SyncDevice.
 */
export async function handleDeleteDraftReceiving(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const receiving = await tx.receiving.findUnique({
    where: { id: operation.entityId },
  });

  if (!receiving) {
    // Idempotent: already deleted
    return;
  }

  const movements = await tx.stockMovement.count({
    where: {
      referenceType: "Receiving",
      referenceId: operation.entityId,
    },
  });

  if (movements > 0) {
    throw new Error(
      "Security rule: Posted receiving cannot be deleted as it is recorded in the stock ledger."
    );
  }

  await tx.receivingItem.deleteMany({
    where: { receivingId: operation.entityId },
  });

  await tx.receiving.delete({
    where: { id: operation.entityId },
  });

  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "DELETE_DRAFT_RECEIVING",
    entityId: operation.entityId,
    action: "DELETE",
    payload: { id: operation.entityId },
    sourceDeviceId: device.deviceId,
  });
}
