import { MovementType, Prisma, PrismaClient, SaleStatus } from "@prisma/client";

type TxClient = PrismaClient | Prisma.TransactionClient;

export interface FifoCostResult {
  totalCost: number;
  unitCost: number;
  consumedBatches: {
    receivingItemId: string;
    quantityTaken: number;
    unitPurchasePrice: number;
  }[];
}

export interface FifoOptions {
  excludeSaleId?: string;
  saleDate?: Date;
  additionalPriorConsumed?: number;
  exactPriorConsumed?: number;
  cachedFallbackUnitCost?: number;
  cachedReceivingBatches?: {
    id: string;
    quantity: number;
    purchasePrice: Prisma.Decimal | number;
  }[];
}

/**
 * Calculates the exact FIFO acquisition cost for a quantity of a product being sold.
 * Consumes available inward inventory batches in chronological (First-In, First-Out) order.
 * If sold quantity exceeds available batches (e.g. baseline legacy stock), falls back to product.latestPurchasePrice.
 */
export async function calculateFifoCostForSaleItem(
  tx: TxClient,
  productId: string,
  quantityToSell: number,
  options?: FifoOptions
): Promise<FifoCostResult> {
  if (quantityToSell <= 0) {
    return { totalCost: 0, unitCost: 0, consumedBatches: [] };
  }

  // 1. Fetch product for fallback latestPurchasePrice
  let fallbackUnitCost = options?.cachedFallbackUnitCost;
  if (fallbackUnitCost === undefined) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { latestPurchasePrice: true },
    });
    fallbackUnitCost = Number(product?.latestPurchasePrice || 0);
  }

  // 2. Fetch inward receiving batches for this product in chronological order
  // If posted stock movements exist, only consider posted receivings.
  let receivingItems = options?.cachedReceivingBatches;
  if (!receivingItems) {
    const postedMovements = await tx.stockMovement.findMany({
      where: {
        productId,
        referenceType: "Receiving",
        movementType: MovementType.RECEIVING,
      },
      select: { referenceId: true },
      distinct: ["referenceId"],
    });

    const receivingWhere: Prisma.ReceivingItemWhereInput = { productId };
    if (postedMovements.length > 0) {
      const postedReceivingIds = postedMovements.map((m) => m.referenceId);
      receivingWhere.receivingId = { in: postedReceivingIds };
    }

    receivingItems = await tx.receivingItem.findMany({
      where: receivingWhere,
      include: {
        receiving: {
          select: {
            receivedAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { receiving: { receivedAt: "asc" } },
        { receiving: { createdAt: "asc" } },
        { id: "asc" },
      ],
    });
  }

  // If no receivings exist at all, use fallback latestPurchasePrice
  if (receivingItems.length === 0) {
    const totalCost = Math.round(quantityToSell * fallbackUnitCost * 100) / 100;
    return {
      totalCost,
      unitCost: fallbackUnitCost,
      consumedBatches: [],
    };
  }

  // 3. Query all completed prior sales for this product (unless exact prior count is supplied)
  let totalPriorSold = 0;
  if (options?.exactPriorConsumed !== undefined) {
    totalPriorSold = options.exactPriorConsumed;
  } else {
    const priorSaleItems = await tx.saleItem.findMany({
      where: {
        productId,
        sale: {
          status: SaleStatus.COMPLETED,
          ...(options?.excludeSaleId ? { id: { not: options.excludeSaleId } } : {}),
          ...(options?.saleDate ? { soldAt: { lt: options.saleDate } } : {}),
        },
      },
      select: {
        quantity: true,
      },
    });

    const totalPriorSoldFromDb = priorSaleItems.reduce((sum, item) => sum + item.quantity, 0);
    totalPriorSold = totalPriorSoldFromDb + (options?.additionalPriorConsumed || 0);
  }

  // 4. Walk through receiving batches and deduct prior sales
  let priorToSkip = totalPriorSold;
  const availableBatches: {
    id: string;
    availableQty: number;
    unitPrice: number;
  }[] = [];

  for (const item of receivingItems) {
    const batchQty = item.quantity;
    const unitPrice = Number(item.purchasePrice);

    if (priorToSkip >= batchQty) {
      priorToSkip -= batchQty;
      // This batch was entirely consumed by prior sales
      continue;
    }

    const unconsumedInBatch = batchQty - priorToSkip;
    priorToSkip = 0;

    if (unconsumedInBatch > 0) {
      availableBatches.push({
        id: item.id,
        availableQty: unconsumedInBatch,
        unitPrice,
      });
    }
  }

  // 5. Consume from available batches for the current sale
  let needed = quantityToSell;
  let totalCost = 0;
  const consumedBatches: FifoCostResult["consumedBatches"] = [];

  for (const batch of availableBatches) {
    if (needed <= 0) break;

    const take = Math.min(needed, batch.availableQty);
    totalCost += take * batch.unitPrice;
    needed -= take;
    consumedBatches.push({
      receivingItemId: batch.id,
      quantityTaken: take,
      unitPurchasePrice: batch.unitPrice,
    });
  }

  // 6. If needed quantity exceeds available receiving batches, use fallback latestPurchasePrice
  if (needed > 0) {
    totalCost += needed * fallbackUnitCost;
  }

  totalCost = Math.round(totalCost * 100) / 100;
  const unitCost = Math.round((totalCost / quantityToSell) * 100) / 100;

  return {
    totalCost,
    unitCost,
    consumedBatches,
  };
}

/**
 * Re-evaluates and synchronizes all historical sales using the FIFO cost model.
 * Safe, idempotent, and updates purchaseCostAtSale on each completed SaleItem.
 */
export async function recalculateAllSalesFifo(
  tx: TxClient,
  filterProductIds?: string[]
): Promise<{ updatedCount: number }> {
  const where: Prisma.SaleWhereInput = {
    status: SaleStatus.COMPLETED,
  };
  if (filterProductIds && filterProductIds.length > 0) {
    where.items = { some: { productId: { in: filterProductIds } } };
  }

  const completedSales = await tx.sale.findMany({
    where,
    orderBy: [
      { soldAt: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      items: {
        ...(filterProductIds && filterProductIds.length > 0
          ? { where: { productId: { in: filterProductIds } } }
          : {}),
        orderBy: { id: "asc" },
      },
    },
  });

  if (completedSales.length === 0) {
    return { updatedCount: 0 };
  }

  // Pre-fetch products and receiving batches for all distinct productIds in these sales
  const distinctProductIds = Array.from(
    new Set(completedSales.flatMap((s) => s.items.map((i) => i.productId)))
  );

  const productMap = new Map<string, number>();
  const receivingBatchMap = new Map<string, { id: string; quantity: number; purchasePrice: Prisma.Decimal }[]>();

  const products = await tx.product.findMany({
    where: { id: { in: distinctProductIds } },
    select: { id: true, latestPurchasePrice: true },
  });
  for (const p of products) {
    productMap.set(p.id, Number(p.latestPurchasePrice || 0));
  }

  const postedMovements = await tx.stockMovement.findMany({
    where: {
      productId: { in: distinctProductIds },
      referenceType: "Receiving",
      movementType: MovementType.RECEIVING,
    },
    select: { referenceId: true, productId: true },
  });

  const receivingWhere: Prisma.ReceivingItemWhereInput = {
    productId: { in: distinctProductIds },
  };
  if (postedMovements.length > 0) {
    receivingWhere.receivingId = { in: postedMovements.map((m) => m.referenceId) };
  }

  const allReceivingItems = await tx.receivingItem.findMany({
    where: receivingWhere,
    include: {
      receiving: {
        select: {
          receivedAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: [
      { receiving: { receivedAt: "asc" } },
      { receiving: { createdAt: "asc" } },
      { id: "asc" },
    ],
  });

  for (const rItem of allReceivingItems) {
    const list = receivingBatchMap.get(rItem.productId) || [];
    list.push(rItem);
    receivingBatchMap.set(rItem.productId, list);
  }

  const productConsumedMap = new Map<string, number>();
  let updatedCount = 0;

  for (const sale of completedSales) {
    for (const item of sale.items) {
      const priorConsumed = productConsumedMap.get(item.productId) || 0;
      const fifoResult = await calculateFifoCostForSaleItem(
        tx,
        item.productId,
        item.quantity,
        {
          exactPriorConsumed: priorConsumed,
          cachedFallbackUnitCost: productMap.get(item.productId) || 0,
          cachedReceivingBatches: receivingBatchMap.get(item.productId) || [],
        }
      );

      productConsumedMap.set(item.productId, priorConsumed + item.quantity);

      const newCost = new Prisma.Decimal(fifoResult.unitCost.toFixed(2));
      if (!item.purchaseCostAtSale.equals(newCost)) {
        await tx.saleItem.update({
          where: { id: item.id },
          data: { purchaseCostAtSale: newCost },
        });
        updatedCount++;
      }
    }
  }

  return { updatedCount };
}
