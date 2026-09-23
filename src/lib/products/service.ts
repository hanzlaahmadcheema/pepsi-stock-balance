import { prisma } from "@/lib/prisma";
import { PriceTier, Prisma } from "@prisma/client";

export { PriceTier };

/**
 * Calculates current on-hand stock for multiple products using immutable stock movements.
 */
export async function getProductStockMap(productIds: string[]): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  if (productIds.length === 0) {
    return stockMap;
  }

  for (const id of productIds) {
    stockMap.set(id, 0);
  }

  const movements = await prisma.stockMovement.groupBy({
    by: ["productId", "movementType"],
    where: { productId: { in: productIds } },
    _sum: { quantity: true },
  });

  for (const m of movements) {
    const qty = m._sum.quantity || 0;
    const current = stockMap.get(m.productId) || 0;
    if (
      m.movementType === "RECEIVING" ||
      m.movementType === "SALE_CANCELLATION" ||
      m.movementType === "RETURN_RESTOCK" ||
      m.movementType === "ADJUSTMENT_ADD"
    ) {
      stockMap.set(m.productId, current + Math.abs(qty));
    } else {
      stockMap.set(m.productId, current - Math.abs(qty));
    }
  }

  return stockMap;
}

/**
 * Calculates current stock for a single product.
 */
export async function getProductStock(productId: string): Promise<number> {
  const map = await getProductStockMap([productId]);
  return map.get(productId) || 0;
}

export type StaffProductListItem = {
  id: string;
  name: string;
  brand: string;
  sku: string | null;
  minimumStockLevel: number;
  isActive: boolean;
  currentStock: number;
  isLowStock: boolean;
  activePrices: {
    tier: PriceTier;
    amount: string;
  }[];
};

export type OwnerProductListItem = StaffProductListItem & {
  latestPurchasePrice: string;
};

/**
 * Lists products filtered by search query, with strict role-based data projection.
 */
export async function listProducts(
  searchTerm?: string,
  isOwner = false
): Promise<(StaffProductListItem | OwnerProductListItem)[]> {
  const trimmed = searchTerm?.trim();

  const whereClause: Prisma.ProductWhereInput = trimmed
    ? {
        OR: [
          { name: { contains: trimmed, mode: "insensitive" } },
          { brand: { contains: trimmed, mode: "insensitive" } },
        ],
      }
    : {};

  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      brand: true,
      sku: true,
      minimumStockLevel: true,
      isActive: true,
      ...(isOwner && { latestPurchasePrice: true }),
      prices: {
        where: { effectiveTo: null },
        select: {
          tier: true,
          amount: true,
        },
      },
    },
  });

  const productIds = products.map((p) => p.id);
  const stockMap = await getProductStockMap(productIds);

  return products.map((p) => {
    const currentStock = stockMap.get(p.id) || 0;
    const isLowStock = currentStock <= p.minimumStockLevel;

    const base: StaffProductListItem = {
      id: p.id,
      name: p.name,
      brand: p.brand,
      sku: p.sku,
      minimumStockLevel: p.minimumStockLevel,
      isActive: p.isActive,
      currentStock,
      isLowStock,
      activePrices: p.prices.map((pr) => ({
        tier: pr.tier,
        amount: pr.amount.toString(),
      })),
    };

    if (isOwner) {
      const ownerProduct = p as { latestPurchasePrice?: { toString(): string } };
      return {
        ...base,
        latestPurchasePrice: ownerProduct.latestPurchasePrice?.toString() ?? "0.00",
      };
    }

    return base;
  });
}

export type ProductDetails = {
  id: string;
  name: string;
  brand: string;
  sku: string | null;
  minimumStockLevel: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  currentStock: number;
  isLowStock: boolean;
  activePrices: {
    id: string;
    tier: PriceTier;
    amount: string;
    effectiveFrom: Date;
  }[];
  // Owner only fields:
  latestPurchasePrice?: string;
  priceHistory?: {
    id: string;
    tier: PriceTier;
    amount: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    createdByName: string;
  }[];
};

/**
 * Retrieves full details for a product, projecting fields based strictly on role.
 */
export async function getProductDetails(
  productId: string,
  isOwner = false
): Promise<ProductDetails | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      prices: {
        orderBy: { effectiveFrom: "desc" },
        include: {
          createdBy: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!product) {
    return null;
  }

  const currentStock = await getProductStock(productId);
  const isLowStock = currentStock <= product.minimumStockLevel;

  const activePrices = product.prices
    .filter((p) => p.effectiveTo === null)
    .map((p) => ({
      id: p.id,
      tier: p.tier,
      amount: p.amount.toString(),
      effectiveFrom: p.effectiveFrom,
    }));

  const priceHistory = product.prices.map((p) => ({
    id: p.id,
    tier: p.tier,
    amount: p.amount.toString(),
    effectiveFrom: p.effectiveFrom,
    effectiveTo: p.effectiveTo,
    createdByName: p.createdBy.name,
  }));

  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    sku: product.sku,
    minimumStockLevel: product.minimumStockLevel,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    currentStock,
    isLowStock,
    activePrices,
    priceHistory,
    ...(isOwner && {
      latestPurchasePrice: product.latestPurchasePrice.toString(),
    }),
  };
}

/**
 * Atomically updates a price tier for a product:
 * Closes currently active price by setting effectiveTo = now, and creates a new active price.
 * Never deletes historical prices.
 */
export async function updateProductPriceTransaction(
  productId: string,
  tier: PriceTier,
  amount: number,
  createdById: string
) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // 1. Close any currently active price for this product and tier
    await tx.price.updateMany({
      where: {
        productId,
        tier,
        effectiveTo: null,
      },
      data: {
        effectiveTo: now,
      },
    });

    // 2. Insert new active price
    const newPrice = await tx.price.create({
      data: {
        productId,
        tier,
        amount: new Prisma.Decimal(amount.toFixed(2)),
        effectiveFrom: now,
        effectiveTo: null,
        createdById,
      },
    });

    return newPrice;
  });
}
