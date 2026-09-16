/**
 * Phase 3 Sync — Shared Handler Utilities and Invariants
 */

import {
  MovementType,
  Prisma,
  Role,
  type PrismaClient,
} from "@prisma/client";
import type { SyncChangeAction, SyncOperationType } from "@/lib/sync/types";

export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Inserts a canonical domain change record into SyncChangeLog inside the current transaction.
 */
export async function recordSyncChangeLog(
  tx: TransactionClient,
  params: {
    operationId: string;
    operationType: SyncOperationType;
    entityId: string;
    action: SyncChangeAction;
    payload: Record<string, unknown>;
    sourceDeviceId: string | null;
  }
): Promise<void> {
  await tx.syncChangeLog.create({
    data: {
      operationId: params.operationId,
      operationType: params.operationType,
      entityId: params.entityId,
      action: params.action,
      payload: params.payload as Prisma.InputJsonValue,
      sourceDeviceId: params.sourceDeviceId,
    },
  });
}

/**
 * Resolves and validates a required active human actor user for domain operations.
 *
 * Enforces:
 * 1. Actor user ID is strictly required -> MISSING_ACTOR_IDENTITY
 * 2. Actor user must exist on Cloud database -> UNKNOWN_ACTOR
 * 3. Actor user must be marked active -> INACTIVE_ACTOR
 *
 * SECURITY: Never falls back to Owner, earliest user, or arbitrary user.
 * Device authentication verifies device identity only; human operations require
 * explicit actor attribution.
 */
export async function resolveRequiredActorUser(
  tx: TransactionClient,
  rawActorUserId?: unknown,
  contextDescription: string = "operation"
): Promise<{ id: string; role: Role; name: string; isActive: boolean }> {
  if (
    rawActorUserId === undefined ||
    rawActorUserId === null ||
    (typeof rawActorUserId === "string" && !rawActorUserId.trim())
  ) {
    throw new Error(
      `Actor user ID is required for ${contextDescription}. MISSING_ACTOR_IDENTITY`
    );
  }

  const userId =
    typeof rawActorUserId === "string" ? rawActorUserId.trim() : String(rawActorUserId);

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, isActive: true },
  });

  if (!user) {
    throw new Error(
      `Referenced actor user ID '${userId}' not found in database for ${contextDescription}. UNKNOWN_ACTOR`
    );
  }

  if (!user.isActive) {
    throw new Error(
      `Referenced actor user '${user.name}' (${userId}) is inactive for ${contextDescription}. INACTIVE_ACTOR`
    );
  }

  return user;
}

/**
 * Resolves a valid user ID for audit and foreign key attribution.
 * Strictly requires an active human actor and delegates to resolveRequiredActorUser.
 *
 * NEVER falls back to Owner, earliest active user, or any arbitrary user.
 */
export async function resolveUserId(
  tx: TransactionClient,
  preferredUserId?: unknown,
  contextDescription: string = "operation"
): Promise<string> {
  const actor = await resolveRequiredActorUser(tx, preferredUserId, contextDescription);
  return actor.id;
}

/**
 * Calculates authoritative current on-hand stock for product IDs inside a transaction.
 */
export async function getStockMapInTx(
  tx: TransactionClient,
  productIds: string[]
): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  for (const id of productIds) {
    stockMap.set(id, 0);
  }

  if (productIds.length === 0) {
    return stockMap;
  }

  const movements = await tx.stockMovement.groupBy({
    by: ["productId", "movementType"],
    where: { productId: { in: productIds } },
    _sum: { quantity: true },
  });

  for (const m of movements) {
    const qty = m._sum.quantity || 0;
    const current = stockMap.get(m.productId) || 0;
    if (
      m.movementType === MovementType.RECEIVING ||
      m.movementType === MovementType.SALE_CANCELLATION ||
      m.movementType === MovementType.RETURN_RESTOCK ||
      m.movementType === MovementType.ADJUSTMENT_ADD
    ) {
      stockMap.set(m.productId, current + Math.abs(qty));
    } else {
      stockMap.set(m.productId, current - Math.abs(qty));
    }
  }

  return stockMap;
}

/**
 * Calculates authoritative current on-hand stock for a single product.
 */
export async function getTxProductStock(
  tx: TransactionClient,
  productId: string
): Promise<number> {
  const map = await getStockMapInTx(tx, [productId]);
  return map.get(productId) || 0;
}

/**
 * Generates unique invoice number: INV-[DEVICE-]YYYYMMDD-XXXX.
 * Prefixes with device identifier if provided to prevent inter-device collisions.
 */
export async function generateUniqueInvoiceNumber(
  tx: TransactionClient,
  deviceId?: string
): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const devPrefix = deviceId ? `${deviceId.slice(0, 8).toUpperCase()}-` : "";

  for (let attempt = 0; attempt < 10; attempt++) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${devPrefix}${dateStr}-${randomSuffix}`;

    const existing = await tx.sale.findUnique({
      where: { invoiceNumber },
      select: { id: true },
    });

    if (!existing) {
      return invoiceNumber;
    }
  }

  return `INV-${devPrefix}${dateStr}-${Date.now().toString().slice(-4)}`;
}

