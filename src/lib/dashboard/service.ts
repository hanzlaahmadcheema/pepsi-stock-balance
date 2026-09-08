import { prisma } from "@/lib/prisma";
import { Role, SaleStatus, MovementType } from "@prisma/client";
import {
  getTodayBusinessDateString,
  getBusinessDateRange,
  getDailyClosingSummary,
  DailyClosingStockCountStatus,
} from "@/lib/daily-closing/service";
import { listPendingAdjustments, PendingAdjustmentSummary } from "@/lib/stock-counts/service";

// ==========================================
// TYPES
// ==========================================

export type DashboardPendingTask = {
  id: string;
  title: string;
  description: string;
  href: string;
  badge: string;
  priority: "high" | "normal";
};

export type LowStockProductSummary = {
  id: string;
  name: string;
  brand: string;
  currentStock: number;
  minimumStockLevel: number;
};

export type StaffDashboardData = {
  role: "STAFF";
  businessDate: string;
  sales: {
    invoicesCount: number;
    cratesSold: number;
    cancelledInvoicesCount: number;
  };
  payments: {
    totalCashCollected: number;
    totalEasyPaisaCollected: number;
    totalJazzCashCollected: number;
    totalMpesaCollected: number;
    totalQrCollected: number;
    totalDigitalPayments: number;
    totalPaymentsCollected: number;
  };
  inventory: {
    totalStockCrates: number;
    lowStockCount: number;
    outOfStockCount: number;
    lowStockProducts: LowStockProductSummary[];
  };
  stockCount: {
    status: DailyClosingStockCountStatus;
    totalProductsCounted: number;
    discrepanciesCount: number;
    pendingAdjustmentsCount: number;
    closingId: string | null;
  };
  dailyClosing: {
    status: string; // "NOT_STARTED" | "OPEN" | "IN_REVIEW" | "CLOSED"
    closingId: string | null;
    isReadyToClose: boolean;
    blockingReasons: string[];
  };
  pendingTasks: DashboardPendingTask[];
};

export type OwnerDashboardData = {
  role: "OWNER";
  businessDate: string;
  sales: {
    invoicesCount: number;
    cratesSold: number;
    revenue: number;
    cancelledInvoicesCount: number;
    creditSalesAmount: number;
    immediatePaidAmount: number;
  };
  // OWNER-ONLY FINANCIAL METRICS
  profit: {
    todayGrossProfit: number;
    todayGrossMarginPercent: number;
    todayCostOfGoodsSold: number;
  };
  payments: {
    totalCashCollected: number;
    totalEasyPaisaCollected: number;
    totalJazzCashCollected: number;
    totalMpesaCollected: number;
    totalQrCollected: number;
    totalDigitalPayments: number;
    totalPaymentsCollected: number;
  };
  inventory: {
    totalStockCrates: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalValuation: number; // OWNER ONLY: total valuation at latest purchase price
    lowStockProducts: LowStockProductSummary[];
  };
  customers: {
    totalActive: number;
    totalCreditOutstanding: number;
  };
  stockCount: {
    status: DailyClosingStockCountStatus;
    totalProductsCounted: number;
    discrepanciesCount: number;
    pendingAdjustmentsCount: number;
    closingId: string | null;
  };
  pendingAdjustments: PendingAdjustmentSummary[];
  dailyClosing: {
    status: string; // "NOT_STARTED" | "OPEN" | "IN_REVIEW" | "CLOSED"
    closingId: string | null;
    physicalCash: number;
    cashDifference: number;
    isReadyToClose: boolean;
    blockingReasons: string[];
  };
  pendingTasks: DashboardPendingTask[];
};

export type DashboardData = StaffDashboardData | OwnerDashboardData;

// ==========================================
// DASHBOARD SERVICE
// ==========================================

export async function getDashboardData(role: Role): Promise<DashboardData> {
  const isOwner = role === Role.OWNER;
  const todayStr = getTodayBusinessDateString();
  const { startOfDay, endOfDay } = getBusinessDateRange(todayStr);

  // 1. Authoritative Daily Closing Summary for Today
  const closingSummary = await getDailyClosingSummary(todayStr);

  // 2. Authoritative Physical Inventory from StockMovement
  const movements = await prisma.stockMovement.groupBy({
    by: ["productId", "movementType"],
    _sum: { quantity: true },
  });

  const stockMap = new Map<string, number>();
  for (const mvt of movements) {
    const qty = mvt._sum.quantity || 0;
    const isAdd =
      mvt.movementType === MovementType.RECEIVING ||
      mvt.movementType === MovementType.SALE_CANCELLATION ||
      mvt.movementType === MovementType.RETURN_RESTOCK ||
      mvt.movementType === MovementType.ADJUSTMENT_ADD;
    const current = stockMap.get(mvt.productId) || 0;
    stockMap.set(mvt.productId, current + (isAdd ? Math.abs(qty) : -Math.abs(qty)));
  }

  // Security: Staff must NEVER select latestPurchasePrice
  const activeProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      brand: true,
      minimumStockLevel: true,
      ...(isOwner ? { latestPurchasePrice: true } : {}),
    },
    orderBy: { name: "asc" },
  });

  let totalStockCrates = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalValuation = 0;
  const lowStockProducts: LowStockProductSummary[] = [];

  for (const p of activeProducts) {
    const stock = stockMap.get(p.id) || 0;
    const safeStock = Math.max(0, stock);
    totalStockCrates += safeStock;

    if (stock <= 0) {
      outOfStockCount++;
      lowStockCount++;
      lowStockProducts.push({
        id: p.id,
        name: p.name,
        brand: p.brand,
        currentStock: stock,
        minimumStockLevel: p.minimumStockLevel,
      });
    } else if (stock <= p.minimumStockLevel) {
      lowStockCount++;
      lowStockProducts.push({
        id: p.id,
        name: p.name,
        brand: p.brand,
        currentStock: stock,
        minimumStockLevel: p.minimumStockLevel,
      });
    }

    if (isOwner && "latestPurchasePrice" in p && p.latestPurchasePrice && stock > 0) {
      totalValuation += stock * Number(p.latestPurchasePrice);
    }
  }

  // 3. Today's Crates Sold & Owner Profit
  // Security: Staff must NEVER select purchaseCostAtSale
  const todaySaleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        soldAt: { gte: startOfDay, lte: endOfDay },
        status: SaleStatus.COMPLETED,
      },
    },
    select: {
      quantity: true,
      totalAmount: true,
      ...(isOwner ? { purchaseCostAtSale: true } : {}),
    },
  });

  let cratesSoldToday = 0;
  let todayCostOfGoodsSold = 0;
  for (const item of todaySaleItems) {
    cratesSoldToday += item.quantity;
    if (isOwner && "purchaseCostAtSale" in item && item.purchaseCostAtSale != null) {
      todayCostOfGoodsSold += item.quantity * Number(item.purchaseCostAtSale);
    }
  }

  // Common Daily Closing Status representation
  const closingStatus = closingSummary.closing?.status || "NOT_STARTED";
  const closingId = closingSummary.closing?.id || null;

  // 4. Actionable Pending Tasks calculation
  const pendingTasks: DashboardPendingTask[] = [];

  if (isOwner) {
    // OWNER TASKS
    // A. Pending Stock Adjustments
    const pendingAdjustments = await listPendingAdjustments();
    if (pendingAdjustments.length > 0) {
      pendingTasks.push({
        id: "owner-adjustments",
        title: `${pendingAdjustments.length} Stock Adjustment${pendingAdjustments.length > 1 ? "s" : ""} Awaiting Approval`,
        description: "Physical stock discrepancies require owner approval or rejection before closing.",
        href: "/stock-counts",
        badge: `${pendingAdjustments.length} Pending`,
        priority: "high",
      });
    }

    // B. Daily Closing Review
    if (closingStatus === "IN_REVIEW") {
      pendingTasks.push({
        id: "owner-closing-review",
        title: `Review Today's Daily Closing (${todayStr})`,
        description: "Staff has prepared and submitted the end-of-day closing reconciliation for your final approval.",
        href: `/daily-closing/${closingId || ""}`,
        badge: "In Review",
        priority: "high",
      });
    }

    // C. Low Stock Alert
    if (lowStockCount > 0) {
      pendingTasks.push({
        id: "owner-low-stock",
        title: `${lowStockCount} Product${lowStockCount > 1 ? "s" : ""} Below Minimum Stock`,
        description: "Restock warehouse by logging new supplier receiving deliveries.",
        href: "/receiving/new",
        badge: `${lowStockCount} Low`,
        priority: "normal",
      });
    }

    // 5. Owner Customer Receivables
    const customerSales = await prisma.sale.groupBy({
      by: ["customerId"],
      where: {
        status: SaleStatus.COMPLETED,
        customerId: { not: null },
      },
      _sum: { totalAmount: true },
    });

    const customerPayments = await prisma.payment.groupBy({
      by: ["customerId"],
      where: {
        customerId: { not: null },
        OR: [{ saleId: null }, { sale: { status: SaleStatus.COMPLETED } }],
      },
      _sum: { amount: true },
    });

    const paymentsMap = new Map<string, number>();
    for (const p of customerPayments) {
      if (p.customerId) {
        paymentsMap.set(p.customerId, Number(p._sum.amount || 0));
      }
    }

    let totalCreditOutstanding = 0;
    for (const cs of customerSales) {
      if (cs.customerId) {
        const salesTot = Number(cs._sum.totalAmount || 0);
        const paidTot = paymentsMap.get(cs.customerId) || 0;
        const diff = salesTot - paidTot;
        if (diff > 0.01) {
          totalCreditOutstanding += diff;
        }
      }
    }

    const activeCustomersCount = await prisma.customer.count({
      where: { isActive: true },
    });

    const revenue = closingSummary.sales.totalRevenue;
    const todayGrossProfit = revenue - todayCostOfGoodsSold;
    const todayGrossMarginPercent = revenue > 0 ? (todayGrossProfit / revenue) * 100 : 0;

    const ownerData: OwnerDashboardData = {
      role: "OWNER",
      businessDate: todayStr,
      sales: {
        invoicesCount: closingSummary.sales.completedSalesCount,
        cratesSold: cratesSoldToday,
        revenue,
        cancelledInvoicesCount: closingSummary.sales.cancelledSalesCount,
        creditSalesAmount: closingSummary.sales.totalCreditSales,
        immediatePaidAmount: closingSummary.sales.totalImmediatePaid,
      },
      profit: {
        todayGrossProfit,
        todayGrossMarginPercent,
        todayCostOfGoodsSold,
      },
      payments: {
        totalCashCollected: closingSummary.payments.totalCashCollected,
        totalEasyPaisaCollected: closingSummary.payments.totalEasyPaisaCollected,
        totalJazzCashCollected: closingSummary.payments.totalJazzCashCollected,
        totalMpesaCollected: closingSummary.payments.totalMpesaCollected,
        totalQrCollected: closingSummary.payments.totalQrCollected,
        totalDigitalPayments: closingSummary.payments.totalDigitalPayments,
        totalPaymentsCollected: closingSummary.payments.totalPaymentsCollected,
      },
      inventory: {
        totalStockCrates,
        lowStockCount,
        outOfStockCount,
        totalValuation,
        lowStockProducts: lowStockProducts.slice(0, 5),
      },
      customers: {
        totalActive: activeCustomersCount,
        totalCreditOutstanding,
      },
      stockCount: {
        status: closingSummary.stockCount.status,
        totalProductsCounted: closingSummary.stockCount.totalProductsCounted,
        discrepanciesCount: closingSummary.stockCount.discrepanciesCount,
        pendingAdjustmentsCount: closingSummary.stockCount.pendingAdjustmentsCount,
        closingId,
      },
      pendingAdjustments,
      dailyClosing: {
        status: closingStatus,
        closingId,
        physicalCash: closingSummary.cashDrawer.physicalCash,
        cashDifference: closingSummary.cashDrawer.cashDifference,
        isReadyToClose: closingSummary.readiness.isReadyToClose,
        blockingReasons: closingSummary.readiness.blockingReasons,
      },
      pendingTasks,
    };

    return ownerData;
  }

  // STAFF TASKS
  // A. Stock Count Task
  if (closingSummary.stockCount.status === "not_started") {
    pendingTasks.push({
      id: "staff-stock-count",
      title: "Perform Physical Stock Count",
      description: `Today's physical inventory has not been counted yet for business date ${todayStr}.`,
      href: "/stock-counts/new",
      badge: "Not Started",
      priority: "high",
    });
  } else if (closingSummary.stockCount.status === "in_progress") {
    pendingTasks.push({
      id: "staff-stock-count-prog",
      title: "Finish In-Progress Stock Count",
      description: "A physical count session is active. Complete entering crate quantities and submit.",
      href: closingId ? `/stock-counts/${closingId}` : "/stock-counts",
      badge: "In Progress",
      priority: "high",
    });
  }

  // B. Daily Closing Task
  if (closingStatus === "NOT_STARTED" || closingStatus === "OPEN") {
    pendingTasks.push({
      id: "staff-daily-closing",
      title: "Prepare Daily Closing",
      description: `Reconcile cash drawer and submit end-of-day closing for business date ${todayStr}.`,
      href: closingId ? `/daily-closing/${closingId}` : "/daily-closing",
      badge: "Action Needed",
      priority: "high",
    });
  } else if (closingStatus === "IN_REVIEW") {
    pendingTasks.push({
      id: "staff-closing-review",
      title: "Daily Closing Submitted",
      description: "End-of-day reconciliation has been submitted. Awaiting owner review.",
      href: closingId ? `/daily-closing/${closingId}` : "/daily-closing",
      badge: "Awaiting Owner",
      priority: "normal",
    });
  }

  // C. Low Stock Operational Monitor
  if (lowStockCount > 0) {
    pendingTasks.push({
      id: "staff-low-stock",
      title: `${lowStockCount} Product${lowStockCount > 1 ? "s" : ""} at or below Minimum Stock`,
      description: "Monitor inventory on warehouse floor and check for incoming deliveries.",
      href: "/products",
      badge: `${lowStockCount} Low`,
      priority: "normal",
    });
  }

  // SECURITY: Staff response contains ZERO purchase cost, profit, margin, or valuation fields
  const staffData: StaffDashboardData = {
    role: "STAFF",
    businessDate: todayStr,
    sales: {
      invoicesCount: closingSummary.sales.completedSalesCount,
      cratesSold: cratesSoldToday,
      cancelledInvoicesCount: closingSummary.sales.cancelledSalesCount,
    },
    payments: {
      totalCashCollected: closingSummary.payments.totalCashCollected,
      totalEasyPaisaCollected: closingSummary.payments.totalEasyPaisaCollected,
      totalJazzCashCollected: closingSummary.payments.totalJazzCashCollected,
      totalMpesaCollected: closingSummary.payments.totalMpesaCollected,
      totalQrCollected: closingSummary.payments.totalQrCollected,
      totalDigitalPayments: closingSummary.payments.totalDigitalPayments,
      totalPaymentsCollected: closingSummary.payments.totalPaymentsCollected,
    },
    inventory: {
      totalStockCrates,
      lowStockCount,
      outOfStockCount,
      lowStockProducts: lowStockProducts.slice(0, 5),
    },
    stockCount: {
      status: closingSummary.stockCount.status,
      totalProductsCounted: closingSummary.stockCount.totalProductsCounted,
      discrepanciesCount: closingSummary.stockCount.discrepanciesCount,
      pendingAdjustmentsCount: closingSummary.stockCount.pendingAdjustmentsCount,
      closingId,
    },
    dailyClosing: {
      status: closingStatus,
      closingId,
      isReadyToClose: closingSummary.readiness.isReadyToClose,
      blockingReasons: closingSummary.readiness.blockingReasons,
    },
    pendingTasks,
  };

  return staffData;
}
