/**
 * Phase 3 Sync — Payment Domain Push Handlers
 *
 * Handles:
 *   - RECORD_PAYMENT: Atomically records a payment, updates Sale balance / Customer balance where applicable, audit log.
 */

import {
  PaymentMethod,
  SaleStatus,
  Prisma,
  type SyncDevice,
} from "@prisma/client";
import type { SyncOperation } from "@/lib/sync/types";
import {
  type TransactionClient,
  recordSyncChangeLog,
  resolveUserId,
} from "./common";

interface RecordPaymentPayload {
  customerId?: string | null;
  saleId?: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string | null;
  userId?: string;
  actorUserId?: string;
  paidAt?: string;
}

export async function handleRecordPayment(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<void> {
  const payload = operation.payload as unknown as RecordPaymentPayload;

  if (!payload || typeof payload.amount !== "number" || payload.amount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  if (!payload.customerId && !payload.saleId) {
    throw new Error("Payment must be linked to either a customer or a sale invoice.");
  }

  const userId = await resolveUserId(
    tx,
    payload.userId || payload.actorUserId,
    "recording payment"
  );

  // Validate customer if provided
  if (payload.customerId) {
    const customer = await tx.customer.findUnique({
      where: { id: payload.customerId },
    });
    if (!customer) {
      throw new Error("Customer not found.");
    }
    if (!customer.isActive) {
      throw new Error("Cannot record payment for an inactive customer.");
    }
  }

  // Validate sale and update its balance if provided
  let saleCustomerId = payload.customerId;
  if (payload.saleId) {
    const sale = await tx.sale.findUnique({
      where: { id: payload.saleId },
    });

    if (!sale) {
      throw new Error("Sale invoice not found.");
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new Error("Cannot record payment for a cancelled invoice.");
    }

    if (!saleCustomerId && sale.customerId) {
      saleCustomerId = sale.customerId;
    }

    const currentPaid = Number(sale.paidAmount);
    const totalAmount = Number(sale.totalAmount);
    const newPaid = Math.round((currentPaid + payload.amount) * 100) / 100;
    const newCredit = Math.max(0, Math.round((totalAmount - newPaid) * 100) / 100);

    await tx.sale.update({
      where: { id: sale.id },
      data: {
        paidAmount: new Prisma.Decimal(newPaid.toFixed(2)),
        creditAmount: new Prisma.Decimal(newCredit.toFixed(2)),
      },
    });
  }

  const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();

  // Create payment record
  const payment = await tx.payment.create({
    data: {
      id: operation.entityId,
      customerId: saleCustomerId || null,
      saleId: payload.saleId || null,
      amount: new Prisma.Decimal(payload.amount.toFixed(2)),
      paymentMethod: payload.paymentMethod || PaymentMethod.CASH,
      referenceNumber: payload.referenceNumber?.trim() || null,
      receivedById: userId,
      paidAt,
    },
  });

  // Audit Log
  await tx.auditLog.create({
    data: {
      userId,
      action: "RECORD_PAYMENT",
      entityType: "Payment",
      entityId: payment.id,
      deviceId: device.deviceId,
      newValues: {
        customerId: saleCustomerId,
        saleId: payload.saleId,
        amount: payload.amount.toFixed(2),
        paymentMethod: payload.paymentMethod,
        referenceNumber: payload.referenceNumber,
      },
      reason: `Payment of Rs. ${payload.amount.toFixed(2)} recorded via sync`,
    },
  });

  // SyncChangeLog
  await recordSyncChangeLog(tx, {
    operationId: operation.operationId,
    operationType: "RECORD_PAYMENT",
    entityId: payment.id,
    action: "UPSERT",
    payload: {
      id: payment.id,
      customerId: saleCustomerId || null,
      saleId: payload.saleId || null,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      referenceNumber: payload.referenceNumber || null,
      paidAt: paidAt.toISOString(),
    },
    sourceDeviceId: device.deviceId,
  });
}
