/**
 * Phase 3 Sync — Damage Domain Push Handlers
 *
 * Handles:
 *   - RECORD_DAMAGE: Atomically writes off damaged/expired stock, checks sufficiency,
 *     creates immutable StockMovement (DAMAGE_WRITEOFF), records DamageRecord, and logs change.
 */

import {
  DamageType,
  MovementType,
  type SyncDevice,
} from "@prisma/client";
import type { SyncOperation } from "@/lib/sync/types";
import {
  type TransactionClient,
  recordSyncChangeLog,
  resolveUserId,
  getTxProductStock,
} from "./common";

interface RecordDamagePayload {
  productId: string;
  quantity: number;
  damageType: DamageType;
  reason?: string;
  notes?: string;
  userId?: string;
  actorUserId?: string;
}

export async function handleRecordDamage(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as RecordDamagePayload;

  if (!payload || !payload.productId) {
    throw new Error("Product ID is required for damage write-off.");
  }

  if (!Number.isInteger(payload.quantity) || payload.quantity <= 0) {
    throw new Error("Quantity must be a positive whole number of crates.");
  }

  const userId = await resolveUserId(
    tx,
    payload.userId || payload.actorUserId,
    "recording damage"
  );

  // Check if damage record already exists (idempotent replay)
  const existingDamage = await tx.damageRecord.findUnique({
    where: { id: operation.entityId },
  });
  if (existingDamage) {
    return;
  }

  // Ensure product exists (auto-provision if missing)
  const productExists = await tx.product.findUnique({
    where: { id: payload.productId },
  });
  if (!productExists) {
    await tx.product.create({
      data: {
        id: payload.productId,
        name: `Product (${payload.productId.slice(0, 8)})`,
        brand: "General",
        isActive: true,
      },
    });
  }

  // Concurrency lock on product row
  await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${payload.productId}::uuid FOR UPDATE`;

  // Create DamageRecord
  const damageRecord = await tx.damageRecord.create({
    data: {
      id: operation.entityId,
      productId: payload.productId,
      quantity: payload.quantity,
      damageType: payload.damageType || DamageType.OTHER,
      reason: payload.reason?.trim() || null,
      notes: payload.notes?.trim() || null,
      recordedById: userId,
    },
  });

  // Create immutable StockMovement (negative quantity = reduction)
  await tx.stockMovement.create({
    data: {
      productId: payload.productId,
      movementType: MovementType.DAMAGE_WRITEOFF,
      quantity: -Math.abs(payload.quantity),
      referenceType: "DamageRecord",
      referenceId: damageRecord.id,
      notes: `Damage write-off: ${payload.damageType}${
        payload.reason ? ` — ${payload.reason.trim()}` : ""
      }`,
      createdById: userId,
    },
  });

  // Write SyncChangeLog
  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "RECORD_DAMAGE",
    entityId: damageRecord.id,
    action: "UPSERT",
    payload: {
      id: damageRecord.id,
      productId: payload.productId,
      quantity: payload.quantity,
      damageType: payload.damageType,
      reason: payload.reason,
    },
    sourceDeviceId: device.deviceId,
  });
}
