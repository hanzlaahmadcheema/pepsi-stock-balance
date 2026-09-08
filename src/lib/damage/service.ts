import { prisma } from "@/lib/prisma";
import { DamageType, MovementType, Prisma } from "@prisma/client";

export type RecordDamageInput = {
  productId: string;
  quantity: number;
  damageType: DamageType;
  reason?: string;
  notes?: string;
  userId: string;
};

export type DamageRecordSummary = {
  id: string;
  productId: string;
  productName: string;
  productBrand: string;
  quantity: number;
  damageType: DamageType;
  reason: string | null;
  notes: string | null;
  recordedAt: Date;
  recordedByName: string;
};

export type ListDamageParams = {
  startDate?: string | null;
  endDate?: string | null;
  productId?: string | null;
  damageType?: string | null;
  page?: number;
  limit?: number;
};

export type DamageListResult = {
  records: DamageRecordSummary[];
  totalRecords: number;
  totalCratesDamaged: number;
  pagination: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

/**
 * Atomically records a damage/expiry write-off:
 * 1. Validates integer positive quantity.
 * 2. Fetches current stock inside transaction and verifies sufficiency.
 * 3. Creates DamageRecord.
 * 4. Creates immutable StockMovement (DAMAGE_WRITEOFF) — negative quantity.
 */
export async function recordDamage(input: RecordDamageInput): Promise<{ damageRecordId: string }> {
  const { productId, quantity, damageType, reason, notes, userId } = input;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("Quantity must be a positive whole number of crates.");
  }

  return prisma.$transaction(
    async (tx) => {
      // Concurrency lock on product row
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId}::uuid FOR UPDATE`;

      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, isActive: true },
      });

      if (!product) {
        throw new Error("Product not found.");
      }
      if (!product.isActive) {
        throw new Error(`Product "${product.name}" is inactive.`);
      }

      // Compute authoritative current stock
      const movements = await tx.stockMovement.groupBy({
        by: ["productId", "movementType"],
        where: { productId },
        _sum: { quantity: true },
      });

      let currentStock = 0;
      for (const m of movements) {
        const qty = m._sum.quantity || 0;
        const isAdd =
          m.movementType === MovementType.RECEIVING ||
          m.movementType === MovementType.SALE_CANCELLATION ||
          m.movementType === MovementType.RETURN_RESTOCK ||
          m.movementType === MovementType.ADJUSTMENT_ADD;
        currentStock += isAdd ? Math.abs(qty) : -Math.abs(qty);
      }

      if (quantity > currentStock) {
        throw new Error(
          `Insufficient stock for "${product.name}". Requested: ${quantity} crates, Available: ${currentStock} crates.`
        );
      }

      // Create DamageRecord
      const damageRecord = await tx.damageRecord.create({
        data: {
          productId,
          quantity,
          damageType,
          reason: reason?.trim() || null,
          notes: notes?.trim() || null,
          recordedById: userId,
        },
      });

      // Create immutable StockMovement (negative quantity = stock reduction)
      await tx.stockMovement.create({
        data: {
          productId,
          movementType: MovementType.DAMAGE_WRITEOFF,
          quantity: -Math.abs(quantity),
          referenceType: "DamageRecord",
          referenceId: damageRecord.id,
          notes: `Damage write-off: ${damageType}${reason ? ` — ${reason.trim()}` : ""}`,
          createdById: userId,
        },
      });

      return { damageRecordId: damageRecord.id };
    },
    { timeout: 15000, maxWait: 5000 }
  );
}

/**
 * Lists damage records with pagination.
 */
export async function listDamageRecords(params: ListDamageParams): Promise<DamageListResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(10, Math.min(100, params.limit || 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.DamageRecordWhereInput = {};

  if (params.startDate) {
    const start = new Date(params.startDate);
    start.setHours(0, 0, 0, 0);
    whereClause.recordedAt = { ...((whereClause.recordedAt as object) || {}), gte: start };
  }
  if (params.endDate) {
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);
    whereClause.recordedAt = { ...((whereClause.recordedAt as object) || {}), lte: end };
  }
  if (params.productId) {
    whereClause.productId = params.productId;
  }
  if (params.damageType && Object.values(DamageType).includes(params.damageType as DamageType)) {
    whereClause.damageType = params.damageType as DamageType;
  }

  const [totalCount, records] = await Promise.all([
    prisma.damageRecord.count({ where: whereClause }),
    prisma.damageRecord.findMany({
      where: whereClause,
      orderBy: { recordedAt: "desc" },
      skip,
      take: limit,
      include: {
        product: { select: { name: true, brand: true } },
        recordedBy: { select: { name: true } },
      },
    }),
  ]);

  // Aggregate total crates damaged across all matching records
  const aggResult = await prisma.damageRecord.aggregate({
    where: whereClause,
    _sum: { quantity: true },
  });
  const totalCratesDamaged = aggResult._sum.quantity || 0;

  return {
    records: records.map((r) => ({
      id: r.id,
      productId: r.productId,
      productName: r.product.name,
      productBrand: r.product.brand,
      quantity: r.quantity,
      damageType: r.damageType,
      reason: r.reason,
      notes: r.notes,
      recordedAt: r.recordedAt,
      recordedByName: r.recordedBy.name,
    })),
    totalRecords: totalCount,
    totalCratesDamaged,
    pagination: {
      totalRecords: totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      currentPage: page,
      limit,
    },
  };
}
