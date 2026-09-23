import { prisma } from "@/lib/prisma";
import {
  SaleStatus,
  SaleType,
  PaymentMethod,
  MovementType,
  ContainerType,
  ContainerMovementType,
  Prisma,
} from "@prisma/client";
import {
  calculateFifoCostForSaleItem,
  recalculateAllSalesFifo,
} from "@/lib/inventory/fifo";

export type SaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type CreateSaleInput = {
  customerId: string | null;
  saleType: SaleType;
  items: SaleItemInput[];
  discount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  containers?: {
    plasticCrates?: number;
    glassBottles?: number;
  };
};

export type EditSaleInput = {
  reason: string;
  customerId: string | null;
  saleType: SaleType;
  items: SaleItemInput[];
  discount: number;
  paymentMethod: PaymentMethod;
  paidAmount: number;
};

export type SaleSummaryItem = {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string | null;
  saleType: SaleType;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  creditAmount: number;
  soldAt: Date;
  createdByName: string;
  grossProfit?: number; // OWNER only
};

export type SaleDetailItem = {
  id: string;
  productId: string;
  productName: string;
  productBrand: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  purchaseCostAtSale?: number; // OWNER only
};

export type SalePaymentDetail = {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  paidAt: Date;
  receivedByName: string;
};

export type SaleAuditLogEntry = {
  id: string;
  action: string;
  reason: string;
  userName: string;
  createdAt: Date;
  oldValues: Prisma.JsonValue;
  newValues: Prisma.JsonValue;
};

export type SaleDetails = {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
    creditAllowed: boolean;
    outstandingBalance: number;
  } | null;
  saleType: SaleType;
  status: SaleStatus;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  creditAmount: number;
  soldAt: Date;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  createdByName: string;
  updatedByName: string | null;
  items: SaleDetailItem[];
  payments: SalePaymentDetail[];
  auditLogs: SaleAuditLogEntry[];
  grossProfit?: number; // OWNER only
  containers?: {
    plasticCrates: number;
    glassBottles: number;
  };
};

/**
 * Generates a unique invoice number: INV-YYYYMMDD-XXXX.
 */
export async function generateUniqueInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");

  for (let attempt = 0; attempt < 10; attempt++) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;

    const existing = await tx.sale.findUnique({
      where: { invoiceNumber },
      select: { id: true },
    });

    if (!existing) {
      return invoiceNumber;
    }
  }

  // Fallback with timestamp
  return `INV-${dateStr}-${Date.now().toString().slice(-4)}`;
}

/**
 * Calculates current on-hand stock for specified products inside a transaction.
 */
async function getStockMapInTx(
  tx: Prisma.TransactionClient,
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
      // SALE, ADJUSTMENT_SUB, DAMAGE_WRITEOFF fall through to subtract
    ) {
      stockMap.set(m.productId, current + Math.abs(qty));
    } else {
      stockMap.set(m.productId, current - Math.abs(qty));
    }
  }

  return stockMap;
}

/**
 * Creates a new sale atomically inside a Prisma transaction with concurrency locking,
 * stock validation, immutable stock movement recording, and payment creation.
 */
export async function createSaleTransaction(
  data: CreateSaleInput,
  userId: string
): Promise<{ saleId: string; invoiceNumber: string }> {
  // --- Input Validation ---
  if (!data.items || data.items.length === 0) {
    throw new Error("Sale must contain at least one item.");
  }

  const productMap = new Map<string, SaleItemInput>();
  for (const item of data.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Quantity must be a positive whole number of full crates.");
    }
    if (item.unitPrice < 0) {
      throw new Error("Unit price cannot be negative.");
    }
    if (productMap.has(item.productId)) {
      throw new Error("Duplicate product found in line items.");
    }
    productMap.set(item.productId, item);
  }

  if (data.discount < 0) {
    throw new Error("Discount cannot be negative.");
  }
  if (data.paidAmount < 0) {
    throw new Error("Paid amount cannot be negative.");
  }

  // Calculate totals server-side
  let subtotalCalc = 0;
  for (const item of data.items) {
    subtotalCalc += item.quantity * item.unitPrice;
  }
  subtotalCalc = Math.round(subtotalCalc * 100) / 100;

  if (data.discount > subtotalCalc) {
    throw new Error("Discount cannot exceed subtotal.");
  }

  const totalAmountCalc = Math.round((subtotalCalc - data.discount) * 100) / 100;

  if (data.paidAmount > totalAmountCalc + 0.009) {
    throw new Error("Paid amount cannot exceed the total invoice amount.");
  }

  const creditAmountCalc = Math.max(0, Math.round((totalAmountCalc - data.paidAmount) * 100) / 100);

  // Credit sale rule
  if (creditAmountCalc > 0 && !data.customerId) {
    throw new Error("Credit sales require selecting a registered Customer.");
  }

  const productIds = Array.from(productMap.keys()).sort();

  return prisma.$transaction(async (tx) => {
    // 1. Concurrency control: Lock products in deterministic sorted order
    for (const pid of productIds) {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${pid}::uuid FOR UPDATE`;
    }

    // 2. Fetch products and verify active status
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        isActive: true,
        latestPurchasePrice: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new Error("One or more selected products do not exist.");
    }

    for (const p of products) {
      if (!p.isActive) {
        throw new Error(`Product "${p.name}" is inactive and cannot be sold.`);
      }
    }

    // 3. Customer validation if specified
    if (data.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: data.customerId },
      });
      if (!customer) {
        throw new Error("Customer not found.");
      }
      if (!customer.isActive) {
        throw new Error("Cannot issue sales to an inactive customer.");
      }
      if (creditAmountCalc > 0 && !customer.creditAllowed) {
        throw new Error(`Customer "${customer.name}" is not approved for credit purchases.`);
      }
    }

    // 4. Stock validation
    const currentStockMap = await getStockMapInTx(tx, productIds);
    for (const p of products) {
      const available = currentStockMap.get(p.id) || 0;
      const requested = productMap.get(p.id)!.quantity;
      if (requested > available) {
        throw new Error(
          `Insufficient stock for "${p.name}". Requested: ${requested} crates, Available: ${available} crates.`
        );
      }
    }

    // 5. Generate unique invoice number
    const invoiceNumber = await generateUniqueInvoiceNumber(tx);

    // 6. Create Sale record
    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        customerId: data.customerId,
        saleType: data.saleType,
        status: SaleStatus.COMPLETED,
        subtotal: new Prisma.Decimal(subtotalCalc.toFixed(2)),
        discount: new Prisma.Decimal(data.discount.toFixed(2)),
        totalAmount: new Prisma.Decimal(totalAmountCalc.toFixed(2)),
        paidAmount: new Prisma.Decimal(data.paidAmount.toFixed(2)),
        creditAmount: new Prisma.Decimal(creditAmountCalc.toFixed(2)),
        createdById: userId,
      },
    });

    // 7. Create SaleItems and immutable StockMovements
    const productRecordMap = new Map(products.map((p) => [p.id, p]));
    const inTxConsumedMap = new Map<string, number>();

    for (const item of data.items) {
      const product = productRecordMap.get(item.productId)!;
      const itemTotal = new Prisma.Decimal((item.quantity * item.unitPrice).toFixed(2));
      const priorConsumedInTx = inTxConsumedMap.get(item.productId) || 0;

      const fifoResult = await calculateFifoCostForSaleItem(
        tx,
        item.productId,
        item.quantity,
        {
          additionalPriorConsumed: priorConsumedInTx,
        }
      );
      inTxConsumedMap.set(item.productId, priorConsumedInTx + item.quantity);

      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          totalAmount: itemTotal,
          purchaseCostAtSale: new Prisma.Decimal(fifoResult.unitCost.toFixed(2)),
        },
      });

      // Immutable stock movement with negative quantity
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          movementType: MovementType.SALE,
          quantity: -Math.abs(item.quantity),
          referenceType: "Sale",
          referenceId: sale.id,
          notes: `Invoice #${invoiceNumber}`,
          createdById: userId,
        },
      });
    }

    // 8. Record initial payment if paidAmount > 0
    if (data.paidAmount > 0) {
      await tx.payment.create({
        data: {
          saleId: sale.id,
          customerId: data.customerId,
          paymentMethod: data.paymentMethod,
          amount: new Prisma.Decimal(data.paidAmount.toFixed(2)),
          referenceNumber: `Invoice #${invoiceNumber}`,
          receivedById: userId,
        },
      });
    }

    // 9. Container ledger DEBIT — only for named-customer sales, not anonymous
    if (data.customerId && data.containers) {
      if (data.containers.plasticCrates && data.containers.plasticCrates > 0) {
        await tx.containerMovement.create({
          data: {
            customerId: data.customerId,
            containerType: ContainerType.PLASTIC_CRATE,
            movementType: ContainerMovementType.DEBIT,
            quantity: data.containers.plasticCrates,
            referenceId: sale.id,
            notes: `Plastic crates dispatched with Invoice #${invoiceNumber}`,
            createdById: userId,
          },
        });
      }
      if (data.containers.glassBottles && data.containers.glassBottles > 0) {
        await tx.containerMovement.create({
          data: {
            customerId: data.customerId,
            containerType: ContainerType.GLASS_BOTTLE,
            movementType: ContainerMovementType.DEBIT,
            quantity: data.containers.glassBottles,
            referenceId: sale.id,
            notes: `Glass bottles dispatched with Invoice #${invoiceNumber}`,
            createdById: userId,
          },
        });
      }
    }

    return { saleId: sale.id, invoiceNumber };
  }, { timeout: 15000, maxWait: 5000 });
}

/**
 * Edits a completed sale atomically:
 * Reverses previous stock movements, applies new movements, updates SaleItem records,
 * recalculates totals, updates payments, preserves invoiceNumber, and writes an AuditLog.
 */
export async function editSaleTransaction(
  saleId: string,
  data: EditSaleInput,
  userId: string
): Promise<{ saleId: string; invoiceNumber: string }> {
  const reason = data.reason?.trim();
  if (!reason || reason.length < 3) {
    throw new Error("A mandatory reason (at least 3 characters) is required to edit an invoice.");
  }

  if (!data.items || data.items.length === 0) {
    throw new Error("Sale must contain at least one item.");
  }

  const productMap = new Map<string, SaleItemInput>();
  for (const item of data.items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Quantity must be a positive whole number of full crates.");
    }
    if (item.unitPrice < 0) {
      throw new Error("Unit price cannot be negative.");
    }
    if (productMap.has(item.productId)) {
      throw new Error("Duplicate product found in line items.");
    }
    productMap.set(item.productId, item);
  }

  if (data.discount < 0) {
    throw new Error("Discount cannot be negative.");
  }
  if (data.paidAmount < 0) {
    throw new Error("Paid amount cannot be negative.");
  }

  // Calculate new totals
  let newSubtotal = 0;
  for (const item of data.items) {
    newSubtotal += item.quantity * item.unitPrice;
  }
  newSubtotal = Math.round(newSubtotal * 100) / 100;

  if (data.discount > newSubtotal) {
    throw new Error("Discount cannot exceed subtotal.");
  }

  const newTotalAmount = Math.round((newSubtotal - data.discount) * 100) / 100;

  if (data.paidAmount > newTotalAmount + 0.009) {
    throw new Error("Paid amount cannot exceed the total invoice amount.");
  }

  const newCreditAmount = Math.max(0, Math.round((newTotalAmount - data.paidAmount) * 100) / 100);

  if (newCreditAmount > 0 && !data.customerId) {
    throw new Error("Credit sales require selecting a registered Customer.");
  }

  return prisma.$transaction(async (tx) => {
    // 1. Fetch existing sale
    const existingSale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        payments: true,
        customer: true,
      },
    });

    if (!existingSale) {
      throw new Error("Invoice not found.");
    }

    if (existingSale.status === SaleStatus.CANCELLED) {
      throw new Error("Cancelled invoices cannot be edited.");
    }

    // 2. Lock all products (both old and new) in deterministic order
    const oldProductIds = existingSale.items.map((i) => i.productId);
    const newProductIds = Array.from(productMap.keys());
    const allProductIds = Array.from(new Set([...oldProductIds, ...newProductIds])).sort();

    for (const pid of allProductIds) {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${pid}::uuid FOR UPDATE`;
    }

    // 3. Fetch products information
    const products = await tx.product.findMany({
      where: { id: { in: allProductIds } },
      select: {
        id: true,
        name: true,
        isActive: true,
        latestPurchasePrice: true,
      },
    });

    const productRecordMap = new Map(products.map((p) => [p.id, p]));

    for (const newPid of newProductIds) {
      const p = productRecordMap.get(newPid);
      if (!p) throw new Error("Selected product not found.");
      if (!p.isActive) {
        throw new Error(`Product "${p.name}" is inactive and cannot be sold.`);
      }
    }

    // 4. Validate customer if changing / credit
    if (data.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: data.customerId },
      });
      if (!customer) throw new Error("Customer not found.");
      if (!customer.isActive) throw new Error("Cannot assign sale to an inactive customer.");
      if (newCreditAmount > 0 && !customer.creditAllowed) {
        throw new Error(`Customer "${customer.name}" is not approved for credit purchases.`);
      }
    }

    // 5. Concurrency stock check:
    // Current stock already includes previous sale deduction.
    // So effective available for product = currentStock + previousQuantitySoldInThisSale
    const currentStockMap = await getStockMapInTx(tx, allProductIds);
    const oldQtyMap = new Map<string, number>();
    for (const oldItem of existingSale.items) {
      oldQtyMap.set(oldItem.productId, (oldQtyMap.get(oldItem.productId) || 0) + oldItem.quantity);
    }

    for (const [pid, newItem] of productMap.entries()) {
      const current = currentStockMap.get(pid) || 0;
      const previouslySold = oldQtyMap.get(pid) || 0;
      const effectiveAvailable = current + previouslySold;
      if (newItem.quantity > effectiveAvailable) {
        const p = productRecordMap.get(pid)!;
        throw new Error(
          `Insufficient stock for "${p.name}". Requested: ${newItem.quantity} crates, Available: ${effectiveAvailable} crates.`
        );
      }
    }

    // 6. Reverse old stock movements by creating compensation movements
    for (const oldItem of existingSale.items) {
      await tx.stockMovement.create({
        data: {
          productId: oldItem.productId,
          movementType: MovementType.SALE_CANCELLATION,
          quantity: oldItem.quantity,
          referenceType: "Sale",
          referenceId: existingSale.id,
          notes: `Reversal for edit of Inv #${existingSale.invoiceNumber}: ${reason}`,
          createdById: userId,
        },
      });
    }

    // 7. Apply new stock movements
    for (const item of data.items) {
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          movementType: MovementType.SALE,
          quantity: -Math.abs(item.quantity),
          referenceType: "Sale",
          referenceId: existingSale.id,
          notes: `Updated sale for Inv #${existingSale.invoiceNumber}: ${reason}`,
          createdById: userId,
        },
      });
    }

    // 8. Replace SaleItems
    await tx.saleItem.deleteMany({
      where: { saleId: existingSale.id },
    });

    const inTxConsumedMap = new Map<string, number>();

    for (const item of data.items) {
      const product = productRecordMap.get(item.productId)!;
      const itemTotal = new Prisma.Decimal((item.quantity * item.unitPrice).toFixed(2));
      const priorConsumedInTx = inTxConsumedMap.get(item.productId) || 0;

      const fifoResult = await calculateFifoCostForSaleItem(
        tx,
        item.productId,
        item.quantity,
        {
          excludeSaleId: existingSale.id,
          additionalPriorConsumed: priorConsumedInTx,
        }
      );
      inTxConsumedMap.set(item.productId, priorConsumedInTx + item.quantity);

      await tx.saleItem.create({
        data: {
          saleId: existingSale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
          totalAmount: itemTotal,
          purchaseCostAtSale: new Prisma.Decimal(fifoResult.unitCost.toFixed(2)),
        },
      });
    }

    // 9. Update Payment tied to this sale
    const existingPayment = existingSale.payments.find((p) => p.saleId === existingSale.id);

    if (data.paidAmount > 0) {
      if (existingPayment) {
        await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            amount: new Prisma.Decimal(data.paidAmount.toFixed(2)),
            paymentMethod: data.paymentMethod,
            customerId: data.customerId,
          },
        });
      } else {
        await tx.payment.create({
          data: {
            saleId: existingSale.id,
            customerId: data.customerId,
            paymentMethod: data.paymentMethod,
            amount: new Prisma.Decimal(data.paidAmount.toFixed(2)),
            referenceNumber: `Invoice #${existingSale.invoiceNumber}`,
            receivedById: userId,
          },
        });
      }
    } else if (existingPayment) {
      // If paid amount was edited down to 0, delete the sale payment
      await tx.payment.delete({
        where: { id: existingPayment.id },
      });
    }

    // 10. Update the Sale header (keeping invoiceNumber intact!)
    await tx.sale.update({
      where: { id: existingSale.id },
      data: {
        customerId: data.customerId,
        saleType: data.saleType,
        subtotal: new Prisma.Decimal(newSubtotal.toFixed(2)),
        discount: new Prisma.Decimal(data.discount.toFixed(2)),
        totalAmount: new Prisma.Decimal(newTotalAmount.toFixed(2)),
        paidAmount: new Prisma.Decimal(data.paidAmount.toFixed(2)),
        creditAmount: new Prisma.Decimal(newCreditAmount.toFixed(2)),
        updatedById: userId,
      },
    });

    // 11. Create immutable AuditLog
    const oldValues = {
      customerId: existingSale.customerId,
      saleType: existingSale.saleType,
      subtotal: existingSale.subtotal.toString(),
      discount: existingSale.discount.toString(),
      totalAmount: existingSale.totalAmount.toString(),
      paidAmount: existingSale.paidAmount.toString(),
      creditAmount: existingSale.creditAmount.toString(),
      items: existingSale.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toString(),
        totalAmount: i.totalAmount.toString(),
      })),
      payment: existingPayment
        ? {
            amount: existingPayment.amount.toString(),
            paymentMethod: existingPayment.paymentMethod,
          }
        : null,
    };

    const newValues = {
      customerId: data.customerId,
      saleType: data.saleType,
      subtotal: newSubtotal.toFixed(2),
      discount: data.discount.toFixed(2),
      totalAmount: newTotalAmount.toFixed(2),
      paidAmount: data.paidAmount.toFixed(2),
      creditAmount: newCreditAmount.toFixed(2),
      items: data.items,
      payment:
        data.paidAmount > 0
          ? {
              amount: data.paidAmount.toFixed(2),
              paymentMethod: data.paymentMethod,
            }
          : null,
    };

    await tx.auditLog.create({
      data: {
        userId,
        action: "EDIT_INVOICE",
        entityType: "Sale",
        entityId: existingSale.id,
        oldValues,
        newValues,
        reason,
      },
    });

    // Reconcile FIFO acquisition costs across all completed sales in case batch allocation shifted
    await recalculateAllSalesFifo(tx);

    return { saleId: existingSale.id, invoiceNumber: existingSale.invoiceNumber };
  }, { timeout: 20000, maxWait: 5000 });
}

/**
 * Cancels a completed sale atomically:
 * Reverses stock movements with SALE_CANCELLATION, updates Sale.status to CANCELLED,
 * records mandatory cancellation reason and timestamp, preserves invoiceNumber, and writes an AuditLog.
 */
export async function cancelSaleTransaction(
  saleId: string,
  reasonInput: string,
  userId: string
): Promise<{ saleId: string; invoiceNumber: string }> {
  const reason = reasonInput?.trim();
  if (!reason || reason.length < 3) {
    throw new Error("A mandatory reason (at least 3 characters) is required to cancel an invoice.");
  }

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!sale) {
      throw new Error("Invoice not found.");
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new Error("Invoice is already cancelled.");
    }

    // 1. Lock products
    const productIds = sale.items.map((i) => i.productId).sort();
    for (const pid of productIds) {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${pid}::uuid FOR UPDATE`;
    }

    // 2. Reverse stock movements
    for (const item of sale.items) {
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          movementType: MovementType.SALE_CANCELLATION,
          quantity: item.quantity,
          referenceType: "Sale",
          referenceId: sale.id,
          notes: `Cancellation of Inv #${sale.invoiceNumber}: ${reason}`,
          createdById: userId,
        },
      });
    }

    // 3. Mark sale as CANCELLED
    const now = new Date();
    await tx.sale.update({
      where: { id: sale.id },
      data: {
        status: SaleStatus.CANCELLED,
        cancellationReason: reason,
        cancelledAt: now,
        updatedById: userId,
      },
    });

    // 4. Create Audit Log
    const oldValues = {
      status: sale.status,
      totalAmount: sale.totalAmount.toString(),
      paidAmount: sale.paidAmount.toString(),
      creditAmount: sale.creditAmount.toString(),
      items: sale.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice.toString(),
      })),
    };

    const newValues = {
      status: SaleStatus.CANCELLED,
      cancellationReason: reason,
      cancelledAt: now.toISOString(),
    };

    await tx.auditLog.create({
      data: {
        userId,
        action: "CANCEL_INVOICE",
        entityType: "Sale",
        entityId: sale.id,
        oldValues,
        newValues,
        reason,
      },
    });

    // Reconcile FIFO acquisition costs as cancelled batches are released back
    await recalculateAllSalesFifo(tx);

    return { saleId: sale.id, invoiceNumber: sale.invoiceNumber };
  }, { timeout: 20000, maxWait: 5000 });
}

/**
 * Lists sales with role-based redaction (hides purchase cost and profit from STAFF).
 */
export async function listSales(
  params: {
    search?: string;
    status?: SaleStatus;
    startDate?: string;
    endDate?: string;
  },
  isOwner = false
): Promise<SaleSummaryItem[]> {
  const where: Prisma.SaleWhereInput = {};

  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { customer: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.startDate || params.endDate) {
    where.soldAt = {};
    if (params.startDate) {
      where.soldAt.gte = new Date(params.startDate);
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      where.soldAt.lte = end;
    }
  }

  const sales = await prisma.sale.findMany({
    where,
    orderBy: { soldAt: "desc" },
    include: {
      customer: { select: { name: true } },
      createdBy: { select: { name: true } },
      ...(isOwner && {
        items: {
          select: {
            quantity: true,
            purchaseCostAtSale: true,
          },
        },
      }),
    },
    take: 100,
  });

  return sales.map((s) => {
    let grossProfit: number | undefined = undefined;

    if (isOwner && s.items && s.status === SaleStatus.COMPLETED) {
      const totalCost = s.items.reduce(
        (acc, item) => acc + item.quantity * Number(item.purchaseCostAtSale),
        0
      );
      grossProfit = Math.round((Number(s.totalAmount) - totalCost) * 100) / 100;
    }

    return {
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      customerId: s.customerId,
      customerName: s.customer?.name || "Anonymous",
      saleType: s.saleType,
      status: s.status,
      subtotal: Number(s.subtotal),
      discount: Number(s.discount),
      totalAmount: Number(s.totalAmount),
      paidAmount: Number(s.paidAmount),
      creditAmount: Number(s.creditAmount),
      soldAt: s.soldAt,
      createdByName: s.createdBy.name,
      grossProfit,
    };
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Fetches sale details with complete role-based redaction and audit history.
 */
export async function getSaleDetails(saleId: string, isOwner = false): Promise<SaleDetails | null> {
  if (!saleId || !UUID_REGEX.test(saleId)) {
    return null;
  }

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: {
        include: {
          sales: {
            where: { status: SaleStatus.COMPLETED },
            select: { totalAmount: true },
          },
          payments: {
            where: {
              OR: [
                { saleId: null },
                {
                  sale: {
                    status: SaleStatus.COMPLETED,
                  },
                },
              ],
            },
            select: { amount: true },
          },
        },
      },
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      items: {
        include: {
          product: {
            select: {
              name: true,
              brand: true,
            },
          },
        },
      },
      payments: {
        orderBy: { paidAt: "desc" },
        include: {
          receivedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!sale) {
    return null;
  }

  // Fetch Audit Logs for this Sale
  const rawAuditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "Sale",
      entityId: sale.id,
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true } },
    },
  });

  const auditLogs: SaleAuditLogEntry[] = rawAuditLogs.map((a) => ({
    id: a.id,
    action: a.action,
    reason: a.reason,
    userName: a.user.name,
    createdAt: a.createdAt,
    oldValues: a.oldValues,
    newValues: a.newValues,
  }));

  let customerData = null;
  if (sale.customer) {
    const totalBilled = sale.customer.sales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
    const totalPaid = sale.customer.payments.reduce((acc, p) => acc + Number(p.amount), 0);
    const outstandingBalance = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

    customerData = {
      id: sale.customer.id,
      name: sale.customer.name,
      phone: sale.customer.phone,
      address: sale.customer.address,
      creditAllowed: sale.customer.creditAllowed,
      outstandingBalance,
    };
  }

  // Items projection with confidential purchase-cost protection
  const items: SaleDetailItem[] = sale.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    productName: i.product.name,
    productBrand: i.product.brand,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    totalAmount: Number(i.totalAmount),
    ...(isOwner && { purchaseCostAtSale: Number(i.purchaseCostAtSale) }),
  }));

  const payments: SalePaymentDetail[] = sale.payments.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    paymentMethod: p.paymentMethod,
    referenceNumber: p.referenceNumber,
    paidAt: p.paidAt,
    receivedByName: p.receivedBy.name,
  }));

  let grossProfit: number | undefined = undefined;
  if (isOwner && sale.status === SaleStatus.COMPLETED) {
    const totalCost = sale.items.reduce(
      (acc, item) => acc + item.quantity * Number(item.purchaseCostAtSale),
      0
    );
    grossProfit = Math.round((Number(sale.totalAmount) - totalCost) * 100) / 100;
  }

  // Fetch optional container movements recorded with this sale
  const containerMovements = await prisma.containerMovement.findMany({
    where: { referenceId: sale.id },
    select: {
      containerType: true,
      quantity: true,
    },
  });

  let containers: { plasticCrates: number; glassBottles: number } | undefined = undefined;
  if (containerMovements.length > 0) {
    let plastic = 0;
    let glass = 0;
    for (const cm of containerMovements) {
      if (cm.containerType === "PLASTIC_CRATE") plastic += cm.quantity;
      if (cm.containerType === "GLASS_BOTTLE") glass += cm.quantity;
    }
    if (plastic > 0 || glass > 0) {
      containers = { plasticCrates: plastic, glassBottles: glass };
    }
  }

  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerId: sale.customerId,
    customer: customerData,
    saleType: sale.saleType,
    status: sale.status,
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    totalAmount: Number(sale.totalAmount),
    paidAmount: Number(sale.paidAmount),
    creditAmount: Number(sale.creditAmount),
    soldAt: sale.soldAt,
    cancellationReason: sale.cancellationReason,
    cancelledAt: sale.cancelledAt,
    createdByName: sale.createdBy.name,
    updatedByName: sale.updatedBy?.name || null,
    items,
    payments,
    auditLogs,
    grossProfit,
    containers,
  };
}
