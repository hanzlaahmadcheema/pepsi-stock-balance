/**
 * Phase 3 Sync — Master Data Push Handlers
 *
 * Cloud-authoritative domain operations:
 *   - UPSERT_CUSTOMER: Idempotent customer upsert with stable UUID.
 *   - UPSERT_PRODUCT: Idempotent product upsert with unique name/sku validation.
 *   - CREATE_PRICE: Preserves full price history; exactly 1 active price per product + tier.
 *   - UPSERT_SUPPLIER: Idempotent supplier upsert with stable UUID.
 *   - UPDATE_USER: Enforces role hierarchy; prevents unauthorized escalation (staff promoting to owner).
 */

import {
  PriceTier,
  Role,
  Prisma,
  type SyncDevice,
} from "@prisma/client";
import type { SyncOperation } from "@/lib/sync/types";
import {
  type TransactionClient,
  recordSyncChangeLog,
  resolveUserId,
  resolveRequiredActorUser,
} from "./common";

import { compareCustomerLww } from "@/lib/sync/conflict/customer-lww";

interface UpsertCustomerPayload {
  name: string;
  phone?: string | null;
  address?: string | null;
  priceTier?: PriceTier;
  creditAllowed?: boolean;
  isActive?: boolean;
  // LWW conflict resolution stamp — carried in every UPSERT_CUSTOMER payload
  version?: number;       // The resulting version number after this mutation
  lwwTimestamp?: string;  // ISO 8601 client timestamp when mutation was written
}

interface UpsertProductPayload {
  name: string;
  brand: string;
  sku?: string | null;
  minimumStockLevel?: number;
  latestPurchasePrice?: number;
  isActive?: boolean;
}

interface CreatePricePayload {
  productId: string;
  tier: PriceTier;
  amount: number;
  userId?: string;
  actorUserId?: string;
}

interface UpsertSupplierPayload {
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive?: boolean;
}

interface UpdateUserPayload {
  name?: string;
  role?: Role;
  isActive?: boolean;
  pinHash?: string | null;
  actorUserId?: string;
  userId?: string;
}

/**
 * Upserts a customer catalog record with LWW conflict resolution.
 *
 * Attribution: Device-level operation (`sourceDeviceId: device.deviceId`).
 *
 * LWW Mechanism:
 *   Incoming stamp = { version: payload.version, lwwTimestamp: payload.lwwTimestamp, operationId }
 *   Current stamp  = { version: current.version, lwwTimestamp: current.lastUpdatedAt, operationId: current.lastOperationId }
 *
 *   If incoming stamp > current stamp → apply mutation, update LWW fields.
 *   If incoming stamp ≤ current stamp → skip mutation; record SyncChangeLog with lwwLost=true.
 *   If customer does not exist yet  → create (first write always wins on a new record).
 *
 * The SyncChangeLog payload always contains the complete LWW stamp so that Local Depot
 * can perform the same comparison deterministically during pull without extra DB reads.
 */
export async function handleUpsertCustomer(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as UpsertCustomerPayload;

  const trimmedName = payload.name?.trim();
  if (!trimmedName) {
    throw new Error("Customer name is required.");
  }

  // Read existing row inside the same transaction to compare stamps.
  const existing = await tx.customer.findUnique({
    where: { id: operation.entityId },
    select: {
      id: true,
      version: true,
      lastUpdatedAt: true,
      lastOperationId: true,
    },
  });

  // Build incoming LWW stamp from operation metadata + payload fields.
  // `clientCreatedAt` is the top-level SyncOperation field (ISO 8601).
  const incomingVersion =
    typeof payload.version === "number" && payload.version > 0
      ? payload.version
      : existing
      ? existing.version + 1
      : 1;

  const incomingStamp = {
    version: incomingVersion,
    clientCreatedAt: payload.lwwTimestamp ?? operation.clientCreatedAt,
    operationId: operation.operationId,
  };

  // Determine whether the incoming mutation wins.
  let incomingWins = true;
  if (existing !== null) {
    const currentStamp = {
      version: existing.version,
      clientCreatedAt: existing.lastUpdatedAt.toISOString(),
      operationId: existing.lastOperationId ?? "",
    };
    incomingWins = compareCustomerLww(incomingStamp, currentStamp) > 0;
  }

  let customer: { id: string; name: string; phone: string | null; address: string | null; priceTier: string; creditAllowed: boolean; isActive: boolean };

  if (incomingWins) {
    // Apply mutation and record new LWW metadata on the row.
    const priceTier = payload.priceTier || PriceTier.RETAIL;
    const lwwDate = new Date(incomingStamp.clientCreatedAt);

    customer = await tx.customer.upsert({
      where: { id: operation.entityId },
      update: {
        name: trimmedName,
        phone: payload.phone?.trim() || null,
        address: payload.address?.trim() || null,
        priceTier,
        creditAllowed: payload.creditAllowed ?? false,
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        version: incomingStamp.version,
        lastOperationId: operation.operationId,
        lastUpdatedAt: lwwDate,
      },
      create: {
        id: operation.entityId,
        name: trimmedName,
        phone: payload.phone?.trim() || null,
        address: payload.address?.trim() || null,
        priceTier,
        creditAllowed: payload.creditAllowed ?? false,
        isActive: payload.isActive ?? true,
        version: incomingStamp.version,
        lastOperationId: operation.operationId,
        lastUpdatedAt: lwwDate,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        priceTier: true,
        creditAllowed: true,
        isActive: true,
      },
    });
  } else {
    // Current row wins LWW. Do NOT mutate the customer table.
    // Still record SyncChangeLog so the losing operation is auditable
    // and propagated to local depots (which will also apply the same LWW
    // comparison and likewise keep their winning local value).
    const existingFull = await tx.customer.findUniqueOrThrow({
      where: { id: operation.entityId },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        priceTier: true,
        creditAllowed: true,
        isActive: true,
      },
    });
    customer = { ...existingFull, priceTier: existingFull.priceTier as string };
  }

  // Always record to SyncChangeLog with full LWW stamp so pull side can compare.
  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "UPSERT_CUSTOMER",
    entityId: customer.id,
    action: "UPSERT",
    payload: {
      id: customer.id,
      name: incomingWins ? customer.name : (payload.name?.trim() ?? ""),
      phone: incomingWins ? customer.phone : (payload.phone?.trim() || null),
      address: incomingWins ? customer.address : (payload.address?.trim() || null),
      priceTier: incomingWins ? customer.priceTier : (payload.priceTier || PriceTier.RETAIL),
      creditAllowed: incomingWins ? customer.creditAllowed : (payload.creditAllowed ?? false),
      isActive: incomingWins ? customer.isActive : (payload.isActive ?? true),
      // LWW stamp — propagated so Local Depot pull can apply identical comparison
      version: incomingStamp.version,
      lwwTimestamp: incomingStamp.clientCreatedAt,
      lwwLost: !incomingWins,
    },
    sourceDeviceId: device.deviceId,
  });
}


/**
 * Upserts a product catalog record.
 *
 * Attribution: Device-level operation (`sourceDeviceId: device.deviceId`).
 * Product records do not maintain a direct User author foreign key in the schema,
 * representing synchronized master catalog items attributed to the authorized SyncDevice.
 */
export async function handleUpsertProduct(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as UpsertProductPayload;

  const name = payload.name?.trim();
  const brand = payload.brand?.trim();
  const sku = payload.sku?.trim() || null;

  if (!name) {
    throw new Error("Product name is required.");
  }
  if (!brand) {
    throw new Error("Product brand is required.");
  }

  const minStock = Math.max(0, payload.minimumStockLevel ?? 0);
  const purchasePrice = Math.max(0, payload.latestPurchasePrice ?? 0);

  // Check unique constraints against other products
  const existingName = await tx.product.findFirst({
    where: {
      name,
      id: { not: operation.entityId },
    },
    select: { id: true },
  });

  if (existingName) {
    throw new Error(`Another product already uses the name "${name}".`);
  }

  if (sku) {
    const existingSku = await tx.product.findFirst({
      where: {
        sku,
        id: { not: operation.entityId },
      },
      select: { id: true },
    });

    if (existingSku) {
      throw new Error(`Another product already uses the SKU "${sku}".`);
    }
  }

  const product = await tx.product.upsert({
    where: { id: operation.entityId },
    update: {
      name,
      brand,
      sku,
      minimumStockLevel: minStock,
      latestPurchasePrice: new Prisma.Decimal(purchasePrice.toFixed(2)),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
    create: {
      id: operation.entityId,
      name,
      brand,
      sku,
      minimumStockLevel: minStock,
      latestPurchasePrice: new Prisma.Decimal(purchasePrice.toFixed(2)),
      isActive: payload.isActive ?? true,
    },
  });

  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "UPSERT_PRODUCT",
    entityId: product.id,
    action: "UPSERT",
    payload: {
      id: product.id,
      name: product.name,
      brand: product.brand,
      sku: product.sku,
      minimumStockLevel: product.minimumStockLevel,
      latestPurchasePrice: purchasePrice,
      isActive: product.isActive,
    },
    sourceDeviceId: device.deviceId,
  });
}

export async function handleCreatePrice(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as CreatePricePayload;

  if (!payload || !payload.productId) {
    throw new Error("Product ID is required for price creation.");
  }

  if (!payload.tier || !Object.values(PriceTier).includes(payload.tier)) {
    throw new Error(`Invalid price tier: ${payload.tier}`);
  }

  if (typeof payload.amount !== "number" || payload.amount < 0) {
    throw new Error("Price amount must be a non-negative number.");
  }

  const product = await tx.product.findUnique({
    where: { id: payload.productId },
    select: { id: true },
  });

  if (!product) {
    throw new Error("Product not found for price creation.");
  }

  const userId = await resolveUserId(
    tx,
    payload.userId || payload.actorUserId,
    "price creation"
  );
  const now = new Date();

  // 1. Close existing active price for this product + tier (preserving price history)
  await tx.price.updateMany({
    where: {
      productId: payload.productId,
      tier: payload.tier,
      effectiveTo: null,
    },
    data: {
      effectiveTo: now,
    },
  });

  // 2. Create new active price record
  const newPrice = await tx.price.create({
    data: {
      id: operation.entityId,
      productId: payload.productId,
      tier: payload.tier,
      amount: new Prisma.Decimal(payload.amount.toFixed(2)),
      effectiveFrom: now,
      effectiveTo: null,
      createdById: userId,
    },
  });

  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "CREATE_PRICE",
    entityId: newPrice.id,
    action: "UPSERT",
    payload: {
      id: newPrice.id,
      productId: newPrice.productId,
      tier: newPrice.tier,
      amount: payload.amount,
      effectiveFrom: now.toISOString(),
      effectiveTo: null,
    },
    sourceDeviceId: device.deviceId,
  });
}

/**
 * Upserts a supplier catalog record.
 *
 * Attribution: Device-level operation (`sourceDeviceId: device.deviceId`).
 * Supplier records do not maintain a User author relation in the schema,
 * representing master partner data synchronized by the authorized SyncDevice.
 */
export async function handleUpsertSupplier(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as UpsertSupplierPayload;

  const trimmedName = payload.name?.trim();
  if (!trimmedName) {
    throw new Error("Supplier name is required.");
  }

  const supplier = await tx.supplier.upsert({
    where: { id: operation.entityId },
    update: {
      name: trimmedName,
      contactPerson: payload.contactPerson?.trim() || null,
      phone: payload.phone?.trim() || null,
      address: payload.address?.trim() || null,
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
    create: {
      id: operation.entityId,
      name: trimmedName,
      contactPerson: payload.contactPerson?.trim() || null,
      phone: payload.phone?.trim() || null,
      address: payload.address?.trim() || null,
      isActive: payload.isActive ?? true,
    },
  });

  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "UPSERT_SUPPLIER",
    entityId: supplier.id,
    action: "UPSERT",
    payload: {
      id: supplier.id,
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      address: supplier.address,
      isActive: supplier.isActive,
    },
    sourceDeviceId: device.deviceId,
  });
}

export async function handleUpdateUser(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as UpdateUserPayload;

  const targetUser = await tx.user.findUnique({
    where: { id: operation.entityId },
  });

  if (!targetUser) {
    throw new Error("Target user not found for update.");
  }

  // Permission & Role hierarchy verification:
  // Sub-check: If role is being changed to OWNER from non-OWNER, missing actor is an explicit escalation error
  if (payload.role === Role.OWNER && targetUser.role !== Role.OWNER) {
    if (!payload.actorUserId && !payload.userId) {
      throw new Error("Unauthorized role escalation: Missing actor for Owner promotion. MISSING_ACTOR_IDENTITY");
    }
  }

  // All user account updates require a valid, active human actor for attribution
  const actorUser = await resolveRequiredActorUser(
    tx,
    payload.actorUserId || payload.userId,
    "user account update"
  );

  if (actorUser.role === Role.STAFF) {
    if (payload.role === Role.OWNER) {
      throw new Error("Unauthorized role escalation: Staff cannot promote users to Owner.");
    }
    if (targetUser.role === Role.OWNER) {
      throw new Error("Unauthorized modification: Staff cannot modify an Owner account.");
    }
  }

  // If role is being changed to OWNER, actor must be authenticated and must be an OWNER
  if (payload.role === Role.OWNER && targetUser.role !== Role.OWNER) {
    if (actorUser.role !== Role.OWNER) {
      throw new Error("Unauthorized role escalation: Only an Owner can promote a user to Owner.");
    }
  }

  const updatedUser = await tx.user.update({
    where: { id: operation.entityId },
    data: {
      ...(payload.name?.trim() ? { name: payload.name.trim() } : {}),
      ...(payload.role ? { role: payload.role } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      ...(payload.pinHash !== undefined ? { pinHash: payload.pinHash } : {}),
    },
  });

  const auditUserId = actorUser.id;

  await tx.auditLog.create({
    data: {
      userId: auditUserId,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: updatedUser.id,
      deviceId: device.deviceId,
      oldValues: {
        name: targetUser.name,
        role: targetUser.role,
        isActive: targetUser.isActive,
      },
      newValues: {
        name: updatedUser.name,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
      },
      reason: `User ${updatedUser.name} updated via sync`,
    },
  });

  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "UPDATE_USER",
    entityId: updatedUser.id,
    action: "UPSERT",
    payload: {
      id: updatedUser.id,
      name: updatedUser.name,
      role: updatedUser.role,
      isActive: updatedUser.isActive,
    },
    sourceDeviceId: device.deviceId,
  });
}
