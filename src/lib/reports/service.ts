import { prisma } from "@/lib/prisma";
import {
  SaleStatus,
  SaleType,
  MovementType,
  DamageType,
  PriceTier,
  ContainerType,
  ContainerMovementType,
  Prisma,
} from "@prisma/client";
import { getBusinessTimeZone, getTodayBusinessDateString } from "@/lib/daily-closing/service";

// ==========================================
// DATE HELPERS FOR REPORTS
// ==========================================

export function parseDateFilter(
  startDateStr?: string | null,
  endDateStr?: string | null
): { start: Date; end: Date; startStr: string; endStr: string } {
  const tz = getBusinessTimeZone();
  const today = getTodayBusinessDateString();

  const startStr = startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr) ? startDateStr : "";
  const endStr = endDateStr && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr) ? endDateStr : "";

  const refDate = new Date();
  const str = refDate.toLocaleString("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  });
  const match = str.match(/GMT([+-]\d{2}):(\d{2})/);
  const offset = match ? `${match[1]}:${match[2]}` : "+00:00";

  // Default: current month if not provided
  let finalStartStr = startStr;
  let finalEndStr = endStr;

  if (!finalStartStr && !finalEndStr) {
    const [y, m] = today.split("-");
    finalStartStr = `${y}-${m}-01`;
    finalEndStr = today;
  } else if (!finalStartStr) {
    finalStartStr = finalEndStr;
  } else if (!finalEndStr) {
    finalEndStr = today;
  }

  const start = new Date(`${finalStartStr}T00:00:00.000${offset}`);
  const end = new Date(`${finalEndStr}T23:59:59.999${offset}`);

  return { start, end, startStr: finalStartStr, endStr: finalEndStr };
}

// ==========================================
// 1. REPORTS HUB OVERVIEW SUMMARY
// ==========================================

export type ReportsHubSummary = {
  salesToday: {
    revenue: number;
    invoicesCount: number;
    cratesSold: number;
  };
  salesThisMonth: {
    revenue: number;
    invoicesCount: number;
    cratesSold: number;
  };
  inventory: {
    totalActiveProducts: number;
    totalStockCrates: number;
    lowStockAlerts: number;
    outOfStockCount: number;
    totalValuation?: number; // OWNER ONLY
  };
  customers: {
    totalActive: number;
    totalCreditOutstanding: number;
  };
  operationsThisMonth: {
    cratesReceived: number;
    cratesDispatched: number;
    cratesDamaged: number;
  };
  profitThisMonth?: {
    // OWNER ONLY
    revenue: number;
    cost: number;
    grossProfit: number;
    marginPercent: number;
  };
};

export async function getReportsHubSummary(isOwner: boolean): Promise<ReportsHubSummary> {
  const todayStr = getTodayBusinessDateString();
  const { start: startToday, end: endToday } = parseDateFilter(todayStr, todayStr);

  const [y, m] = todayStr.split("-");
  const monthStartStr = `${y}-${m}-01`;
  const { start: startMonth, end: endMonth } = parseDateFilter(monthStartStr, todayStr);

  // 1. Sales Today
  const salesToday = await prisma.sale.findMany({
    where: {
      soldAt: { gte: startToday, lte: endToday },
      status: SaleStatus.COMPLETED,
    },
    include: { items: { select: { quantity: true } } },
  });

  let revenueToday = 0;
  let cratesToday = 0;
  for (const s of salesToday) {
    revenueToday += Number(s.totalAmount);
    for (const item of s.items) {
      cratesToday += item.quantity;
    }
  }

  // 2. Sales This Month
  const salesMonth = await prisma.sale.findMany({
    where: {
      soldAt: { gte: startMonth, lte: endMonth },
      status: SaleStatus.COMPLETED,
    },
    include: {
      items: {
        select: {
          quantity: true,
          totalAmount: true,
          purchaseCostAtSale: true,
        },
      },
    },
  });

  let revenueMonth = 0;
  let cratesMonth = 0;
  let costMonth = 0;

  for (const s of salesMonth) {
    revenueMonth += Number(s.totalAmount);
    for (const item of s.items) {
      cratesMonth += item.quantity;
      if (isOwner) {
        costMonth += item.quantity * Number(item.purchaseCostAtSale);
      }
    }
  }

  // 3. Stock on Hand from StockMovement
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

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, minimumStockLevel: true, latestPurchasePrice: true },
  });

  let totalStockCrates = 0;
  let lowStockAlerts = 0;
  let outOfStockCount = 0;
  let totalValuation = 0;

  for (const p of products) {
    const stock = stockMap.get(p.id) || 0;
    totalStockCrates += Math.max(0, stock);
    if (stock <= 0) {
      outOfStockCount++;
    } else if (stock <= p.minimumStockLevel) {
      lowStockAlerts++;
    }
    if (isOwner && stock > 0) {
      totalValuation += stock * Number(p.latestPurchasePrice);
    }
  }

  // 4. Customers & Credit
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true },
  });

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

  // 5. Operations this month
  const receivingThisMonth = await prisma.receivingItem.aggregate({
    where: {
      receiving: {
        receivedAt: { gte: startMonth, lte: endMonth },
      },
    },
    _sum: { quantity: true },
  });

  const dispatchThisMonth = await prisma.stockMovement.aggregate({
    where: {
      movementType: MovementType.SALE,
      createdAt: { gte: startMonth, lte: endMonth },
    },
    _sum: { quantity: true },
  });

  const damageThisMonth = await prisma.damageRecord.aggregate({
    where: {
      recordedAt: { gte: startMonth, lte: endMonth },
    },
    _sum: { quantity: true },
  });

  const grossProfitMonth = isOwner ? revenueMonth - costMonth : 0;
  const marginPercentMonth =
    isOwner && revenueMonth > 0 ? (grossProfitMonth / revenueMonth) * 100 : 0;

  return {
    salesToday: {
      revenue: revenueToday,
      invoicesCount: salesToday.length,
      cratesSold: cratesToday,
    },
    salesThisMonth: {
      revenue: revenueMonth,
      invoicesCount: salesMonth.length,
      cratesSold: cratesMonth,
    },
    inventory: {
      totalActiveProducts: products.length,
      totalStockCrates,
      lowStockAlerts,
      outOfStockCount,
      totalValuation: isOwner ? totalValuation : undefined,
    },
    customers: {
      totalActive: customers.length,
      totalCreditOutstanding,
    },
    operationsThisMonth: {
      cratesReceived: receivingThisMonth._sum.quantity || 0,
      cratesDispatched: dispatchThisMonth._sum.quantity || 0,
      cratesDamaged: damageThisMonth._sum.quantity || 0,
    },
    profitThisMonth: isOwner
      ? {
          revenue: revenueMonth,
          cost: costMonth,
          grossProfit: grossProfitMonth,
          marginPercent: marginPercentMonth,
        }
      : undefined,
  };
}

// ==========================================
// 2. SALES REPORT
// ==========================================

export type SalesReportParams = {
  startDate?: string | null;
  endDate?: string | null;
  customerId?: string | null;
  saleType?: SaleType | null;
  page?: number;
  limit?: number;
};

export type SalesReportResult = {
  summary: {
    totalRevenue: number;
    totalPaid: number;
    totalCredit: number;
    totalInvoices: number;
    totalCratesSold: number;
    averageInvoiceValue: number;
    totalProfit?: number; // OWNER ONLY
    marginPercent?: number; // OWNER ONLY
  };
  invoices: {
    id: string;
    invoiceNumber: string;
    soldAt: Date;
    customerName: string;
    saleType: SaleType;
    totalCrates: number;
    subtotal: number;
    discount: number;
    totalAmount: number;
    paidAmount: number;
    creditAmount: number;
    cashierName: string;
    cost?: number; // OWNER ONLY
    profit?: number; // OWNER ONLY
    margin?: number; // OWNER ONLY
  }[];
  pagination: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

export async function getSalesReport(
  params: SalesReportParams,
  isOwner: boolean
): Promise<SalesReportResult> {
  const { start, end } = parseDateFilter(params.startDate, params.endDate);
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(10, Math.min(100, params.limit || 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.SaleWhereInput = {
    soldAt: { gte: start, lte: end },
    status: SaleStatus.COMPLETED,
  };

  if (params.customerId) {
    whereClause.customerId = params.customerId;
  }
  if (params.saleType) {
    whereClause.saleType = params.saleType;
  }

  // Aggregate totals
  const allMatching = await prisma.sale.findMany({
    where: whereClause,
    include: {
      items: {
        select: {
          quantity: true,
          totalAmount: true,
          purchaseCostAtSale: true,
        },
      },
    },
  });

  let totalRevenue = 0;
  let totalPaid = 0;
  let totalCredit = 0;
  let totalCratesSold = 0;
  let totalCost = 0;

  for (const s of allMatching) {
    totalRevenue += Number(s.totalAmount);
    totalPaid += Number(s.paidAmount);
    totalCredit += Number(s.creditAmount);
    for (const i of s.items) {
      totalCratesSold += i.quantity;
      if (isOwner) {
        totalCost += i.quantity * Number(i.purchaseCostAtSale);
      }
    }
  }

  const totalInvoices = allMatching.length;
  const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
  const totalProfit = isOwner ? totalRevenue - totalCost : undefined;
  const marginPercent =
    isOwner && totalRevenue > 0 ? ((totalProfit || 0) / totalRevenue) * 100 : undefined;

  // Paginated list
  const paginatedSales = await prisma.sale.findMany({
    where: whereClause,
    orderBy: { soldAt: "desc" },
    skip,
    take: limit,
    include: {
      customer: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: {
        select: {
          quantity: true,
          purchaseCostAtSale: true,
        },
      },
    },
  });

  const invoices = paginatedSales.map((s) => {
    let crates = 0;
    let cost = 0;
    for (const i of s.items) {
      crates += i.quantity;
      if (isOwner) {
        cost += i.quantity * Number(i.purchaseCostAtSale);
      }
    }

    const tot = Number(s.totalAmount);
    const profit = isOwner ? tot - cost : undefined;
    const margin = isOwner && tot > 0 ? (profit! / tot) * 100 : undefined;

    return {
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      soldAt: s.soldAt,
      customerName: s.customer?.name || "No Customer",
      saleType: s.saleType,
      totalCrates: crates,
      subtotal: Number(s.subtotal),
      discount: Number(s.discount),
      totalAmount: tot,
      paidAmount: Number(s.paidAmount),
      creditAmount: Number(s.creditAmount),
      cashierName: s.createdBy.name,
      cost: isOwner ? cost : undefined,
      profit: isOwner ? profit : undefined,
      margin: isOwner ? margin : undefined,
    };
  });

  return {
    summary: {
      totalRevenue,
      totalPaid,
      totalCredit,
      totalInvoices,
      totalCratesSold,
      averageInvoiceValue,
      totalProfit,
      marginPercent,
    },
    invoices,
    pagination: {
      totalRecords: totalInvoices,
      totalPages: Math.ceil(totalInvoices / limit) || 1,
      currentPage: page,
      limit,
    },
  };
}

// ==========================================
// 3. RECEIVING REPORT
// ==========================================

export type ReceivingReportParams = {
  startDate?: string | null;
  endDate?: string | null;
  supplierId?: string | null;
  productId?: string | null;
  page?: number;
  limit?: number;
};

export type ReceivingReportResult = {
  summary: {
    totalDeliveries: number;
    totalCratesReceived: number;
    totalPurchaseCost?: number; // OWNER ONLY
  };
  deliveries: {
    id: string;
    referenceNumber: string | null;
    receivedAt: Date;
    supplierName: string;
    receivedByName: string;
    totalCrates: number;
    itemsCount: number;
    totalCost?: number; // OWNER ONLY
    items: {
      productId: string;
      productName: string;
      brand: string;
      quantity: number;
      purchasePrice?: number; // OWNER ONLY
      totalCost?: number; // OWNER ONLY
    }[];
  }[];
  pagination: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

export async function getReceivingReport(
  params: ReceivingReportParams,
  isOwner: boolean
): Promise<ReceivingReportResult> {
  const { start, end } = parseDateFilter(params.startDate, params.endDate);
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(10, Math.min(100, params.limit || 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.ReceivingWhereInput = {
    receivedAt: { gte: start, lte: end },
  };

  if (params.supplierId) {
    whereClause.supplierId = params.supplierId;
  }
  if (params.productId) {
    whereClause.items = { some: { productId: params.productId } };
  }

  // Summary aggregation
  const allDeliveries = await prisma.receiving.findMany({
    where: whereClause,
    include: {
      items: {
        select: {
          quantity: true,
          totalCost: true,
          productId: true,
        },
      },
    },
  });

  let totalCratesReceived = 0;
  let totalPurchaseCost = 0;

  for (const d of allDeliveries) {
    for (const item of d.items) {
      if (!params.productId || item.productId === params.productId) {
        totalCratesReceived += item.quantity;
        if (isOwner) {
          totalPurchaseCost += Number(item.totalCost);
        }
      }
    }
  }

  const totalDeliveries = allDeliveries.length;

  // Paginated records
  const paginated = await prisma.receiving.findMany({
    where: whereClause,
    orderBy: { receivedAt: "desc" },
    skip,
    take: limit,
    include: {
      supplier: { select: { name: true } },
      createdBy: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, brand: true } },
        },
      },
    },
  });

  const deliveries = paginated.map((d) => {
    let crates = 0;
    let cost = 0;

    const filteredItems = d.items
      .filter((i) => !params.productId || i.productId === params.productId)
      .map((i) => {
        crates += i.quantity;
        if (isOwner) {
          cost += Number(i.totalCost);
        }
        return {
          productId: i.productId,
          productName: i.product.name,
          brand: i.product.brand,
          quantity: i.quantity,
          purchasePrice: isOwner ? Number(i.purchasePrice) : undefined,
          totalCost: isOwner ? Number(i.totalCost) : undefined,
        };
      });

    return {
      id: d.id,
      referenceNumber: d.referenceNumber,
      receivedAt: d.receivedAt,
      supplierName: d.supplier.name,
      receivedByName: d.createdBy.name,
      totalCrates: crates,
      itemsCount: filteredItems.length,
      totalCost: isOwner ? cost : undefined,
      items: filteredItems,
    };
  });

  return {
    summary: {
      totalDeliveries,
      totalCratesReceived,
      totalPurchaseCost: isOwner ? totalPurchaseCost : undefined,
    },
    deliveries,
    pagination: {
      totalRecords: totalDeliveries,
      totalPages: Math.ceil(totalDeliveries / limit) || 1,
      currentPage: page,
      limit,
    },
  };
}

// ==========================================
// 4. DISPATCH REPORT (STOCK OUT)
// ==========================================

export type DispatchReportParams = {
  startDate?: string | null;
  endDate?: string | null;
  productId?: string | null;
  customerId?: string | null;
  page?: number;
  limit?: number;
};

export type DispatchReportResult = {
  summary: {
    totalDispatchesCount: number;
    totalCratesDispatched: number;
  };
  dispatches: {
    id: string;
    dispatchedAt: Date;
    productName: string;
    productBrand: string;
    quantity: number;
    invoiceNumber: string | null;
    customerName: string | null;
    dispatchedByName: string;
    notes: string | null;
  }[];
  pagination: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

export async function getDispatchReport(
  params: DispatchReportParams
): Promise<DispatchReportResult> {
  const { start, end } = parseDateFilter(params.startDate, params.endDate);
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(10, Math.min(100, params.limit || 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.StockMovementWhereInput = {
    movementType: MovementType.SALE,
    createdAt: { gte: start, lte: end },
  };

  if (params.productId) {
    whereClause.productId = params.productId;
  }

  // Summary aggregation
  const agg = await prisma.stockMovement.aggregate({
    where: whereClause,
    _count: { id: true },
    _sum: { quantity: true },
  });

  const totalDispatchesCount = agg._count.id;
  const totalCratesDispatched = agg._sum.quantity || 0;

  // Paginated movements
  const movements = await prisma.stockMovement.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    skip,
    take: limit,
    include: {
      product: { select: { name: true, brand: true } },
      createdBy: { select: { name: true } },
    },
  });

  // Collect linked sale IDs to fetch invoice and customer details
  const saleIds = movements
    .filter((m) => m.referenceType === "Sale" && m.referenceId)
    .map((m) => m.referenceId);

  const sales = await prisma.sale.findMany({
    where: { id: { in: saleIds } },
    select: {
      id: true,
      invoiceNumber: true,
      customerId: true,
      customer: { select: { name: true } },
    },
  });

  const salesMap = new Map(sales.map((s) => [s.id, s]));

  const dispatches = movements
    .filter((m) => {
      if (!params.customerId) return true;
      const sale = salesMap.get(m.referenceId);
      return sale?.customerId === params.customerId;
    })
    .map((m) => {
      const sale = salesMap.get(m.referenceId);
      return {
        id: m.id,
        dispatchedAt: m.createdAt,
        productName: m.product.name,
        productBrand: m.product.brand,
        quantity: m.quantity,
        invoiceNumber: sale?.invoiceNumber || null,
        customerName: sale?.customer?.name || (sale ? "No Customer" : null),
        dispatchedByName: m.createdBy.name,
        notes: m.notes,
      };
    });

  return {
    summary: {
      totalDispatchesCount,
      totalCratesDispatched,
    },
    dispatches,
    pagination: {
      totalRecords: totalDispatchesCount,
      totalPages: Math.ceil(totalDispatchesCount / limit) || 1,
      currentPage: page,
      limit,
    },
  };
}

// ==========================================
// 5. STOCK & INVENTORY REPORT
// ==========================================

export type StockReportParams = {
  search?: string | null;
  statusFilter?: "ALL" | "LOW_STOCK" | "OUT_OF_STOCK" | "IN_STOCK";
  page?: number;
  limit?: number;
};

export type StockReportResult = {
  summary: {
    totalProducts: number;
    totalStockCrates: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalValuation?: number; // OWNER ONLY
  };
  products: {
    id: string;
    name: string;
    brand: string;
    sku: string | null;
    currentStock: number;
    minimumStockLevel: number;
    status: "OUT_OF_STOCK" | "LOW_STOCK" | "OPTIMAL";
    latestPurchasePrice?: number; // OWNER ONLY
    inventoryValue?: number; // OWNER ONLY
  }[];
  pagination: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

export async function getStockReport(
  params: StockReportParams,
  isOwner: boolean
): Promise<StockReportResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(10, Math.min(100, params.limit || 50));

  // 1. Authoritative current stock from StockMovement
  const movements = await prisma.stockMovement.groupBy({
    by: ["productId", "movementType"],
    _sum: { quantity: true },
  });

  const stockMap = new Map<string, number>();
  for (const m of movements) {
    const qty = m._sum.quantity || 0;
    const isAdd =
      m.movementType === MovementType.RECEIVING ||
      m.movementType === MovementType.SALE_CANCELLATION ||
      m.movementType === MovementType.RETURN_RESTOCK ||
      m.movementType === MovementType.ADJUSTMENT_ADD;
    const current = stockMap.get(m.productId) || 0;
    stockMap.set(m.productId, current + (isAdd ? Math.abs(qty) : -Math.abs(qty)));
  }

  // 2. Fetch products
  const whereClause: Prisma.ProductWhereInput = { isActive: true };
  if (params.search?.trim()) {
    whereClause.OR = [
      { name: { contains: params.search.trim(), mode: "insensitive" } },
      { brand: { contains: params.search.trim(), mode: "insensitive" } },
    ];
  }

  const allProducts = await prisma.product.findMany({
    where: whereClause,
    orderBy: { name: "asc" },
  });

  let totalStockCrates = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalValuation = 0;

  const productRows = allProducts.map((p) => {
    const currentStock = stockMap.get(p.id) || 0;
    totalStockCrates += Math.max(0, currentStock);

    let status: "OUT_OF_STOCK" | "LOW_STOCK" | "OPTIMAL" = "OPTIMAL";
    if (currentStock <= 0) {
      status = "OUT_OF_STOCK";
      outOfStockCount++;
    } else if (currentStock <= p.minimumStockLevel) {
      status = "LOW_STOCK";
      lowStockCount++;
    }

    const price = Number(p.latestPurchasePrice);
    const value = Math.max(0, currentStock) * price;
    if (isOwner) {
      totalValuation += value;
    }

    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      sku: p.sku,
      currentStock,
      minimumStockLevel: p.minimumStockLevel,
      status,
      latestPurchasePrice: isOwner ? price : undefined,
      inventoryValue: isOwner ? value : undefined,
    };
  });

  // Apply optional status filter
  let filtered = productRows;
  if (params.statusFilter === "LOW_STOCK") {
    filtered = productRows.filter((p) => p.status === "LOW_STOCK");
  } else if (params.statusFilter === "OUT_OF_STOCK") {
    filtered = productRows.filter((p) => p.status === "OUT_OF_STOCK");
  } else if (params.statusFilter === "IN_STOCK") {
    filtered = productRows.filter((p) => p.status === "OPTIMAL");
  }

  const totalRecords = filtered.length;
  const skip = (page - 1) * limit;
  const paginated = filtered.slice(skip, skip + limit);

  return {
    summary: {
      totalProducts: allProducts.length,
      totalStockCrates,
      lowStockCount,
      outOfStockCount,
      totalValuation: isOwner ? totalValuation : undefined,
    },
    products: paginated,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit) || 1,
      currentPage: page,
      limit,
    },
  };
}

// ==========================================
// 6. CUSTOMER CREDIT & LEDGER REPORT
// ==========================================

export type CustomerReportParams = {
  search?: string | null;
  onlyWithBalance?: boolean;
  page?: number;
  limit?: number;
};

export type CustomerReportResult = {
  summary: {
    totalActiveCustomers: number;
    totalCreditOutstanding: number;
    customersWithBalanceCount: number;
  };
  customers: {
    id: string;
    name: string;
    phone: string | null;
    priceTier: PriceTier;
    creditAllowed: boolean;
    totalSalesAmount: number;
    totalCratesBought: number;
    totalPaymentsAmount: number;
    outstandingBalance: number;
    glassBottleBalance: number;
    plasticCrateBalance: number;
  }[];
  pagination: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

export async function getCustomerReport(
  params: CustomerReportParams
): Promise<CustomerReportResult> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(10, Math.min(100, params.limit || 50));

  const whereClause: Prisma.CustomerWhereInput = { isActive: true };
  if (params.search?.trim()) {
    whereClause.OR = [
      { name: { contains: params.search.trim(), mode: "insensitive" } },
      { phone: { contains: params.search.trim() } },
    ];
  }

  const allCustomers = await prisma.customer.findMany({
    where: whereClause,
    orderBy: { name: "asc" },
  });

  // Sales grouped by customer
  const customerSales = await prisma.sale.groupBy({
    by: ["customerId"],
    where: {
      status: SaleStatus.COMPLETED,
      customerId: { not: null },
    },
    _sum: { totalAmount: true },
  });
  const salesAmountMap = new Map(
    customerSales.map((s) => [s.customerId!, Number(s._sum.totalAmount || 0)])
  );

  // Crates sold per customer
  const customerCrates = await prisma.saleItem.groupBy({
    by: ["saleId"],
    where: {
      sale: { status: SaleStatus.COMPLETED, customerId: { not: null } },
    },
    _sum: { quantity: true },
  });

  // Map saleId to customerId
  const salesWithCustomer = await prisma.sale.findMany({
    where: { customerId: { not: null }, status: SaleStatus.COMPLETED },
    select: { id: true, customerId: true },
  });
  const saleCustomerMap = new Map(salesWithCustomer.map((s) => [s.id, s.customerId!]));

  const cratesMap = new Map<string, number>();
  for (const cc of customerCrates) {
    const cid = saleCustomerMap.get(cc.saleId);
    if (cid) {
      cratesMap.set(cid, (cratesMap.get(cid) || 0) + (cc._sum.quantity || 0));
    }
  }

  // Payments grouped by customer (excluding cancelled sales)
  const customerPayments = await prisma.payment.groupBy({
    by: ["customerId"],
    where: {
      customerId: { not: null },
      OR: [{ saleId: null }, { sale: { status: SaleStatus.COMPLETED } }],
    },
    _sum: { amount: true },
  });
  const paymentsMap = new Map(
    customerPayments.map((p) => [p.customerId!, Number(p._sum.amount || 0)])
  );

  // Container balances
  const containerMovements = await prisma.containerMovement.groupBy({
    by: ["customerId", "containerType", "movementType"],
    _sum: { quantity: true },
  });

  const glassMap = new Map<string, number>();
  const plasticMap = new Map<string, number>();

  for (const cm of containerMovements) {
    const qty = cm._sum.quantity || 0;
    const isDebit = cm.movementType === ContainerMovementType.DEBIT;
    const delta = isDebit ? qty : -qty;

    if (cm.containerType === ContainerType.GLASS_BOTTLE) {
      glassMap.set(cm.customerId, (glassMap.get(cm.customerId) || 0) + delta);
    } else {
      plasticMap.set(cm.customerId, (plasticMap.get(cm.customerId) || 0) + delta);
    }
  }

  let totalCreditOutstanding = 0;
  let customersWithBalanceCount = 0;

  const rows = allCustomers.map((c) => {
    const salesTot = salesAmountMap.get(c.id) || 0;
    const paymentsTot = paymentsMap.get(c.id) || 0;
    const balance = Math.max(0, salesTot - paymentsTot);

    if (balance > 0.01) {
      totalCreditOutstanding += balance;
      customersWithBalanceCount++;
    }

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      priceTier: c.priceTier,
      creditAllowed: c.creditAllowed,
      totalSalesAmount: salesTot,
      totalCratesBought: cratesMap.get(c.id) || 0,
      totalPaymentsAmount: paymentsTot,
      outstandingBalance: balance,
      glassBottleBalance: glassMap.get(c.id) || 0,
      plasticCrateBalance: plasticMap.get(c.id) || 0,
    };
  });

  let filtered = rows;
  if (params.onlyWithBalance) {
    filtered = rows.filter((r) => r.outstandingBalance > 0.01);
  }

  const totalRecords = filtered.length;
  const skip = (page - 1) * limit;
  const paginated = filtered.slice(skip, skip + limit);

  return {
    summary: {
      totalActiveCustomers: allCustomers.length,
      totalCreditOutstanding,
      customersWithBalanceCount,
    },
    customers: paginated,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit) || 1,
      currentPage: page,
      limit,
    },
  };
}

// ==========================================
// 7. DAMAGE & WRITE-OFF REPORT
// ==========================================

export type DamageReportParams = {
  startDate?: string | null;
  endDate?: string | null;
  productId?: string | null;
  damageType?: DamageType | null;
  page?: number;
  limit?: number;
};

export type DamageReportResult = {
  summary: {
    totalRecords: number;
    totalCratesDamaged: number;
    totalCostLoss?: number; // OWNER ONLY
    typeBreakdown: {
      damageType: DamageType;
      crates: number;
    }[];
  };
  records: {
    id: string;
    recordedAt: Date;
    productName: string;
    productBrand: string;
    quantity: number;
    damageType: DamageType;
    reason: string | null;
    recordedByName: string;
    costLoss?: number; // OWNER ONLY
  }[];
  pagination: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

export async function getDamageReport(
  params: DamageReportParams,
  isOwner: boolean
): Promise<DamageReportResult> {
  const { start, end } = parseDateFilter(params.startDate, params.endDate);
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(10, Math.min(100, params.limit || 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.DamageRecordWhereInput = {
    recordedAt: { gte: start, lte: end },
  };

  if (params.productId) {
    whereClause.productId = params.productId;
  }
  if (params.damageType) {
    whereClause.damageType = params.damageType;
  }

  // All matching for summary
  const allRecords = await prisma.damageRecord.findMany({
    where: whereClause,
    include: {
      product: { select: { latestPurchasePrice: true } },
    },
  });

  let totalCratesDamaged = 0;
  let totalCostLoss = 0;
  const breakdownMap = new Map<DamageType, number>();

  for (const r of allRecords) {
    totalCratesDamaged += r.quantity;
    if (isOwner) {
      totalCostLoss += r.quantity * Number(r.product.latestPurchasePrice);
    }
    breakdownMap.set(r.damageType, (breakdownMap.get(r.damageType) || 0) + r.quantity);
  }

  const typeBreakdown = Object.values(DamageType).map((type) => ({
    damageType: type,
    crates: breakdownMap.get(type) || 0,
  }));

  const totalRecords = allRecords.length;

  // Paginated records
  const paginated = await prisma.damageRecord.findMany({
    where: whereClause,
    orderBy: { recordedAt: "desc" },
    skip,
    take: limit,
    include: {
      product: { select: { name: true, brand: true, latestPurchasePrice: true } },
      recordedBy: { select: { name: true } },
    },
  });

  const records = paginated.map((r) => {
    const cost = isOwner ? r.quantity * Number(r.product.latestPurchasePrice) : undefined;
    return {
      id: r.id,
      recordedAt: r.recordedAt,
      productName: r.product.name,
      productBrand: r.product.brand,
      quantity: r.quantity,
      damageType: r.damageType,
      reason: r.reason,
      recordedByName: r.recordedBy.name,
      costLoss: cost,
    };
  });

  return {
    summary: {
      totalRecords,
      totalCratesDamaged,
      totalCostLoss: isOwner ? totalCostLoss : undefined,
      typeBreakdown,
    },
    records,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit) || 1,
      currentPage: page,
      limit,
    },
  };
}

// ==========================================
// 8. PRICES & CATALOG REPORT
// ==========================================

export type PriceReportParams = {
  search?: string | null;
  tier?: PriceTier | null;
  includeHistory?: boolean;
};

export type PriceReportResult = {
  catalog: {
    productId: string;
    productName: string;
    brand: string;
    latestPurchasePrice?: number; // OWNER ONLY
    retailPrice: number | null;
    wholesalePrice: number | null;
    keyAccountPrice: number | null;
    retailMargin?: number; // OWNER ONLY
    wholesaleMargin?: number; // OWNER ONLY
    keyAccountMargin?: number; // OWNER ONLY
  }[];
  history?: {
    id: string;
    productName: string;
    tier: PriceTier;
    amount: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    createdByName: string;
  }[];
};

export async function getPriceReport(
  params: PriceReportParams,
  isOwner: boolean
): Promise<PriceReportResult> {
  const whereProduct: Prisma.ProductWhereInput = { isActive: true };
  if (params.search?.trim()) {
    whereProduct.OR = [
      { name: { contains: params.search.trim(), mode: "insensitive" } },
      { brand: { contains: params.search.trim(), mode: "insensitive" } },
    ];
  }

  const products = await prisma.product.findMany({
    where: whereProduct,
    include: {
      prices: {
        where: { effectiveTo: null }, // Active prices
      },
    },
    orderBy: { name: "asc" },
  });

  const catalog = products.map((p) => {
    const cost = isOwner ? Number(p.latestPurchasePrice) : 0;

    let retailPrice: number | null = null;
    let wholesalePrice: number | null = null;
    let keyAccountPrice: number | null = null;

    for (const pr of p.prices) {
      if (pr.tier === PriceTier.RETAIL) retailPrice = Number(pr.amount);
      if (pr.tier === PriceTier.WHOLESALE) wholesalePrice = Number(pr.amount);
      if (pr.tier === PriceTier.KEY_ACCOUNT) keyAccountPrice = Number(pr.amount);
    }

    const calcMargin = (price: number | null) => {
      if (!isOwner || price === null || price <= 0) return undefined;
      return ((price - cost) / price) * 100;
    };

    return {
      productId: p.id,
      productName: p.name,
      brand: p.brand,
      latestPurchasePrice: isOwner ? cost : undefined,
      retailPrice,
      wholesalePrice,
      keyAccountPrice,
      retailMargin: calcMargin(retailPrice),
      wholesaleMargin: calcMargin(wholesalePrice),
      keyAccountMargin: calcMargin(keyAccountPrice),
    };
  });

  let history: PriceReportResult["history"] = undefined;
  if (params.includeHistory) {
    const rawHistory = await prisma.price.findMany({
      where: {
        product: whereProduct,
        ...(params.tier ? { tier: params.tier } : {}),
      },
      orderBy: { effectiveFrom: "desc" },
      take: 100,
      include: {
        product: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    });

    history = rawHistory.map((h) => ({
      id: h.id,
      productName: h.product.name,
      tier: h.tier,
      amount: Number(h.amount),
      effectiveFrom: h.effectiveFrom,
      effectiveTo: h.effectiveTo,
      createdByName: h.createdBy.name,
    }));
  }

  return { catalog, history };
}

// ==========================================
// 9. PROFIT & MARGIN REPORT (OWNER ONLY)
// ==========================================

export type ProfitReportParams = {
  startDate?: string | null;
  endDate?: string | null;
  productId?: string | null;
  customerId?: string | null;
  page?: number;
  limit?: number;
};

export type ProfitReportResult = {
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalGrossProfit: number;
    marginPercent: number;
    cratesSold: number;
  };
  byProduct: {
    productId: string;
    productName: string;
    brand: string;
    cratesSold: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPercent: number;
  }[];
  byCustomer: {
    customerId: string;
    customerName: string;
    cratesSold: number;
    revenue: number;
    cost: number;
    profit: number;
    marginPercent: number;
  }[];
  invoices: {
    invoiceId: string;
    invoiceNumber: string;
    soldAt: Date;
    customerName: string;
    totalAmount: number;
    totalCost: number;
    profit: number;
    marginPercent: number;
  }[];
  pagination: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    limit: number;
  };
};

export async function getProfitReport(
  params: ProfitReportParams
): Promise<ProfitReportResult> {
  const { start, end } = parseDateFilter(params.startDate, params.endDate);
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(10, Math.min(100, params.limit || 50));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.SaleWhereInput = {
    soldAt: { gte: start, lte: end },
    status: SaleStatus.COMPLETED,
  };

  if (params.customerId) {
    whereClause.customerId = params.customerId;
  }
  if (params.productId) {
    whereClause.items = { some: { productId: params.productId } };
  }

  const allSales = await prisma.sale.findMany({
    where: whereClause,
    include: {
      customer: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, brand: true } },
        },
      },
    },
    orderBy: { soldAt: "desc" },
  });

  let totalRevenue = 0;
  let totalCost = 0;
  let totalCratesSold = 0;

  const productAgg = new Map<
    string,
    {
      productName: string;
      brand: string;
      crates: number;
      revenue: number;
      cost: number;
    }
  >();

  const customerAgg = new Map<
    string,
    {
      customerName: string;
      crates: number;
      revenue: number;
      cost: number;
    }
  >();

  const invoiceRows = allSales.map((s) => {
    let invCost = 0;
    const invRev = Number(s.totalAmount);
    let invCrates = 0;

    const cId = s.customerId || "ANONYMOUS";
    const cName = s.customer?.name || "No Customer";

    for (const item of s.items) {
      if (!params.productId || item.productId === params.productId) {
        const itemCost = item.quantity * Number(item.purchaseCostAtSale);
        const itemRev = Number(item.totalAmount);

        invCost += itemCost;
        invCrates += item.quantity;

        // Product aggregator
        const existingP = productAgg.get(item.productId) || {
          productName: item.product.name,
          brand: item.product.brand,
          crates: 0,
          revenue: 0,
          cost: 0,
        };
        existingP.crates += item.quantity;
        existingP.revenue += itemRev;
        existingP.cost += itemCost;
        productAgg.set(item.productId, existingP);

        // Customer aggregator
        const existingC = customerAgg.get(cId) || {
          customerName: cName,
          crates: 0,
          revenue: 0,
          cost: 0,
        };
        existingC.crates += item.quantity;
        existingC.revenue += itemRev;
        existingC.cost += itemCost;
        customerAgg.set(cId, existingC);
      }
    }

    totalRevenue += invRev;
    totalCost += invCost;
    totalCratesSold += invCrates;

    const profit = invRev - invCost;
    const margin = invRev > 0 ? (profit / invRev) * 100 : 0;

    return {
      invoiceId: s.id,
      invoiceNumber: s.invoiceNumber,
      soldAt: s.soldAt,
      customerName: cName,
      totalAmount: invRev,
      totalCost: invCost,
      profit,
      marginPercent: margin,
    };
  });

  const totalGrossProfit = totalRevenue - totalCost;
  const overallMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  // By product list
  const byProduct = Array.from(productAgg.entries()).map(([pid, val]) => {
    const profit = val.revenue - val.cost;
    const margin = val.revenue > 0 ? (profit / val.revenue) * 100 : 0;
    return {
      productId: pid,
      productName: val.productName,
      brand: val.brand,
      cratesSold: val.crates,
      revenue: val.revenue,
      cost: val.cost,
      profit,
      marginPercent: margin,
    };
  }).sort((a, b) => b.profit - a.profit);

  // By customer list
  const byCustomer = Array.from(customerAgg.entries()).map(([cid, val]) => {
    const profit = val.revenue - val.cost;
    const margin = val.revenue > 0 ? (profit / val.revenue) * 100 : 0;
    return {
      customerId: cid,
      customerName: val.customerName,
      cratesSold: val.crates,
      revenue: val.revenue,
      cost: val.cost,
      profit,
      marginPercent: margin,
    };
  }).sort((a, b) => b.profit - a.profit);

  const totalRecords = invoiceRows.length;
  const paginatedInvoices = invoiceRows.slice(skip, skip + limit);

  return {
    summary: {
      totalRevenue,
      totalCost,
      totalGrossProfit,
      marginPercent: overallMargin,
      cratesSold: totalCratesSold,
    },
    byProduct,
    byCustomer,
    invoices: paginatedInvoices,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit) || 1,
      currentPage: page,
      limit,
    },
  };
}

// ==========================================
// 10. CSV / EXCEL EXPORT BUILDER
// ==========================================

// ==========================================
// 10. FAST / SLOW MOVING REPORT
// ==========================================

export type FastSlowMovingParams = {
  startDate?: string | null;
  endDate?: string | null;
};

export type FastSlowMovingRow = {
  productId: string;
  productName: string;
  productBrand: string;
  cratesSold: number;
  averageCratesSold: number;
  classification: "FAST" | "SLOW" | "AVERAGE";
};

export type FastSlowMovingResult = {
  rows: FastSlowMovingRow[];
  periodStart: string;
  periodEnd: string;
  fastCount: number;
  slowCount: number;
  averageCount: number;
};

export async function getFastSlowMovingReport(
  params: FastSlowMovingParams
): Promise<FastSlowMovingResult> {
  const { start, end, startStr, endStr } = parseDateFilter(params.startDate, params.endDate);

  // All completed sales in the period — fetch per-product totals via SaleItem
  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        status: SaleStatus.COMPLETED,
        soldAt: { gte: start, lte: end },
      },
    },
    select: {
      productId: true,
      quantity: true,
      product: { select: { name: true, brand: true } },
    },
  });

  // Aggregate per product
  const productMap = new Map<
    string,
    { name: string; brand: string; totalCrates: number }
  >();

  for (const item of saleItems) {
    const existing = productMap.get(item.productId);
    if (existing) {
      existing.totalCrates += item.quantity;
    } else {
      productMap.set(item.productId, {
        name: item.product.name,
        brand: item.product.brand,
        totalCrates: item.quantity,
      });
    }
  }

  if (productMap.size === 0) {
    return {
      rows: [],
      periodStart: startStr,
      periodEnd: endStr,
      fastCount: 0,
      slowCount: 0,
      averageCount: 0,
    };
  }

  const rows = Array.from(productMap.entries()).map(([productId, v]) => ({
    productId,
    productName: v.name,
    productBrand: v.brand,
    cratesSold: v.totalCrates,
  }));

  // Compute average crates sold across all products that had any sales
  const totalCrates = rows.reduce((acc, r) => acc + r.cratesSold, 0);
  const averageCratesSold = totalCrates / rows.length;

  // Rule A: exact average = AVERAGE
  const result: FastSlowMovingRow[] = rows.map((r) => {
    let classification: "FAST" | "SLOW" | "AVERAGE";
    if (r.cratesSold > averageCratesSold) classification = "FAST";
    else if (r.cratesSold < averageCratesSold) classification = "SLOW";
    else classification = "AVERAGE";

    return {
      ...r,
      averageCratesSold: Math.round(averageCratesSold * 100) / 100,
      classification,
    };
  });

  // Sort: FAST first, then AVERAGE, then SLOW, alpha within group
  result.sort((a, b) => {
    const order = { FAST: 0, AVERAGE: 1, SLOW: 2 };
    if (order[a.classification] !== order[b.classification])
      return order[a.classification] - order[b.classification];
    return a.productName.localeCompare(b.productName);
  });

  return {
    rows: result,
    periodStart: startStr,
    periodEnd: endStr,
    fastCount: result.filter((r) => r.classification === "FAST").length,
    slowCount: result.filter((r) => r.classification === "SLOW").length,
    averageCount: result.filter((r) => r.classification === "AVERAGE").length,
  };
}

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function generateReportCsv(
  reportType: string,
  params: Record<string, string | undefined>,
  isOwner: boolean
): Promise<{ filename: string; csv: string }> {
  const timestamp = new Date().toISOString().slice(0, 10);

  switch (reportType) {
    case "sales": {
      const data = await getSalesReport({ ...params, limit: 10000 }, isOwner);
      const headers = isOwner
        ? [
            "Invoice #",
            "Date",
            "Customer",
            "Sale Type",
            "Crates",
            "Subtotal",
            "Discount",
            "Total Amount",
            "Paid Amount",
            "Credit Amount",
            "Cost",
            "Profit",
            "Margin %",
            "Cashier",
          ]
        : [
            "Invoice #",
            "Date",
            "Customer",
            "Sale Type",
            "Crates",
            "Subtotal",
            "Discount",
            "Total Amount",
            "Paid Amount",
            "Credit Amount",
            "Cashier",
          ];

      const lines = [headers.join(",")];
      for (const inv of data.invoices) {
        const row = isOwner
          ? [
              escapeCsvField(inv.invoiceNumber),
              escapeCsvField(new Date(inv.soldAt).toLocaleDateString()),
              escapeCsvField(inv.customerName),
              escapeCsvField(inv.saleType),
              escapeCsvField(inv.totalCrates),
              escapeCsvField(inv.subtotal.toFixed(2)),
              escapeCsvField(inv.discount.toFixed(2)),
              escapeCsvField(inv.totalAmount.toFixed(2)),
              escapeCsvField(inv.paidAmount.toFixed(2)),
              escapeCsvField(inv.creditAmount.toFixed(2)),
              escapeCsvField((inv.cost || 0).toFixed(2)),
              escapeCsvField((inv.profit || 0).toFixed(2)),
              escapeCsvField(`${(inv.margin || 0).toFixed(2)}%`),
              escapeCsvField(inv.cashierName),
            ]
          : [
              escapeCsvField(inv.invoiceNumber),
              escapeCsvField(new Date(inv.soldAt).toLocaleDateString()),
              escapeCsvField(inv.customerName),
              escapeCsvField(inv.saleType),
              escapeCsvField(inv.totalCrates),
              escapeCsvField(inv.subtotal.toFixed(2)),
              escapeCsvField(inv.discount.toFixed(2)),
              escapeCsvField(inv.totalAmount.toFixed(2)),
              escapeCsvField(inv.paidAmount.toFixed(2)),
              escapeCsvField(inv.creditAmount.toFixed(2)),
              escapeCsvField(inv.cashierName),
            ];
        lines.push(row.join(","));
      }
      return { filename: `sales_report_${timestamp}.csv`, csv: lines.join("\n") };
    }

    case "receiving": {
      const data = await getReceivingReport({ ...params, limit: 10000 }, isOwner);
      const headers = isOwner
        ? [
            "Reference #",
            "Date",
            "Supplier",
            "Product",
            "Brand",
            "Crates Received",
            "Purchase Cost Per Crate",
            "Total Delivery Cost",
            "Received By",
          ]
        : [
            "Reference #",
            "Date",
            "Supplier",
            "Product",
            "Brand",
            "Crates Received",
            "Received By",
          ];

      const lines = [headers.join(",")];
      for (const d of data.deliveries) {
        for (const i of d.items) {
          const row = isOwner
            ? [
                escapeCsvField(d.referenceNumber || ""),
                escapeCsvField(new Date(d.receivedAt).toLocaleDateString()),
                escapeCsvField(d.supplierName),
                escapeCsvField(i.productName),
                escapeCsvField(i.brand),
                escapeCsvField(i.quantity),
                escapeCsvField((i.purchasePrice || 0).toFixed(2)),
                escapeCsvField((i.totalCost || 0).toFixed(2)),
                escapeCsvField(d.receivedByName),
              ]
            : [
                escapeCsvField(d.referenceNumber || ""),
                escapeCsvField(new Date(d.receivedAt).toLocaleDateString()),
                escapeCsvField(d.supplierName),
                escapeCsvField(i.productName),
                escapeCsvField(i.brand),
                escapeCsvField(i.quantity),
                escapeCsvField(d.receivedByName),
              ];
          lines.push(row.join(","));
        }
      }
      return { filename: `receiving_report_${timestamp}.csv`, csv: lines.join("\n") };
    }

    case "dispatch": {
      const data = await getDispatchReport({ ...params, limit: 10000 });
      const headers = [
        "Dispatched At",
        "Product",
        "Brand",
        "Crates Dispatched",
        "Invoice #",
        "Customer",
        "Dispatched By",
        "Notes",
      ];
      const lines = [headers.join(",")];
      for (const d of data.dispatches) {
        lines.push(
          [
            escapeCsvField(new Date(d.dispatchedAt).toLocaleString()),
            escapeCsvField(d.productName),
            escapeCsvField(d.productBrand),
            escapeCsvField(d.quantity),
            escapeCsvField(d.invoiceNumber || ""),
            escapeCsvField(d.customerName || ""),
            escapeCsvField(d.dispatchedByName),
            escapeCsvField(d.notes || ""),
          ].join(",")
        );
      }
      return { filename: `dispatch_report_${timestamp}.csv`, csv: lines.join("\n") };
    }

    case "stock": {
      const data = await getStockReport({ ...params, limit: 10000 }, isOwner);
      const headers = isOwner
        ? [
            "Product Name",
            "Brand",
            "Current Stock (Crates)",
            "Minimum Stock Level",
            "Stock Status",
            "Latest Cost Per Crate",
            "Total Inventory Valuation",
          ]
        : [
            "Product Name",
            "Brand",
            "Current Stock (Crates)",
            "Minimum Stock Level",
            "Stock Status",
          ];

      const lines = [headers.join(",")];
      for (const p of data.products) {
        const row = isOwner
          ? [
              escapeCsvField(p.name),
              escapeCsvField(p.brand),
              escapeCsvField(p.currentStock),
              escapeCsvField(p.minimumStockLevel),
              escapeCsvField(p.status),
              escapeCsvField((p.latestPurchasePrice || 0).toFixed(2)),
              escapeCsvField((p.inventoryValue || 0).toFixed(2)),
            ]
          : [
              escapeCsvField(p.name),
              escapeCsvField(p.brand),
              escapeCsvField(p.currentStock),
              escapeCsvField(p.minimumStockLevel),
              escapeCsvField(p.status),
            ];
        lines.push(row.join(","));
      }
      return { filename: `stock_inventory_report_${timestamp}.csv`, csv: lines.join("\n") };
    }

    case "customers": {
      const data = await getCustomerReport({ ...params, limit: 10000 });
      const headers = [
        "Customer Name",
        "Phone",
        "Price Tier",
        "Credit Allowed",
        "Total Sales ($)",
        "Crates Bought",
        "Total Payments ($)",
        "Outstanding Balance ($)",
        "Glass Bottle Balance",
        "Plastic Crate Balance",
      ];
      const lines = [headers.join(",")];
      for (const c of data.customers) {
        lines.push(
          [
            escapeCsvField(c.name),
            escapeCsvField(c.phone || ""),
            escapeCsvField(c.priceTier),
            escapeCsvField(c.creditAllowed ? "Yes" : "No"),
            escapeCsvField(c.totalSalesAmount.toFixed(2)),
            escapeCsvField(c.totalCratesBought),
            escapeCsvField(c.totalPaymentsAmount.toFixed(2)),
            escapeCsvField(c.outstandingBalance.toFixed(2)),
            escapeCsvField(c.glassBottleBalance),
            escapeCsvField(c.plasticCrateBalance),
          ].join(",")
        );
      }
      return { filename: `customers_credit_report_${timestamp}.csv`, csv: lines.join("\n") };
    }

    case "damage": {
      const data = await getDamageReport({ ...params, limit: 10000 }, isOwner);
      const headers = isOwner
        ? [
            "Recorded Date",
            "Product",
            "Brand",
            "Crates Damaged",
            "Damage Type",
            "Reason",
            "Cost Loss ($)",
            "Recorded By",
          ]
        : [
            "Recorded Date",
            "Product",
            "Brand",
            "Crates Damaged",
            "Damage Type",
            "Reason",
            "Recorded By",
          ];

      const lines = [headers.join(",")];
      for (const r of data.records) {
        const row = isOwner
          ? [
              escapeCsvField(new Date(r.recordedAt).toLocaleDateString()),
              escapeCsvField(r.productName),
              escapeCsvField(r.productBrand),
              escapeCsvField(r.quantity),
              escapeCsvField(r.damageType),
              escapeCsvField(r.reason || ""),
              escapeCsvField((r.costLoss || 0).toFixed(2)),
              escapeCsvField(r.recordedByName),
            ]
          : [
              escapeCsvField(new Date(r.recordedAt).toLocaleDateString()),
              escapeCsvField(r.productName),
              escapeCsvField(r.productBrand),
              escapeCsvField(r.quantity),
              escapeCsvField(r.damageType),
              escapeCsvField(r.reason || ""),
              escapeCsvField(r.recordedByName),
            ];
        lines.push(row.join(","));
      }
      return { filename: `damage_report_${timestamp}.csv`, csv: lines.join("\n") };
    }

    case "prices": {
      const data = await getPriceReport(params, isOwner);
      const headers = isOwner
        ? [
            "Product Name",
            "Brand",
            "Cost Per Crate",
            "Retail Price",
            "Retail Margin %",
            "Wholesale Price",
            "Wholesale Margin %",
            "Key Account Price",
            "Key Account Margin %",
          ]
        : [
            "Product Name",
            "Brand",
            "Retail Price",
            "Wholesale Price",
            "Key Account Price",
          ];

      const lines = [headers.join(",")];
      for (const p of data.catalog) {
        const row = isOwner
          ? [
              escapeCsvField(p.productName),
              escapeCsvField(p.brand),
              escapeCsvField((p.latestPurchasePrice || 0).toFixed(2)),
              escapeCsvField(p.retailPrice !== null ? p.retailPrice.toFixed(2) : ""),
              escapeCsvField(p.retailMargin !== undefined ? `${p.retailMargin.toFixed(2)}%` : ""),
              escapeCsvField(p.wholesalePrice !== null ? p.wholesalePrice.toFixed(2) : ""),
              escapeCsvField(p.wholesaleMargin !== undefined ? `${p.wholesaleMargin.toFixed(2)}%` : ""),
              escapeCsvField(p.keyAccountPrice !== null ? p.keyAccountPrice.toFixed(2) : ""),
              escapeCsvField(p.keyAccountMargin !== undefined ? `${p.keyAccountMargin.toFixed(2)}%` : ""),
            ]
          : [
              escapeCsvField(p.productName),
              escapeCsvField(p.brand),
              escapeCsvField(p.retailPrice !== null ? p.retailPrice.toFixed(2) : ""),
              escapeCsvField(p.wholesalePrice !== null ? p.wholesalePrice.toFixed(2) : ""),
              escapeCsvField(p.keyAccountPrice !== null ? p.keyAccountPrice.toFixed(2) : ""),
            ];
        lines.push(row.join(","));
      }
      return { filename: `prices_catalog_report_${timestamp}.csv`, csv: lines.join("\n") };
    }

    case "profit": {
      if (!isOwner) {
        throw new Error("Unauthorized: Profit reports are restricted to Owner only.");
      }
      const data = await getProfitReport({ ...params, limit: 10000 });
      const headers = [
        "Invoice #",
        "Date",
        "Customer",
        "Revenue ($)",
        "Cost ($)",
        "Gross Profit ($)",
        "Margin %",
      ];
      const lines = [headers.join(",")];
      for (const inv of data.invoices) {
        lines.push(
          [
            escapeCsvField(inv.invoiceNumber),
            escapeCsvField(new Date(inv.soldAt).toLocaleDateString()),
            escapeCsvField(inv.customerName),
            escapeCsvField(inv.totalAmount.toFixed(2)),
            escapeCsvField(inv.totalCost.toFixed(2)),
            escapeCsvField(inv.profit.toFixed(2)),
            escapeCsvField(`${inv.marginPercent.toFixed(2)}%`),
          ].join(",")
        );
      }
      return { filename: `profit_margins_report_${timestamp}.csv`, csv: lines.join("\n") };
    }

    case "fast-slow": {
      const data = await getFastSlowMovingReport(params);
      const headers = [
        "Product",
        "Brand",
        "Crates Sold",
        "Average Crates Sold",
        "Classification",
      ];
      const lines = [headers.join(",")];
      for (const r of data.rows) {
        lines.push(
          [
            escapeCsvField(r.productName),
            escapeCsvField(r.productBrand),
            escapeCsvField(r.cratesSold),
            escapeCsvField(r.averageCratesSold.toFixed(2)),
            escapeCsvField(r.classification),
          ].join(",")
        );
      }
      return { filename: `fast_slow_moving_${timestamp}.csv`, csv: lines.join("\n") };
    }

    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }
}
