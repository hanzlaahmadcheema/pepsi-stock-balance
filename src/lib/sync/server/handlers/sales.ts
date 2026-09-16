/**
 * Phase 3 Sync — Sales Domain Push Handlers
 *
 * Handles:
 *   - CREATE_SALE: Atomically commits full sale aggregate (Sale, SaleItems, Payment, StockMovements, ContainerMovements).
 *   - EDIT_SALE: Atomically reconciles final target state (replaces items, compensates stock, deletes 0 payment, audit log).
 *   - CANCEL_SALE: Atomically cancels invoice, reverses stock and container movements, audit log.
 */

import {
  SaleStatus,
  SaleType,
  PaymentMethod,
  MovementType,
  ContainerType,
  ContainerMovementType,
  Prisma,
  type SyncDevice,
} from "@prisma/client";
import type { SyncOperation } from "@/lib/sync/types";
import {
  type TransactionClient,
  recordSyncChangeLog,
  resolveUserId,
  getStockMapInTx,
  generateUniqueInvoiceNumber,
} from "./common";

interface SaleItemPayload {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface CreateSalePayload {
  invoiceNumber?: string;
  customerId?: string | null;
  saleType?: SaleType;
  items: SaleItemPayload[];
  discount?: number;
  paymentMethod?: PaymentMethod;
  paidAmount?: number;
  containers?: {
    plasticCrates?: number;
    glassBottles?: number;
  };
  userId?: string;
  actorUserId?: string;
  soldAt?: string;
}

interface EditSalePayload {
  reason: string;
  customerId?: string | null;
  saleType?: SaleType;
  items: SaleItemPayload[];
  discount?: number;
  paymentMethod?: PaymentMethod;
  paidAmount?: number;
  userId?: string;
  actorUserId?: string;
}

interface CancelSalePayload {
  reason: string;
  userId?: string;
  actorUserId?: string;
}

export async function handleCreateSale(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as CreateSalePayload;

  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Sale must contain at least one line item.");
  }

  const userId = await resolveUserId(
    tx,
    payload.userId || payload.actorUserId,
    "sale creation"
  );

  const productMap = new Map<string, SaleItemPayload>();
  for (const item of payload.items) {
    if (!item.productId || typeof item.productId !== "string") {
      throw new Error("Valid productId is required for each line item.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Quantity must be a positive whole number of full crates.");
    }
    if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
      throw new Error("Unit price cannot be negative.");
    }
    if (productMap.has(item.productId)) {
      throw new Error("Duplicate product found in line items.");
    }
    productMap.set(item.productId, item);
  }

  const discount = Math.max(0, payload.discount ?? 0);
  const paidAmount = Math.max(0, payload.paidAmount ?? 0);

  let subtotalCalc = 0;
  for (const item of payload.items) {
    subtotalCalc += item.quantity * item.unitPrice;
  }
  subtotalCalc = Math.round(subtotalCalc * 100) / 100;

  if (discount > subtotalCalc) {
    throw new Error("Discount cannot exceed subtotal.");
  }

  const totalAmountCalc = Math.round((subtotalCalc - discount) * 100) / 100;

  if (paidAmount > totalAmountCalc + 0.009) {
    throw new Error("Paid amount cannot exceed the total invoice amount.");
  }

  const creditAmountCalc = Math.max(0, Math.round((totalAmountCalc - paidAmount) * 100) / 100);

  if (creditAmountCalc > 0 && !payload.customerId) {
    throw new Error("Credit sales require selecting a registered Customer.");
  }

  const productIds = Array.from(productMap.keys()).sort();

  // 1. Concurrency control: Lock products in deterministic sorted order
  for (const pid of productIds) {
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${pid}::uuid FOR UPDATE`;
  }

  // 2. Fetch products and verify active
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

  // 3. Customer validation
  if (payload.customerId) {
    const customer = await tx.customer.findUnique({
      where: { id: payload.customerId },
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

  // 5. Determine invoice number — preserve originating depot's invoice number
  let invoiceNumber = payload.invoiceNumber?.trim();
  if (invoiceNumber) {
    const existingWithInvoice = await tx.sale.findUnique({
      where: { invoiceNumber },
      select: { id: true },
    });
    if (existingWithInvoice && existingWithInvoice.id !== operation.entityId) {
      throw new Error(
        `Invoice collision: Invoice number "${invoiceNumber}" is already in use by sale ${existingWithInvoice.id}.`
      );
    }
  } else {
    // If not provided in payload, generate device-prefixed invoice number to prevent collisions
    invoiceNumber = await generateUniqueInvoiceNumber(tx, device.deviceId);
  }

  const soldAt = payload.soldAt ? new Date(payload.soldAt) : new Date();

  // 6. Create Sale header
  await tx.sale.create({
    data: {
      id: operation.entityId,
      invoiceNumber,
      customerId: payload.customerId || null,
      saleType: payload.saleType || SaleType.RETAIL,
      status: SaleStatus.COMPLETED,
      subtotal: new Prisma.Decimal(subtotalCalc.toFixed(2)),
      discount: new Prisma.Decimal(discount.toFixed(2)),
      totalAmount: new Prisma.Decimal(totalAmountCalc.toFixed(2)),
      paidAmount: new Prisma.Decimal(paidAmount.toFixed(2)),
      creditAmount: new Prisma.Decimal(creditAmountCalc.toFixed(2)),
      soldAt,
      createdById: userId,
    },
  });

  // 7. Create SaleItems and immutable StockMovements
  const productRecordMap = new Map(products.map((p) => [p.id, p]));

  for (const item of payload.items) {
    const product = productRecordMap.get(item.productId)!;
    const itemTotal = new Prisma.Decimal((item.quantity * item.unitPrice).toFixed(2));

    await tx.saleItem.create({
      data: {
        saleId: operation.entityId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
        totalAmount: itemTotal,
        purchaseCostAtSale: product.latestPurchasePrice,
      },
    });

    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        movementType: MovementType.SALE,
        quantity: -Math.abs(item.quantity),
        referenceType: "Sale",
        referenceId: operation.entityId,
        notes: `Invoice #${invoiceNumber}`,
        createdById: userId,
      },
    });
  }

  // 8. Record initial payment if paidAmount > 0
  if (paidAmount > 0) {
    await tx.payment.create({
      data: {
        saleId: operation.entityId,
        customerId: payload.customerId || null,
        paymentMethod: payload.paymentMethod || PaymentMethod.CASH,
        amount: new Prisma.Decimal(paidAmount.toFixed(2)),
        referenceNumber: `Invoice #${invoiceNumber}`,
        receivedById: userId,
        paidAt: soldAt,
      },
    });
  }

  // 9. Container movements for named customer
  if (payload.customerId && payload.containers) {
    if (payload.containers.plasticCrates && payload.containers.plasticCrates > 0) {
      await tx.containerMovement.create({
        data: {
          customerId: payload.customerId,
          containerType: ContainerType.PLASTIC_CRATE,
          movementType: ContainerMovementType.DEBIT,
          quantity: payload.containers.plasticCrates,
          referenceId: operation.entityId,
          notes: `Plastic crates dispatched with Invoice #${invoiceNumber}`,
          createdById: userId,
        },
      });
    }

    if (payload.containers.glassBottles && payload.containers.glassBottles > 0) {
      await tx.containerMovement.create({
        data: {
          customerId: payload.customerId,
          containerType: ContainerType.GLASS_BOTTLE,
          movementType: ContainerMovementType.DEBIT,
          quantity: payload.containers.glassBottles,
          referenceId: operation.entityId,
          notes: `Glass bottles dispatched with Invoice #${invoiceNumber}`,
          createdById: userId,
        },
      });
    }
  }

  // 10. Write authoritative SyncChangeLog
  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "CREATE_SALE",
    entityId: operation.entityId,
    action: "UPSERT",
    payload: {
      id: operation.entityId,
      invoiceNumber,
      customerId: payload.customerId || null,
      saleType: payload.saleType || SaleType.RETAIL,
      status: SaleStatus.COMPLETED,
      subtotal: subtotalCalc,
      discount,
      totalAmount: totalAmountCalc,
      paidAmount,
      creditAmount: creditAmountCalc,
      items: payload.items,
      soldAt: soldAt.toISOString(),
    },
    sourceDeviceId: device.deviceId,
  });
}

export async function handleEditSale(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as EditSalePayload;

  const reason = payload.reason?.trim();
  if (!reason || reason.length < 3) {
    throw new Error("A mandatory reason (at least 3 characters) is required to edit an invoice.");
  }

  if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Sale must contain at least one line item.");
  }

  const userId = await resolveUserId(
    tx,
    payload.userId || payload.actorUserId,
    "sale editing"
  );

  const productMap = new Map<string, SaleItemPayload>();
  for (const item of payload.items) {
    if (!item.productId || typeof item.productId !== "string") {
      throw new Error("Valid productId is required for each line item.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Quantity must be a positive whole number of full crates.");
    }
    if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
      throw new Error("Unit price cannot be negative.");
    }
    if (productMap.has(item.productId)) {
      throw new Error("Duplicate product found in line items.");
    }
    productMap.set(item.productId, item);
  }

  const discount = Math.max(0, payload.discount ?? 0);
  const paidAmount = Math.max(0, payload.paidAmount ?? 0);

  let newSubtotal = 0;
  for (const item of payload.items) {
    newSubtotal += item.quantity * item.unitPrice;
  }
  newSubtotal = Math.round(newSubtotal * 100) / 100;

  if (discount > newSubtotal) {
    throw new Error("Discount cannot exceed subtotal.");
  }

  const newTotalAmount = Math.round((newSubtotal - discount) * 100) / 100;

  if (paidAmount > newTotalAmount + 0.009) {
    throw new Error("Paid amount cannot exceed the total invoice amount.");
  }

  const newCreditAmount = Math.max(0, Math.round((newTotalAmount - paidAmount) * 100) / 100);

  if (newCreditAmount > 0 && !payload.customerId) {
    throw new Error("Credit sales require selecting a registered Customer.");
  }

  // 1. Fetch existing sale
  const existingSale = await tx.sale.findUnique({
    where: { id: operation.entityId },
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

  // 4. Validate customer
  if (payload.customerId) {
    const customer = await tx.customer.findUnique({
      where: { id: payload.customerId },
    });
    if (!customer) throw new Error("Customer not found.");
    if (!customer.isActive) throw new Error("Cannot assign sale to an inactive customer.");
    if (newCreditAmount > 0 && !customer.creditAllowed) {
      throw new Error(`Customer "${customer.name}" is not approved for credit purchases.`);
    }
  }

  // 5. Concurrency stock check:
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
  for (const item of payload.items) {
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

  for (const item of payload.items) {
    const product = productRecordMap.get(item.productId)!;
    const itemTotal = new Prisma.Decimal((item.quantity * item.unitPrice).toFixed(2));

    await tx.saleItem.create({
      data: {
        saleId: existingSale.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
        totalAmount: itemTotal,
        purchaseCostAtSale: product.latestPurchasePrice,
      },
    });
  }

  // 9. Reconcile Payment
  const existingPayment = existingSale.payments.find((p) => p.saleId === existingSale.id);

  if (paidAmount > 0) {
    if (existingPayment) {
      await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          amount: new Prisma.Decimal(paidAmount.toFixed(2)),
          paymentMethod: payload.paymentMethod || PaymentMethod.CASH,
          customerId: payload.customerId || null,
        },
      });
    } else {
      await tx.payment.create({
        data: {
          saleId: existingSale.id,
          customerId: payload.customerId || null,
          paymentMethod: payload.paymentMethod || PaymentMethod.CASH,
          amount: new Prisma.Decimal(paidAmount.toFixed(2)),
          referenceNumber: `Invoice #${existingSale.invoiceNumber}`,
          receivedById: userId,
        },
      });
    }
  } else if (existingPayment) {
    // If paid amount was reduced to 0, remove the payment record
    await tx.payment.delete({
      where: { id: existingPayment.id },
    });
  }

  // 10. Update Sale header
  await tx.sale.update({
    where: { id: existingSale.id },
    data: {
      customerId: payload.customerId || null,
      saleType: payload.saleType || existingSale.saleType,
      subtotal: new Prisma.Decimal(newSubtotal.toFixed(2)),
      discount: new Prisma.Decimal(discount.toFixed(2)),
      totalAmount: new Prisma.Decimal(newTotalAmount.toFixed(2)),
      paidAmount: new Prisma.Decimal(paidAmount.toFixed(2)),
      creditAmount: new Prisma.Decimal(newCreditAmount.toFixed(2)),
      updatedById: userId,
    },
  });

  // 11. Immutable Audit Log
  await tx.auditLog.create({
    data: {
      userId,
      action: "EDIT_INVOICE",
      entityType: "Sale",
      entityId: existingSale.id,
      deviceId: device.deviceId,
      oldValues: {
        customerId: existingSale.customerId,
        totalAmount: existingSale.totalAmount.toString(),
        paidAmount: existingSale.paidAmount.toString(),
      },
      newValues: {
        customerId: payload.customerId,
        totalAmount: newTotalAmount.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        items: payload.items,
      } as unknown as Prisma.InputJsonValue,
      reason,
    },
  });

  // 12. Write SyncChangeLog
  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "EDIT_SALE",
    entityId: existingSale.id,
    action: "UPSERT",
    payload: {
      id: existingSale.id,
      invoiceNumber: existingSale.invoiceNumber,
      customerId: payload.customerId || null,
      subtotal: newSubtotal,
      discount,
      totalAmount: newTotalAmount,
      paidAmount,
      creditAmount: newCreditAmount,
      items: payload.items,
      reason,
    },
    sourceDeviceId: device.deviceId,
  });
}

export async function handleCancelSale(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as CancelSalePayload;

  const reason = payload.reason?.trim();
  if (!reason || reason.length < 3) {
    throw new Error("A mandatory reason (at least 3 characters) is required to cancel an invoice.");
  }

  const userId = await resolveUserId(
    tx,
    payload.userId || payload.actorUserId,
    "sale cancellation"
  );

  const sale = await tx.sale.findUnique({
    where: { id: operation.entityId },
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

  // 3. Reverse container movements if any
  const debitContainerMoves = await tx.containerMovement.findMany({
    where: {
      referenceId: sale.id,
      movementType: ContainerMovementType.DEBIT,
    },
  });

  for (const move of debitContainerMoves) {
    await tx.containerMovement.create({
      data: {
        customerId: move.customerId,
        containerType: move.containerType,
        movementType: ContainerMovementType.CREDIT,
        quantity: move.quantity,
        referenceId: sale.id,
        notes: `Reversal of containers for cancelled Inv #${sale.invoiceNumber}`,
        createdById: userId,
      },
    });
  }

  // 4. Mark sale as CANCELLED
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

  // 5. Create Audit Log
  await tx.auditLog.create({
    data: {
      userId,
      action: "CANCEL_INVOICE",
      entityType: "Sale",
      entityId: sale.id,
      deviceId: device.deviceId,
      oldValues: {
        status: sale.status,
        totalAmount: sale.totalAmount.toString(),
      },
      newValues: {
        status: SaleStatus.CANCELLED,
        cancellationReason: reason,
        cancelledAt: now.toISOString(),
      },
      reason,
    },
  });

  // 6. Write SyncChangeLog
  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "CANCEL_SALE",
    entityId: sale.id,
    action: "UPSERT",
    payload: {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      status: SaleStatus.CANCELLED,
      cancellationReason: reason,
      cancelledAt: now.toISOString(),
    },
    sourceDeviceId: device.deviceId,
  });
}
