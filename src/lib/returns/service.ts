import { prisma } from "@/lib/prisma";
import {
  ReturnStatus,
  InspectionResult,
  MovementType,
  ContainerType,
  ContainerMovementType,
  DamageType,
  SaleStatus,
  Prisma,
} from "@prisma/client";

export type ReturnItemInput = {
  productId: string;
  quantity: number;
};

export type CreateReturnInput = {
  saleId: string;
  reason?: string;
  notes?: string;
  items: ReturnItemInput[];
  containers?: {
    plasticCrates?: number;
    glassBottles?: number;
  };
};

export type InspectItemDecision = {
  returnItemId: string;
  result: InspectionResult;
  notes?: string;
};

export type InspectReturnInput = {
  returnId: string;
  decisions: InspectItemDecision[];
  generalNotes?: string;
};

export type SaleReturnEligibilityItem = {
  productId: string;
  productName: string;
  productBrand: string;
  soldQuantity: number;
  alreadyReturned: number;
  eligibleQuantity: number;
};

export type SaleReturnEligibility = {
  saleId: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string | null;
  soldAt: Date;
  status: SaleStatus;
  items: SaleReturnEligibilityItem[];
};

export type ReturnSummary = {
  id: string;
  returnedAt: Date;
  status: ReturnStatus;
  reason: string | null;
  invoiceNumber: string | null;
  saleId: string | null;
  customerId: string | null;
  customerName: string | null;
  createdByName: string;
  inspectedByName: string | null;
  inspectedAt: Date | null;
  totalCrates: number;
  approvedCrates: number;
};

export type ReturnDetailItem = {
  id: string;
  productId: string;
  productName: string;
  productBrand: string;
  quantity: number;
  inspectionResult: InspectionResult;
  notes: string | null;
};

export type ContainerMovementSummary = {
  id: string;
  containerType: ContainerType;
  movementType: ContainerMovementType;
  quantity: number;
  notes: string | null;
  createdAt: Date;
};

export type ReturnDetails = {
  id: string;
  returnedAt: Date;
  status: ReturnStatus;
  reason: string | null;
  notes: string | null;
  invoiceNumber: string | null;
  saleId: string | null;
  customerId: string | null;
  customerName: string | null;
  createdByName: string;
  inspectedByName: string | null;
  inspectedAt: Date | null;
  items: ReturnDetailItem[];
  containerMovements: ContainerMovementSummary[];
  auditLogs: {
    id: string;
    action: string;
    reason: string;
    userName: string;
    createdAt: Date;
  }[];
};

/**
 * Extracts saleId and invoiceNumber from standard formatted return notes.
 * Format: [Sale: <saleId>] Inv: #<invoiceNumber> | <userNotes>
 */
export function parseSaleRefFromNotes(notes: string | null): {
  saleId: string | null;
  invoiceNumber: string | null;
} {
  if (!notes) return { saleId: null, invoiceNumber: null };
  const saleMatch = notes.match(/\[Sale:\s*([a-f0-9\-]+)\]/i);
  const invMatch = notes.match(/Inv:\s*#?([A-Za-z0-9\-]+)/i);
  return {
    saleId: saleMatch ? saleMatch[1] : null,
    invoiceNumber: invMatch ? invMatch[1] : null,
  };
}

/**
 * Formats standardized return notes with embedded sale reference.
 */
export function formatReturnNotes(
  saleId: string,
  invoiceNumber: string,
  userNotes?: string
): string {
  const prefix = `[Sale: ${saleId}] Inv: #${invoiceNumber}`;
  return userNotes?.trim() ? `${prefix} | ${userNotes.trim()}` : prefix;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Retrieves a sale and determines eligible crate quantities for return.
 */
export async function getSaleForReturn(saleQuery: string): Promise<SaleReturnEligibility | null> {
  const trimmed = saleQuery.trim();
  if (!trimmed) return null;

  const isUuid = UUID_REGEX.test(trimmed);

  // Search by exact invoiceNumber, or also by ID if input is a valid UUID
  const sale = await prisma.sale.findFirst({
    where: isUuid
      ? {
          OR: [{ invoiceNumber: { equals: trimmed, mode: "insensitive" } }, { id: trimmed }],
        }
      : {
          invoiceNumber: { equals: trimmed, mode: "insensitive" },
        },
    include: {
      customer: { select: { name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, brand: true } },
        },
      },
    },
  });

  if (!sale) return null;

  // Fetch all existing returns for this sale to compute already-returned crates
  const existingReturns = await prisma.return.findMany({
    where: {
      notes: { contains: sale.id },
      status: { not: ReturnStatus.REJECTED },
    },
    include: {
      items: true,
    },
  });

  const alreadyReturnedMap = new Map<string, number>();
  for (const ret of existingReturns) {
    for (const item of ret.items) {
      if (item.inspectionResult !== InspectionResult.REJECTED_DAMAGED) {
        alreadyReturnedMap.set(
          item.productId,
          (alreadyReturnedMap.get(item.productId) || 0) + item.quantity
        );
      }
    }
  }

  const eligibilityItems: SaleReturnEligibilityItem[] = sale.items.map((i) => {
    const alreadyReturned = alreadyReturnedMap.get(i.productId) || 0;
    const eligibleQuantity = Math.max(0, i.quantity - alreadyReturned);

    return {
      productId: i.productId,
      productName: i.product.name,
      productBrand: i.product.brand,
      soldQuantity: i.quantity,
      alreadyReturned,
      eligibleQuantity,
    };
  });

  return {
    saleId: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerId: sale.customerId,
    customerName: sale.customer?.name || "Anonymous",
    soldAt: sale.soldAt,
    status: sale.status,
    items: eligibilityItems,
  };
}

/**
 * Creates a return in QUARANTINED status.
 * Validates original sale, product eligibility, positive whole crate quantities,
 * records ContainerMovements if applicable, and logs an AuditLog.
 * Does NOT increase saleable stock.
 */
export async function createReturnTransaction(
  data: CreateReturnInput,
  userId: string
): Promise<{ returnId: string }> {
  const { saleId, reason, notes, items, containers } = data;

  if (!items || items.length === 0) {
    throw new Error("Return must include at least one product line item.");
  }

  const productQtyMap = new Map<string, number>();
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Quantity must be a positive whole number of crates.");
    }
    if (productQtyMap.has(item.productId)) {
      throw new Error("Duplicate product line in return request.");
    }
    productQtyMap.set(item.productId, item.quantity);
  }

  return prisma.$transaction(async (tx) => {
    // 1. Fetch and validate sale
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
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
    const formattedNotes = formatReturnNotes(sale.id, sale.invoiceNumber, notes);

    const returnRecord = await tx.return.create({
      data: {
        customerId: sale.customerId,
        status: ReturnStatus.QUARANTINED,
        reason: reason?.trim() || null,
        notes: formattedNotes,
        createdById: userId,
      },
    });

    // 4. Create ReturnItem rows in PENDING inspection status
    for (const item of items) {
      await tx.returnItem.create({
        data: {
          returnId: returnRecord.id,
          productId: item.productId,
          quantity: item.quantity,
          inspectionResult: InspectionResult.PENDING,
        },
      });
    }

    // 5. Container Movement tracking (if customer is linked and containers provided)
    if (sale.customerId && containers) {
      if (containers.plasticCrates && containers.plasticCrates > 0) {
        await tx.containerMovement.create({
          data: {
            customerId: sale.customerId,
            containerType: ContainerType.PLASTIC_CRATE,
            movementType: ContainerMovementType.CREDIT,
            quantity: containers.plasticCrates,
            referenceId: returnRecord.id,
            notes: `Plastic crates returned with Return #${returnRecord.id.slice(0, 8)}`,
            createdById: userId,
          },
        });
      }

      if (containers.glassBottles && containers.glassBottles > 0) {
        await tx.containerMovement.create({
          data: {
            customerId: sale.customerId,
            containerType: ContainerType.GLASS_BOTTLE,
            movementType: ContainerMovementType.CREDIT,
            quantity: containers.glassBottles,
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
        newValues: {
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          customerId: sale.customerId,
          status: ReturnStatus.QUARANTINED,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          containers,
        },
        reason: reason?.trim() || "Return entered into quarantine",
      },
    });

    return { returnId: returnRecord.id };
  });
}

/**
 * Conducts quarantine inspection (OWNER only).
 * Determines whether stock returns to inventory (APPROVED_FOR_STOCK creates StockMovement RETURN_RESTOCK).
 * Rejected/damaged items do NOT increase saleable stock.
 */
export async function inspectReturnTransaction(
  input: InspectReturnInput,
  ownerUserId: string
): Promise<{ returnId: string; status: ReturnStatus }> {
  const { returnId, decisions, generalNotes } = input;

  if (!decisions || decisions.length === 0) {
    throw new Error("Inspection decisions must be provided for line items.");
  }

  return prisma.$transaction(async (tx) => {
    // 1. Fetch return and verify status is QUARANTINED
    const returnRecord = await tx.return.findUnique({
      where: { id: returnId },
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

    const decisionMap = new Map(decisions.map((d) => [d.returnItemId, d]));

    // 2. Validate all items have an inspection verdict
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

    // 3. Process each line item decision
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

        // Create immutable StockMovement to restock saleable inventory
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            movementType: MovementType.RETURN_RESTOCK,
            quantity: Math.abs(item.quantity), // positive crate quantity
            referenceType: "Return",
            referenceId: returnRecord.id,
            notes: `Restock approved from Return #${returnRecord.id.slice(0, 8)}`,
            createdById: ownerUserId,
          },
        });
      } else if (dec.result === InspectionResult.REJECTED_DAMAGED) {
        // Stock was already consumed at sale — no StockMovement needed.
        // Create DamageRecord for tracking and reporting of the loss.
        await tx.damageRecord.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            damageType: DamageType.OTHER,
            reason: `Damaged return — Return #${returnRecord.id.slice(0, 8)}${dec.notes ? `: ${dec.notes.trim()}` : ""}`,
            referenceId: item.id,
            recordedById: ownerUserId,
          },
        });
      }
    }

    // 4. Update Return status
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
        inspectedById: ownerUserId,
        inspectedAt: now,
        notes: generalNotes?.trim()
          ? `${returnRecord.notes || ""} [Inspection Remarks: ${generalNotes.trim()}]`
          : returnRecord.notes,
      },
    });

    // 5. Create Audit Log
    await tx.auditLog.create({
      data: {
        userId: ownerUserId,
        action: "INSPECT_RETURN",
        entityType: "Return",
        entityId: returnRecord.id,
        oldValues: {
          status: ReturnStatus.QUARANTINED,
        },
        newValues: {
          status: finalStatus,
          decisions: decisions.map((d) => ({
            itemId: d.returnItemId,
            result: d.result,
            notes: d.notes,
          })),
        },
        reason: generalNotes?.trim() || "Owner quarantine inspection completed",
      },
    });

    return { returnId: returnRecord.id, status: finalStatus };
  }, { timeout: 15000, maxWait: 5000 });
}

/**
 * Lists returns with summary details and crate quantities.
 */
export async function listReturns(params?: {
  status?: ReturnStatus;
  search?: string;
}): Promise<ReturnSummary[]> {
  const where: Prisma.ReturnWhereInput = {};

  if (params?.status) {
    where.status = params.status;
  }

  if (params?.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { id: { equals: q } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
      { notes: { contains: q, mode: "insensitive" } },
      { reason: { contains: q, mode: "insensitive" } },
    ];
  }

  const returns = await prisma.return.findMany({
    where,
    orderBy: { returnedAt: "desc" },
    include: {
      customer: { select: { name: true } },
      createdBy: { select: { name: true } },
      inspectedBy: { select: { name: true } },
      items: true,
    },
    take: 100,
  });

  return returns.map((r) => {
    const { saleId, invoiceNumber } = parseSaleRefFromNotes(r.notes);
    const totalCrates = r.items.reduce((acc, i) => acc + i.quantity, 0);
    const approvedCrates = r.items
      .filter((i) => i.inspectionResult === InspectionResult.APPROVED_FOR_STOCK)
      .reduce((acc, i) => acc + i.quantity, 0);

    return {
      id: r.id,
      returnedAt: r.returnedAt,
      status: r.status,
      reason: r.reason,
      invoiceNumber,
      saleId,
      customerId: r.customerId,
      customerName: r.customer?.name || "Anonymous",
      createdByName: r.createdBy.name,
      inspectedByName: r.inspectedBy?.name || null,
      inspectedAt: r.inspectedAt,
      totalCrates,
      approvedCrates,
    };
  });
}

/**
 * Returns full return voucher details with container movements and audit log history.
 */
export async function getReturnDetails(returnId: string): Promise<ReturnDetails | null> {
  const r = await prisma.return.findUnique({
    where: { id: returnId },
    include: {
      customer: { select: { name: true } },
      createdBy: { select: { name: true } },
      inspectedBy: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, brand: true } },
        },
      },
    },
  });

  if (!r) return null;

  const { saleId, invoiceNumber } = parseSaleRefFromNotes(r.notes);

  // Fetch Container Movements linked to this return
  const containerMoves = await prisma.containerMovement.findMany({
    where: { referenceId: r.id },
    orderBy: { createdAt: "asc" },
  });

  // Fetch Audit Logs
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "Return",
      entityId: r.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
    },
  });

  return {
    id: r.id,
    returnedAt: r.returnedAt,
    status: r.status,
    reason: r.reason,
    notes: r.notes,
    invoiceNumber,
    saleId,
    customerId: r.customerId,
    customerName: r.customer?.name || "Anonymous",
    createdByName: r.createdBy.name,
    inspectedByName: r.inspectedBy?.name || null,
    inspectedAt: r.inspectedAt,
    items: r.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      productBrand: i.product.brand,
      quantity: i.quantity,
      inspectionResult: i.inspectionResult,
      notes: i.notes,
    })),
    containerMovements: containerMoves.map((c) => ({
      id: c.id,
      containerType: c.containerType,
      movementType: c.movementType,
      quantity: c.quantity,
      notes: c.notes,
      createdAt: c.createdAt,
    })),
    auditLogs: auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      reason: a.reason,
      userName: a.user.name,
      createdAt: a.createdAt,
    })),
  };
}
