/**
 * Phase 3 Sync — Returns Domain Push Handlers
 *
 * Handles:
 *   - CREATE_RETURN: Atomically creates return voucher in QUARANTINED status, items in PENDING.
 *                    Goods are NOT restocked until inspected.
 *   - INSPECT_RETURN: Applies inspection verdict; creates RETURN_RESTOCK movements for approved items,
 *                     or DamageRecord for damaged items.
 */

import {
  ReturnStatus,
  InspectionResult,
  MovementType,
  ContainerType,
  ContainerMovementType,
  DamageType,
  SaleStatus,
  Role,
  Prisma,
  type SyncDevice,
} from "@prisma/client";
import type { SyncOperation } from "@/lib/sync/types";
import {
  type TransactionClient,
  recordSyncChangeLog,
  resolveUserId,
} from "./common";

interface ReturnItemPayload {
  productId: string;
  quantity: number;
}

interface CreateReturnPayload {
  saleId: string;
  reason?: string;
  notes?: string;
  items: ReturnItemPayload[];
  containers?: {
    plasticCrates?: number;
    glassBottles?: number;
  };
  userId?: string;
  actorUserId?: string;
}

interface InspectDecisionPayload {
  returnItemId: string;
  result: InspectionResult;
  notes?: string;
}

interface InspectReturnPayload {
  decisions: InspectDecisionPayload[];
  generalNotes?: string;
  userId?: string;
  actorUserId?: string;
}

export async function handleCreateReturn(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as CreateReturnPayload;

  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Return must contain at least one line item.");
  }

  if (!payload.saleId) {
    throw new Error("Original sale invoice ID is required for return.");
  }

  const userId = await resolveUserId(
    tx,
    payload.userId || payload.actorUserId,
    "return creation"
  );

  const productQtyMap = new Map<string, number>();
  for (const item of payload.items) {
    if (!item.productId) {
      throw new Error("Valid productId is required for each line item.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Return quantity must be a positive whole number of crates.");
    }
    if (productQtyMap.has(item.productId)) {
      throw new Error("Duplicate product found in return items.");
    }
    productQtyMap.set(item.productId, item.quantity);
  }

  // 1. Fetch and validate sale
  const sale = await tx.sale.findUnique({
    where: { id: payload.saleId },
    include: {
      customer: true,
      items: true,
    },
  });

  if (!sale) {
    throw new Error("Original sale invoice not found.");
  }

  if (sale.status === SaleStatus.CANCELLED) {
    throw new Error("Cannot return items from a cancelled invoice.");
  }

  // 2. Validate return quantity against sold and already-returned crates
  const existingReturns = await tx.return.findMany({
    where: {
      notes: { contains: sale.id },
      status: { not: ReturnStatus.REJECTED },
    },
    include: { items: true },
  });

  const alreadyReturnedMap = new Map<string, number>();
  for (const ret of existingReturns) {
    for (const retItem of ret.items) {
      if (retItem.inspectionResult !== InspectionResult.REJECTED_DAMAGED) {
        alreadyReturnedMap.set(
          retItem.productId,
          (alreadyReturnedMap.get(retItem.productId) || 0) + retItem.quantity
        );
      }
    }
  }

  const saleItemMap = new Map(sale.items.map((i) => [i.productId, i]));

  for (const [productId, returnQty] of productQtyMap.entries()) {
    const soldItem = saleItemMap.get(productId);
    if (!soldItem) {
      throw new Error("Selected product was not part of the original invoice.");
    }

    const alreadyReturned = alreadyReturnedMap.get(productId) || 0;
    const eligible = soldItem.quantity - alreadyReturned;

    if (returnQty > eligible) {
      throw new Error(
        `Return quantity (${returnQty} crates) exceeds remaining eligible crates (${eligible} crates) for this invoice.`
      );
    }
  }

  // 3. Create Return header in QUARANTINED status
  const formattedNotes = `[Sale: ${sale.id}] Inv: #${sale.invoiceNumber}${
    payload.notes ? ` | ${payload.notes.trim()}` : ""
  }`;

  const returnRecord = await tx.return.create({
    data: {
      id: operation.entityId,
      customerId: sale.customerId,
      status: ReturnStatus.QUARANTINED,
      reason: payload.reason?.trim() || null,
      notes: formattedNotes,
      createdById: userId,
    },
  });

  // 4. Create ReturnItem rows in PENDING inspection status
  for (const item of payload.items) {
    await tx.returnItem.create({
      data: {
        returnId: returnRecord.id,
        productId: item.productId,
        quantity: item.quantity,
        inspectionResult: InspectionResult.PENDING,
      },
    });
  }

  // 5. Container Movement tracking (CREDIT)
  if (sale.customerId && payload.containers) {
    if (payload.containers.plasticCrates && payload.containers.plasticCrates > 0) {
      await tx.containerMovement.create({
        data: {
          customerId: sale.customerId,
          containerType: ContainerType.PLASTIC_CRATE,
          movementType: ContainerMovementType.CREDIT,
          quantity: payload.containers.plasticCrates,
          referenceId: returnRecord.id,
          notes: `Plastic crates returned with Return #${returnRecord.id.slice(0, 8)}`,
          createdById: userId,
        },
      });
    }

    if (payload.containers.glassBottles && payload.containers.glassBottles > 0) {
      await tx.containerMovement.create({
        data: {
          customerId: sale.customerId,
          containerType: ContainerType.GLASS_BOTTLE,
          movementType: ContainerMovementType.CREDIT,
          quantity: payload.containers.glassBottles,
          referenceId: returnRecord.id,
          notes: `Glass bottles returned with Return #${returnRecord.id.slice(0, 8)}`,
          createdById: userId,
        },
      });
    }
  }

  // 6. Audit Log
  await tx.auditLog.create({
    data: {
      userId,
      action: "CREATE_RETURN",
      entityType: "Return",
      entityId: returnRecord.id,
      deviceId: device.deviceId,
      newValues: {
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customerId: sale.customerId,
        status: ReturnStatus.QUARANTINED,
        items: payload.items,
      } as unknown as Prisma.InputJsonValue,
      reason: payload.reason?.trim() || "Return entered into quarantine via sync",
    },
  });

  // 7. SyncChangeLog
  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "CREATE_RETURN",
    entityId: returnRecord.id,
    action: "UPSERT",
    payload: {
      id: returnRecord.id,
      saleId: sale.id,
      customerId: sale.customerId,
      status: "QUARANTINED",
      items: payload.items,
    },
    sourceDeviceId: device.deviceId,
  });
}

export async function handleInspectReturn(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as InspectReturnPayload;

  if (!payload || !Array.isArray(payload.decisions) || payload.decisions.length === 0) {
    throw new Error("Inspection decisions must be provided for line items.");
  }

  const rawActorId = payload.userId || payload.actorUserId;
  if (!rawActorId || typeof rawActorId !== "string" || !rawActorId.trim()) {
    throw new Error("Actor user ID is required to inspect returns. MISSING_ACTOR_IDENTITY");
  }

  const actor = await tx.user.findUnique({
    where: { id: rawActorId.trim() },
    select: { id: true, role: true, name: true, isActive: true },
  });

  if (!actor) {
    throw new Error(
      "Unauthorized: Only an Owner can inspect quarantined returns. Referenced actor user ID not found. UNKNOWN_ACTOR"
    );
  }

  if (!actor.isActive) {
    throw new Error(
      `Unauthorized: Only an Owner can inspect quarantined returns. Referenced actor user '${actor.name}' is inactive. INACTIVE_ACTOR`
    );
  }

  if (actor.role !== Role.OWNER) {
    throw new Error("Unauthorized: Only an Owner can inspect quarantined returns.");
  }

  const userId = actor.id;

  const returnRecord = await tx.return.findUnique({
    where: { id: operation.entityId },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  if (!returnRecord) {
    throw new Error("Return voucher not found.");
  }

  if (returnRecord.status !== ReturnStatus.QUARANTINED) {
    throw new Error(
      `This return has already been processed with status "${returnRecord.status}" and cannot be re-inspected.`
    );
  }

  const decisionMap = new Map(payload.decisions.map((d) => [d.returnItemId, d]));

  for (const item of returnRecord.items) {
    const dec = decisionMap.get(item.id);
    if (!dec) {
      throw new Error(`Missing inspection decision for product "${item.product.name}".`);
    }
    if (
      dec.result !== InspectionResult.APPROVED_FOR_STOCK &&
      dec.result !== InspectionResult.REJECTED_DAMAGED &&
      dec.result !== InspectionResult.DISPOSED
    ) {
      throw new Error(
        `Invalid inspection verdict "${dec.result}" for product "${item.product.name}".`
      );
    }
  }

  let anyApproved = false;
  let allRejectedOrDisposed = true;

  for (const item of returnRecord.items) {
    const dec = decisionMap.get(item.id)!;

    await tx.returnItem.update({
      where: { id: item.id },
      data: {
        inspectionResult: dec.result,
        notes: dec.notes?.trim() || null,
      },
    });

    if (dec.result === InspectionResult.APPROVED_FOR_STOCK) {
      anyApproved = true;
      allRejectedOrDisposed = false;

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          movementType: MovementType.RETURN_RESTOCK,
          quantity: Math.abs(item.quantity),
          referenceType: "Return",
          referenceId: returnRecord.id,
          notes: `Restock approved from Return #${returnRecord.id.slice(0, 8)}`,
          createdById: userId,
        },
      });
    } else if (dec.result === InspectionResult.REJECTED_DAMAGED) {
      await tx.damageRecord.create({
        data: {
          productId: item.productId,
          quantity: item.quantity,
          damageType: DamageType.OTHER,
          reason: `Damaged return — Return #${returnRecord.id.slice(0, 8)}${
            dec.notes ? `: ${dec.notes.trim()}` : ""
          }`,
          referenceId: item.id,
          recordedById: userId,
        },
      });
    }
  }

  const finalStatus: ReturnStatus = allRejectedOrDisposed
    ? ReturnStatus.REJECTED
    : anyApproved
    ? ReturnStatus.COMPLETED
    : ReturnStatus.INSPECTED;

  const now = new Date();
  await tx.return.update({
    where: { id: returnRecord.id },
    data: {
      status: finalStatus,
      inspectedById: userId,
      inspectedAt: now,
      notes: payload.generalNotes?.trim()
        ? `${returnRecord.notes || ""} [Inspection Remarks: ${payload.generalNotes.trim()}]`
        : returnRecord.notes,
    },
  });

  await tx.auditLog.create({
    data: {
      userId,
      action: "INSPECT_RETURN",
      entityType: "Return",
      entityId: returnRecord.id,
      deviceId: device.deviceId,
      oldValues: { status: ReturnStatus.QUARANTINED },
      newValues: {
        status: finalStatus,
        decisions: payload.decisions,
      } as unknown as Prisma.InputJsonValue,
      reason: payload.generalNotes?.trim() || "Return inspection completed via sync",
    },
  });

  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "INSPECT_RETURN",
    entityId: returnRecord.id,
    action: "UPSERT",
    payload: {
      id: returnRecord.id,
      status: finalStatus,
      decisions: payload.decisions,
    },
    sourceDeviceId: device.deviceId,
  });
}
