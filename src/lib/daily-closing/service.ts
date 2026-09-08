import { prisma } from "@/lib/prisma";
import {
  DailyClosingStatus,
  AdjustmentStatus,
  SaleStatus,
  PaymentMethod,
  Prisma,
} from "@prisma/client";

export type DailyClosingStockCountStatus =
  | "not_started"
  | "in_progress"
  | "pending_adjustments"
  | "ready"
  | "completed";

export type DailyClosingSummary = {
  businessDate: string; // YYYY-MM-DD
  businessDateObj: Date;
  closing: {
    id: string;
    status: DailyClosingStatus;
    stockVerified: boolean;
    physicalCash: number;
    cashDifference: number;
    notes: string | null;
    closedByName: string;
    closedAt: Date | null;
  } | null;
  sales: {
    completedSalesCount: number;
    cancelledSalesCount: number;
    totalRevenue: number;
    totalCreditSales: number;
    totalImmediatePaid: number;
    invoices: {
      id: string;
      invoiceNumber: string;
      customerName: string;
      totalAmount: number;
      paidAmount: number;
      creditAmount: number;
      soldAt: Date;
      createdByName: string;
    }[];
    cancelledInvoices: {
      id: string;
      invoiceNumber: string;
      customerName: string;
      totalAmount: number;
      cancelledAt: Date | null;
      cancellationReason: string | null;
    }[];
  };
  payments: {
    totalCashCollected: number;
    totalEasyPaisaCollected: number;
    totalJazzCashCollected: number;
    totalMpesaCollected: number;
    totalQrCollected: number;
    totalDigitalPayments: number;
    totalPaymentsCollected: number;
    invoicePaymentsTotal: number;
    accountPaymentsTotal: number;
    list: {
      id: string;
      amount: number;
      paymentMethod: PaymentMethod;
      referenceNumber: string | null;
      paidAt: Date;
      customerName: string | null;
      invoiceNumber: string | null;
      isAccountPayment: boolean;
      receivedByName: string;
    }[];
  };
  cashDrawer: {
    totalCashExpected: number;
    physicalCash: number;
    cashDifference: number;
  };
  stockCount: {
    status: DailyClosingStockCountStatus;
    totalProductsCounted: number;
    discrepanciesCount: number;
    pendingAdjustmentsCount: number;
    closingId: string | null;
    items: {
      productId: string;
      productName: string;
      brand: string;
      systemQuantity: number;
      physicalQuantity: number;
      difference: number;
    }[];
    pendingAdjustments: {
      id: string;
      productName: string;
      difference: number;
      reason: string;
    }[];
  };
  readiness: {
    isReadyToClose: boolean;
    blockingReasons: string[];
  };
  auditLogs: {
    id: string;
    action: string;
    reason: string;
    userName: string;
    createdAt: Date;
  }[];
};

export type DailyClosingListItem = {
  id: string;
  businessDate: string;
  businessDateObj: Date;
  status: DailyClosingStatus;
  totalSales: number;
  totalCashExpected: number;
  totalDigitalPayments: number;
  totalCredit: number;
  physicalCash: number;
  cashDifference: number;
  stockVerified: boolean;
  stockCountStatus: DailyClosingStockCountStatus;
  totalProductsCounted: number;
  pendingAdjustmentsCount: number;
  closedByName: string;
  closedAt: Date | null;
};

/**
 * Returns the operational timezone for business operations.
 */
export function getBusinessTimeZone(): string {
  return process.env.BUSINESS_TIMEZONE || "Asia/Karachi";
}

/**
 * Returns today's business date formatted as YYYY-MM-DD in the operational business timezone.
 */
export function getTodayBusinessDateString(): string {
  const tz = getBusinessTimeZone();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Resolves a date string (YYYY-MM-DD) into exact start/end UTC boundaries in the local business timezone,
 * and produces a UTC midnight Date object suitable for Postgres @db.Date columns.
 */
export function getBusinessDateRange(dateStr: string) {
  const tz = getBusinessTimeZone();
  const parts = dateStr.split("-").map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid business date format: "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [year, month, day] = parts;

  // Compute timezone offset string (e.g. "+05:00") for the target timezone
  const refDate = new Date();
  const str = refDate.toLocaleString("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  });
  const match = str.match(/GMT([+-]\d{2}):(\d{2})/);
  const offset = match ? `${match[1]}:${match[2]}` : "+00:00";

  const yStr = String(year).padStart(4, "0");
  const mStr = String(month).padStart(2, "0");
  const dStr = String(day).padStart(2, "0");
  const cleanDateStr = `${yStr}-${mStr}-${dStr}`;

  const startOfDay = new Date(`${cleanDateStr}T00:00:00.000${offset}`);
  const endOfDay = new Date(`${cleanDateStr}T23:59:59.999${offset}`);
  const dbDate = new Date(`${cleanDateStr}T00:00:00.000Z`);

  return {
    startOfDay,
    endOfDay,
    dbDate,
    dateStr: cleanDateStr,
  };
}

/**
 * Compiles a comprehensive operational reconciliation summary for a given business date.
 */
export async function getDailyClosingSummary(dateStr: string): Promise<DailyClosingSummary> {
  const { startOfDay, endOfDay, dbDate, dateStr: cleanDateStr } = getBusinessDateRange(dateStr);

  // 1. Fetch existing DailyClosing if initialized
  const closing = await prisma.dailyClosing.findUnique({
    where: { businessDate: dbDate },
    include: {
      closedBy: { select: { name: true } },
      stockCounts: {
        include: {
          product: { select: { name: true, brand: true } },
        },
      },
    },
  });

  // 2. Fetch completed sales for the date range
  const completedSales = await prisma.sale.findMany({
    where: {
      soldAt: { gte: startOfDay, lte: endOfDay },
      status: SaleStatus.COMPLETED,
    },
    include: {
      customer: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { soldAt: "asc" },
  });

  // 3. Fetch cancelled sales for the date range (for audit / transparent exclusion)
  const cancelledSales = await prisma.sale.findMany({
    where: {
      soldAt: { gte: startOfDay, lte: endOfDay },
      status: SaleStatus.CANCELLED,
    },
    include: {
      customer: { select: { name: true } },
    },
    orderBy: { soldAt: "asc" },
  });

  // 4. Calculate Sales totals
  let totalRevenue = 0;
  let totalCreditSales = 0;
  let totalImmediatePaid = 0;

  for (const s of completedSales) {
    totalRevenue += Number(s.totalAmount);
    totalCreditSales += Number(s.creditAmount);
    totalImmediatePaid += Number(s.paidAmount);
  }

  // 5. Fetch all payments collected on this business date
  // Rule: Exclude payments tied to cancelled sales
  const rawPayments = await prisma.payment.findMany({
    where: {
      paidAt: { gte: startOfDay, lte: endOfDay },
      OR: [
        { saleId: null }, // Account-level customer collection
        { sale: { status: SaleStatus.COMPLETED } }, // Invoice payment on completed sale
      ],
    },
    include: {
      customer: { select: { name: true } },
      receivedBy: { select: { name: true } },
      sale: { select: { invoiceNumber: true, status: true } },
    },
    orderBy: { paidAt: "asc" },
  });

  // 6. Aggregate Payments by Method & Type
  let totalCashCollected = 0;
  let totalEasyPaisaCollected = 0;
  let totalJazzCashCollected = 0;
  let totalMpesaCollected = 0;
  let totalQrCollected = 0;
  let invoicePaymentsTotal = 0;
  let accountPaymentsTotal = 0;

  for (const p of rawPayments) {
    const amt = Number(p.amount);
    switch (p.paymentMethod) {
      case PaymentMethod.CASH:
        totalCashCollected += amt;
        break;
      case PaymentMethod.EASYPAISA:
        totalEasyPaisaCollected += amt;
        break;
      case PaymentMethod.JAZZCASH:
        totalJazzCashCollected += amt;
        break;
      case PaymentMethod.MPESA:
        totalMpesaCollected += amt;
        break;
      case PaymentMethod.QR:
        totalQrCollected += amt;
        break;
    }

    if (p.saleId) {
      invoicePaymentsTotal += amt;
    } else {
      accountPaymentsTotal += amt;
    }
  }

  const totalDigitalPayments =
    totalEasyPaisaCollected + totalJazzCashCollected + totalMpesaCollected + totalQrCollected;
  const totalPaymentsCollected = totalCashCollected + totalDigitalPayments;

  // 7. Cash Drawer Reconciliation
  // Note: NO expenses are recorded or deducted
  const totalCashExpected = totalCashCollected;
  const physicalCash = closing?.physicalCash ? Number(closing.physicalCash) : 0;
  const cashDifference = physicalCash - totalCashExpected;

  // 8. Stock Count Integration
  let stockCountStatus: DailyClosingStockCountStatus = "not_started";
  let pendingAdjustmentsCount = 0;
  let discrepanciesCount = 0;
  let totalProductsCounted = 0;
  const stockCountItems: DailyClosingSummary["stockCount"]["items"] = [];
  const pendingAdjustmentsList: DailyClosingSummary["stockCount"]["pendingAdjustments"] = [];

  if (closing) {
    totalProductsCounted = closing.stockCounts.length;
    discrepanciesCount = closing.stockCounts.filter((sc) => sc.difference !== 0).length;

    for (const sc of closing.stockCounts) {
      stockCountItems.push({
        productId: sc.productId,
        productName: sc.product.name,
        brand: sc.product.brand,
        systemQuantity: sc.systemQuantity,
        physicalQuantity: sc.physicalQuantity,
        difference: sc.difference,
      });
    }

    // Find pending adjustments linked to this closing session
    const pendingAdjs = await prisma.stockAdjustment.findMany({
      where: {
        status: AdjustmentStatus.PENDING,
        reason: { contains: closing.id },
      },
      include: {
        product: { select: { name: true } },
      },
    });

    pendingAdjustmentsCount = pendingAdjs.length;
    for (const pa of pendingAdjs) {
      pendingAdjustmentsList.push({
        id: pa.id,
        productName: pa.product.name,
        difference: pa.difference,
        reason: pa.reason.replace(/\[Count:\s*[a-f0-9\-]+\]\s*/i, ""),
      });
    }

    if (totalProductsCounted === 0) {
      stockCountStatus = "not_started";
    } else if (pendingAdjustmentsCount > 0) {
      stockCountStatus = "pending_adjustments";
    } else if (closing.status === DailyClosingStatus.CLOSED && closing.stockVerified) {
      stockCountStatus = "completed";
    } else if (closing.stockVerified || discrepanciesCount === 0) {
      stockCountStatus = "ready";
    } else {
      stockCountStatus = "in_progress";
    }
  }

  // 9. Closing Readiness Assessment
  const blockingReasons: string[] = [];
  if (stockCountStatus === "not_started") {
    blockingReasons.push("Physical stock count for this business date has not been submitted.");
  } else if (pendingAdjustmentsCount > 0) {
    blockingReasons.push(
      `${pendingAdjustmentsCount} physical stock discrepanc${
        pendingAdjustmentsCount === 1 ? "y" : "ies"
      } must be approved or rejected by Owner in Stock Counts.`
    );
  }

  const isStockCountReady = stockCountStatus === "ready" || stockCountStatus === "completed";
  const isAlreadyClosed = closing?.status === DailyClosingStatus.CLOSED;
  const isReadyToClose = isStockCountReady && pendingAdjustmentsCount === 0 && !isAlreadyClosed;

  // 10. Audit Logs
  let auditLogs: DailyClosingSummary["auditLogs"] = [];
  if (closing) {
    const rawAudit = await prisma.auditLog.findMany({
      where: {
        entityType: "DailyClosing",
        entityId: closing.id,
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true } },
      },
    });

    auditLogs = rawAudit.map((a) => ({
      id: a.id,
      action: a.action,
      reason: a.reason,
      userName: a.user.name,
      createdAt: a.createdAt,
    }));
  }

  return {
    businessDate: cleanDateStr,
    businessDateObj: dbDate,
    closing: closing
      ? {
          id: closing.id,
          status: closing.status,
          stockVerified: closing.stockVerified,
          physicalCash: Number(closing.physicalCash),
          cashDifference: Number(closing.cashDifference),
          notes: closing.notes,
          closedByName: closing.closedBy.name,
          closedAt: closing.closedAt,
        }
      : null,
    sales: {
      completedSalesCount: completedSales.length,
      cancelledSalesCount: cancelledSales.length,
      totalRevenue,
      totalCreditSales,
      totalImmediatePaid,
      invoices: completedSales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        customerName: s.customer?.name || "No Customer",
        totalAmount: Number(s.totalAmount),
        paidAmount: Number(s.paidAmount),
        creditAmount: Number(s.creditAmount),
        soldAt: s.soldAt,
        createdByName: s.createdBy.name,
      })),
      cancelledInvoices: cancelledSales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        customerName: s.customer?.name || "No Customer",
        totalAmount: Number(s.totalAmount),
        cancelledAt: s.cancelledAt,
        cancellationReason: s.cancellationReason,
      })),
    },
    payments: {
      totalCashCollected,
      totalEasyPaisaCollected,
      totalJazzCashCollected,
      totalMpesaCollected,
      totalQrCollected,
      totalDigitalPayments,
      totalPaymentsCollected,
      invoicePaymentsTotal,
      accountPaymentsTotal,
      list: rawPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        referenceNumber: p.referenceNumber,
        paidAt: p.paidAt,
        customerName: p.customer?.name || null,
        invoiceNumber: p.sale?.invoiceNumber || null,
        isAccountPayment: p.saleId === null,
        receivedByName: p.receivedBy.name,
      })),
    },
    cashDrawer: {
      totalCashExpected,
      physicalCash,
      cashDifference,
    },
    stockCount: {
      status: stockCountStatus,
      totalProductsCounted,
      discrepanciesCount,
      pendingAdjustmentsCount,
      closingId: closing?.id || null,
      items: stockCountItems,
      pendingAdjustments: pendingAdjustmentsList,
    },
    readiness: {
      isReadyToClose,
      blockingReasons,
    },
    auditLogs,
  };
}

/**
 * Finds or creates an initial DailyClosing session in OPEN status for a business date.
 */
export async function getOrCreateDailyClosing(
  dateStr: string,
  userId: string
): Promise<{ closingId: string; wasCreated: boolean }> {
  const { dbDate } = getBusinessDateRange(dateStr);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.dailyClosing.findUnique({
      where: { businessDate: dbDate },
    });

    if (existing) {
      return { closingId: existing.id, wasCreated: false };
    }

    const created = await tx.dailyClosing.create({
      data: {
        businessDate: dbDate,
        totalSales: new Prisma.Decimal(0),
        totalCashExpected: new Prisma.Decimal(0),
        totalDigitalPayments: new Prisma.Decimal(0),
        totalCredit: new Prisma.Decimal(0),
        physicalCash: new Prisma.Decimal(0),
        cashDifference: new Prisma.Decimal(0),
        stockVerified: false,
        status: DailyClosingStatus.OPEN,
        closedById: userId,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "DAILY_CLOSING_OPENED",
        entityType: "DailyClosing",
        entityId: created.id,
        newValues: {
          businessDate: dateStr,
          status: DailyClosingStatus.OPEN,
        },
        reason: `Daily closing session initialized for business date ${dateStr}`,
      },
    });

    return { closingId: created.id, wasCreated: true };
  });
}

/**
 * Retrieves daily closing session summary by ID.
 */
export async function getDailyClosingById(id: string): Promise<DailyClosingSummary | null> {
  const closing = await prisma.dailyClosing.findUnique({
    where: { id },
    select: { businessDate: true },
  });

  if (!closing) return null;

  const dateStr = closing.businessDate.toISOString().slice(0, 10);
  return getDailyClosingSummary(dateStr);
}

/**
 * Lists recent daily closing sessions.
 */
export async function listDailyClosings(limit = 60): Promise<DailyClosingListItem[]> {
  const closings = await prisma.dailyClosing.findMany({
    orderBy: { businessDate: "desc" },
    take: limit,
    include: {
      closedBy: { select: { name: true } },
      stockCounts: true,
    },
  });

  // Query pending adjustments count
  const pendingAdjustments = await prisma.stockAdjustment.findMany({
    where: { status: AdjustmentStatus.PENDING },
    select: { reason: true },
  });

  const pendingMapByClosingId = new Map<string, number>();
  for (const pa of pendingAdjustments) {
    const match = pa.reason.match(/\[Count:\s*([a-f0-9\-]+)\]/i);
    if (match) {
      const cid = match[1];
      pendingMapByClosingId.set(cid, (pendingMapByClosingId.get(cid) || 0) + 1);
    }
  }

  return closings.map((c) => {
    const totalProductsCounted = c.stockCounts.length;
    const discrepanciesCount = c.stockCounts.filter((sc) => sc.difference !== 0).length;
    const pendingCount = pendingMapByClosingId.get(c.id) || 0;

    let stockCountStatus: DailyClosingStockCountStatus = "not_started";
    if (totalProductsCounted === 0) {
      stockCountStatus = "not_started";
    } else if (pendingCount > 0) {
      stockCountStatus = "pending_adjustments";
    } else if (c.status === DailyClosingStatus.CLOSED && c.stockVerified) {
      stockCountStatus = "completed";
    } else if (c.stockVerified || discrepanciesCount === 0) {
      stockCountStatus = "ready";
    } else {
      stockCountStatus = "in_progress";
    }

    const dateStr = c.businessDate.toISOString().slice(0, 10);

    return {
      id: c.id,
      businessDate: dateStr,
      businessDateObj: c.businessDate,
      status: c.status,
      totalSales: Number(c.totalSales),
      totalCashExpected: Number(c.totalCashExpected),
      totalDigitalPayments: Number(c.totalDigitalPayments),
      totalCredit: Number(c.totalCredit),
      physicalCash: Number(c.physicalCash),
      cashDifference: Number(c.cashDifference),
      stockVerified: c.stockVerified,
      stockCountStatus,
      totalProductsCounted,
      pendingAdjustmentsCount: pendingCount,
      closedByName: c.closedBy.name,
      closedAt: c.closedAt,
    };
  });
}

/**
 * Staff or Owner submits daily closing for review.
 * Captures counted physical cash and notes, reconciles financial numbers, and sets status to IN_REVIEW.
 */
export async function submitDailyClosingForReview(
  closingId: string,
  physicalCash: number,
  notes: string | undefined,
  userId: string
): Promise<{ closingId: string }> {
  if (isNaN(physicalCash) || physicalCash < 0) {
    throw new Error("Physical cash counted must be a valid non-negative amount.");
  }

  return prisma.$transaction(async (tx) => {
    const closing = await tx.dailyClosing.findUnique({
      where: { id: closingId },
    });

    if (!closing) {
      throw new Error("Daily closing session not found.");
    }

    if (closing.status === DailyClosingStatus.CLOSED) {
      throw new Error("This daily closing session is already finalized and closed.");
    }

    const dateStr = closing.businessDate.toISOString().slice(0, 10);
    const summary = await getDailyClosingSummary(dateStr);

    const totalCashExpected = summary.cashDrawer.totalCashExpected;
    const cashDifference = physicalCash - totalCashExpected;

    await tx.dailyClosing.update({
      where: { id: closing.id },
      data: {
        totalSales: new Prisma.Decimal(summary.sales.totalRevenue.toFixed(2)),
        totalCashExpected: new Prisma.Decimal(totalCashExpected.toFixed(2)),
        totalDigitalPayments: new Prisma.Decimal(
          summary.payments.totalDigitalPayments.toFixed(2)
        ),
        totalCredit: new Prisma.Decimal(summary.sales.totalCreditSales.toFixed(2)),
        physicalCash: new Prisma.Decimal(physicalCash.toFixed(2)),
        cashDifference: new Prisma.Decimal(cashDifference.toFixed(2)),
        status: DailyClosingStatus.IN_REVIEW,
        notes: notes?.trim() || closing.notes,
      },
    });

    await tx.auditLog.create({
      data: {
        userId,
        action: "DAILY_CLOSING_SUBMITTED",
        entityType: "DailyClosing",
        entityId: closing.id,
        newValues: {
          physicalCash: physicalCash.toFixed(2),
          totalCashExpected: totalCashExpected.toFixed(2),
          cashDifference: cashDifference.toFixed(2),
          totalSales: summary.sales.totalRevenue.toFixed(2),
          totalCredit: summary.sales.totalCreditSales.toFixed(2),
          totalDigital: summary.payments.totalDigitalPayments.toFixed(2),
          status: DailyClosingStatus.IN_REVIEW,
        },
        reason: notes?.trim() || "Daily closing prepared and submitted for Owner review",
      },
    });

    return { closingId: closing.id };
  }, { timeout: 25000, maxWait: 5000 });
}

/**
 * Exactly one Owner final close action.
 * Verifies stock count is ready and no pending adjustments exist, reconciles figures,
 * and sets status to CLOSED.
 */
export async function finalizeAndCloseDailyClosing(
  closingId: string,
  physicalCashOverride: number | undefined,
  notes: string | undefined,
  ownerUserId: string
): Promise<{ closingId: string }> {
  return prisma.$transaction(async (tx) => {
    const closing = await tx.dailyClosing.findUnique({
      where: { id: closingId },
      include: {
        stockCounts: true,
      },
    });

    if (!closing) {
      throw new Error("Daily closing session not found.");
    }

    if (closing.status === DailyClosingStatus.CLOSED) {
      throw new Error("This daily closing session is already closed.");
    }

    const dateStr = closing.businessDate.toISOString().slice(0, 10);
    const summary = await getDailyClosingSummary(dateStr);

    // Enforce stock count prerequisites
    if (summary.stockCount.status === "not_started") {
      throw new Error(
        "Cannot close business day: Physical stock count must be performed and submitted first."
      );
    }

    if (summary.stockCount.pendingAdjustmentsCount > 0) {
      throw new Error(
        `Cannot close business day: ${summary.stockCount.pendingAdjustmentsCount} pending stock adjustment(s) require Owner resolution.`
      );
    }

    const finalPhysicalCash =
      physicalCashOverride !== undefined && !isNaN(physicalCashOverride) && physicalCashOverride >= 0
        ? physicalCashOverride
        : Number(closing.physicalCash);

    const totalCashExpected = summary.cashDrawer.totalCashExpected;
    const cashDifference = finalPhysicalCash - totalCashExpected;
    const now = new Date();

    await tx.dailyClosing.update({
      where: { id: closing.id },
      data: {
        totalSales: new Prisma.Decimal(summary.sales.totalRevenue.toFixed(2)),
        totalCashExpected: new Prisma.Decimal(totalCashExpected.toFixed(2)),
        totalDigitalPayments: new Prisma.Decimal(
          summary.payments.totalDigitalPayments.toFixed(2)
        ),
        totalCredit: new Prisma.Decimal(summary.sales.totalCreditSales.toFixed(2)),
        physicalCash: new Prisma.Decimal(finalPhysicalCash.toFixed(2)),
        cashDifference: new Prisma.Decimal(cashDifference.toFixed(2)),
        stockVerified: true,
        status: DailyClosingStatus.CLOSED,
        closedById: ownerUserId,
        closedAt: now,
        notes: notes?.trim() || closing.notes,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: ownerUserId,
        action: "DAILY_CLOSING_CLOSED",
        entityType: "DailyClosing",
        entityId: closing.id,
        newValues: {
          physicalCash: finalPhysicalCash.toFixed(2),
          totalCashExpected: totalCashExpected.toFixed(2),
          cashDifference: cashDifference.toFixed(2),
          totalSales: summary.sales.totalRevenue.toFixed(2),
          totalCredit: summary.sales.totalCreditSales.toFixed(2),
          totalDigital: summary.payments.totalDigitalPayments.toFixed(2),
          status: DailyClosingStatus.CLOSED,
          closedAt: now.toISOString(),
        },
        reason: notes?.trim() || "Daily operational closing reviewed and finalized by Owner",
      },
    });

    return { closingId: closing.id };
  }, { timeout: 25000, maxWait: 5000 });
}

/**
 * Owner reopens a closed or in-review daily closing for administrative adjustments.
 */
export async function reopenDailyClosing(
  closingId: string,
  reason: string,
  ownerUserId: string
): Promise<{ closingId: string }> {
  const trimmedReason = reason?.trim();
  if (!trimmedReason || trimmedReason.length < 3) {
    throw new Error(
      "A mandatory reason (at least 3 characters) is required to reopen a daily closing."
    );
  }

  return prisma.$transaction(async (tx) => {
    const closing = await tx.dailyClosing.findUnique({
      where: { id: closingId },
    });

    if (!closing) {
      throw new Error("Daily closing session not found.");
    }

    if (closing.status === DailyClosingStatus.OPEN) {
      throw new Error("Daily closing session is already open.");
    }

    await tx.dailyClosing.update({
      where: { id: closing.id },
      data: {
        status: DailyClosingStatus.OPEN,
        closedAt: null,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: ownerUserId,
        action: "DAILY_CLOSING_REOPENED",
        entityType: "DailyClosing",
        entityId: closing.id,
        newValues: {
          previousStatus: closing.status,
          status: DailyClosingStatus.OPEN,
        },
        reason: trimmedReason,
      },
    });

    return { closingId: closing.id };
  });
}
