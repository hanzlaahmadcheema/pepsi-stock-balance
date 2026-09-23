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
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { latestPurchasePrice: true },
  });
  const fallbackUnitCost = Number(product?.latestPurchasePrice || 0);

  // 2. Fetch inward receiving batches for this product in chronological order
  // If posted stock movements exist, only consider posted receivings.
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

  const receivingItems = await tx.receivingItem.findMany({
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
export async function recalculateAllSalesFifo(tx: TxClient): Promise<{ updatedCount: number }> {
  const completedSales = await tx.sale.findMany({
    where: { status: SaleStatus.COMPLETED },
    orderBy: [
      { soldAt: "asc" },
      { createdAt: "asc" },
    ],
    include: {
      items: {
        orderBy: { id: "asc" },
      },
    },
  });

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
