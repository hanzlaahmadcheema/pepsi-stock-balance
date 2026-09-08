import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { Role } from "@prisma/client";
import { getDashboardData, DashboardData, OwnerDashboardData } from "@/lib/dashboard/service";
import {
  IconChartBar,
  IconUsers,
  IconPackage,
  IconRotateCcw,
  IconDollarSign,
  IconReceipt,
  IconTruck,
  IconClipboardList,
  IconScale,
  IconBanknotes,
  IconDeviceMobile,
  IconCreditCard,
  IconQrCode,
} from "@/components/ui/icons";

export const dynamic = "force-dynamic";

function formatMoney(amount: number): string {
  return "Rs. " + Math.round(amount).toLocaleString("en-PK");
}

function getStatusBadge(status: string) {
  switch (status) {
    case "CLOSED":
    case "ready":
    case "completed":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          ● {status.replace("_", " ").toUpperCase()}
        </span>
      );
    case "IN_REVIEW":
    case "pending_adjustments":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          ▲ {status.replace("_", " ").toUpperCase()}
        </span>
      );
    case "OPEN":
    case "in_progress":
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
          ○ {status.replace("_", " ").toUpperCase()}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          NOT STARTED
        </span>
      );
  }
}

export default async function HomePage() {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const data: DashboardData = await getDashboardData(user.role);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ========================================================= */}
        {/* 1. TOP HEADER & OPERATIONAL HEALTH BANNER                 */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                {isOwner ? "Owner Executive Control" : "Staff Operations Desk"}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Business Date: <strong className="text-zinc-700 dark:text-zinc-300">{data.businessDate}</strong> (Asia/Karachi)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1.5">
              Welcome back, {user.name}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              {isOwner
                ? "Here is your full business pulse, real-time inventory balance, cash collection, and gross profitability for today."
                : "Here is your daily operational control center for dispatch, crate stock, cash collection, and end-of-day tasks."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isOwner && (
              <Link
                href="/sales/new"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs transition-all hover:shadow-md"
              >
                + New Sale / Invoice
              </Link>
            )}
            {isOwner && (
              <Link
                href="/reports/profit"
                className="inline-flex items-center gap-1.5 justify-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-xs transition-all hover:shadow-md"
              >
                <IconChartBar className="w-4 h-4" />
                <span>Profit Report</span>
              </Link>
            )}
            <Link
              href="/daily-closing"
              className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-medium text-sm transition-colors"
            >
              Daily Closing
            </Link>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. ACTIONABLE PENDING ITEMS BANNER                        */}
        {/* ========================================================= */}
        {data.pendingTasks.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Action Items Requiring Attention ({data.pendingTasks.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.pendingTasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                    task.priority === "high"
                      ? "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 shadow-xs"
                      : "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          task.priority === "high"
                            ? "bg-amber-200/80 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200"
                            : "bg-blue-200/80 dark:bg-blue-900/80 text-blue-900 dark:text-blue-200"
                        }`}
                      >
                        {task.badge}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {task.title}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  </div>
                  <div className="pt-3 mt-3 border-t border-zinc-200/60 dark:border-zinc-800">
                    <Link
                      href={task.href}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center gap-1"
                    >
                      Resolve Task &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between text-xs">
            <span className="font-medium text-emerald-800 dark:text-emerald-300">
              ✓ All daily operational checkpoints are currently up to date.
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              Stock Count: {data.stockCount.status.toUpperCase()} · Closing: {data.dailyClosing.status}
            </span>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. MAIN KPI SUMMARY CARDS                                 */}
        {/* ========================================================= */}
        {isOwner ? (
          /* OWNER KPI GRID */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Today's Sales Revenue */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Today&apos;s Revenue
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Completed
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 mt-2">
                {formatMoney((data as OwnerDashboardData).sales.revenue)}
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                <span><strong>{(data as OwnerDashboardData).sales.invoicesCount}</strong> invoices</span>
                <span>•</span>
                <span><strong>{(data as OwnerDashboardData).sales.cratesSold}</strong> crates sold</span>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <span>Immediate Paid: {formatMoney((data as OwnerDashboardData).sales.immediatePaidAmount)}</span>
                <Link href="/reports/sales" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Sales Report &rarr;
                </Link>
              </div>
            </div>

            {/* OWNER ONLY: Today's Gross Profit */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-emerald-800 dark:text-emerald-400">
                  Today&apos;s Gross Profit
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Owner Only
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {formatMoney((data as OwnerDashboardData).profit.todayGrossProfit)}
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                <span>Gross Margin: <strong className="text-emerald-600 dark:text-emerald-400">{(data as OwnerDashboardData).profit.todayGrossMarginPercent.toFixed(1)}%</strong></span>
                <span>•</span>
                <span>COGS: {formatMoney((data as OwnerDashboardData).profit.todayCostOfGoodsSold)}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <span>Cost basis at sale</span>
                <Link href="/reports/profit" className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">
                  Profit Details &rarr;
                </Link>
              </div>
            </div>

            {/* Total Physical Stock */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Physical Stock on Hand
                </span>
                {data.inventory.lowStockCount > 0 ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    {data.inventory.lowStockCount} Low
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Healthy
                  </span>
                )}
              </div>
              <div className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-100 mt-2">
                {data.inventory.totalStockCrates} <span className="text-base font-normal text-zinc-500">crates</span>
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
                <span>Valuation: <strong className="text-zinc-800 dark:text-zinc-200">{formatMoney((data as OwnerDashboardData).inventory.totalValuation)}</strong></span>
                <span>{data.inventory.outOfStockCount > 0 ? `${data.inventory.outOfStockCount} out of stock` : "0 out"}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <Link href="/products" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Product Catalog &rarr;
                </Link>
                <Link href="/reports/stock" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Stock Ledger &rarr;
                </Link>
              </div>
            </div>

            {/* Customer Receivables */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Customer Receivables
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {(data as OwnerDashboardData).customers.totalActive} Customers
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
                {formatMoney((data as OwnerDashboardData).customers.totalCreditOutstanding)}
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Outstanding balance across customer credit accounts
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <Link href="/customers" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Manage Customers &rarr;
                </Link>
                <Link href="/reports/customers" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Credit Ledger &rarr;
                </Link>
              </div>
            </div>

            {/* Today's Stock Count Status */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Today&apos;s Stock Count
                </span>
                {getStatusBadge(data.stockCount.status)}
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-3">
                {data.stockCount.totalProductsCounted > 0
                  ? `${data.stockCount.totalProductsCounted} Products Counted`
                  : "Not Started Yet"}
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Discrepancies: <strong className={data.stockCount.discrepanciesCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}>{data.stockCount.discrepanciesCount}</strong> · Pending Adjustments: <strong className={data.stockCount.pendingAdjustmentsCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}>{data.stockCount.pendingAdjustmentsCount}</strong>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <Link href="/stock-counts" className="text-blue-600 dark:text-blue-400 hover:underline">
                  View Count Sessions &rarr;
                </Link>
              </div>
            </div>

            {/* Daily Closing Status */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Daily Closing
                </span>
                {getStatusBadge(data.dailyClosing.status)}
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-3">
                {data.dailyClosing.status === "CLOSED"
                  ? "Reconciled & Closed"
                  : data.dailyClosing.status === "IN_REVIEW"
                  ? "Submitted for Review"
                  : data.dailyClosing.status === "OPEN"
                  ? "Currently Open"
                  : "Not Initialized"}
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {data.dailyClosing.status === "CLOSED" || data.dailyClosing.status === "IN_REVIEW"
                  ? `Physical Cash: ${formatMoney((data as OwnerDashboardData).dailyClosing.physicalCash)} · Diff: ${formatMoney((data as OwnerDashboardData).dailyClosing.cashDifference)}`
                  : `Expected Cash: ${formatMoney(data.payments.totalCashCollected)}`}
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <Link href="/daily-closing" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Closing Reconciliation &rarr;
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* STAFF OPERATIONAL KPI GRID */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Completed Invoices */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Today&apos;s Sales Activity
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Completed
                </span>
              </div>
              <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mt-2">
                {data.sales.invoicesCount} <span className="text-base font-normal text-zinc-500">invoices</span>
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Total Crates Dispatched Today: <strong className="text-zinc-800 dark:text-zinc-200">{data.sales.cratesSold} crates</strong>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <Link href="/sales" className="text-blue-600 dark:text-blue-400 hover:underline">
                  View Sales Invoices &rarr;
                </Link>
                <Link href="/sales/new" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                  + New Sale
                </Link>
              </div>
            </div>

            {/* Total Payments Collected */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Total Payments Collected
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  Cash + Digital
                </span>
              </div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {formatMoney(data.payments.totalPaymentsCollected)}
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                <span>Cash: <strong>{formatMoney(data.payments.totalCashCollected)}</strong></span>
                <span>•</span>
                <span>Digital: <strong>{formatMoney(data.payments.totalDigitalPayments)}</strong></span>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <span>Checkout & Cashier Desk</span>
                <Link href="/daily-closing" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Cash Drawer &rarr;
                </Link>
              </div>
            </div>

            {/* Physical Stock Crates */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Current Stock on Hand
                </span>
                {data.inventory.lowStockCount > 0 ? (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    {data.inventory.lowStockCount} Low
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    Available
                  </span>
                )}
              </div>
              <div className="text-3xl font-black text-zinc-900 dark:text-zinc-100 mt-2">
                {data.inventory.totalStockCrates} <span className="text-base font-normal text-zinc-500">crates</span>
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Stock balance across active catalog products
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <Link href="/products" className="text-blue-600 dark:text-blue-400 hover:underline">
                  View Catalog &rarr;
                </Link>
                <Link href="/receiving" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Receiving &rarr;
                </Link>
              </div>
            </div>

            {/* Low-Stock Monitor */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Low-Stock Product Alerts
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                  data.inventory.lowStockCount > 0
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                    : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                }`}>
                  {data.inventory.lowStockCount > 0 ? "Attention Needed" : "Optimal"}
                </span>
              </div>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
                {data.inventory.lowStockCount} <span className="text-base font-normal text-zinc-500">items</span>
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {data.inventory.outOfStockCount > 0
                  ? `${data.inventory.outOfStockCount} items currently at 0 crates`
                  : "All products have crates available"}
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <Link href="/products" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Check Levels &rarr;
                </Link>
              </div>
            </div>

            {/* Today's Stock Count */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Physical Stock Count
                </span>
                {getStatusBadge(data.stockCount.status)}
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-3">
                {data.stockCount.totalProductsCounted > 0
                  ? `${data.stockCount.totalProductsCounted} Products Counted`
                  : "Not Started"}
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Status: {data.stockCount.status.replace("_", " ").toUpperCase()}
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <Link
                  href={data.stockCount.closingId ? `/stock-counts/${data.stockCount.closingId}` : "/stock-counts/new"}
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  {data.stockCount.totalProductsCounted > 0 ? "View Counts &rarr;" : "+ Start Physical Count"}
                </Link>
              </div>
            </div>

            {/* Daily Closing */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Daily Closing Status
                </span>
                {getStatusBadge(data.dailyClosing.status)}
              </div>
              <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-3">
                {data.dailyClosing.status === "CLOSED"
                  ? "Closed for the Day"
                  : data.dailyClosing.status === "IN_REVIEW"
                  ? "Submitted to Owner"
                  : "Open / In Progress"}
              </div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Cash Expected: <strong>{formatMoney(data.payments.totalCashCollected)}</strong>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-500">
                <Link href="/daily-closing" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Reconciliation Form &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. TODAY'S PAYMENT COLLECTIONS BY METHOD BREAKDOWN        */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Today&apos;s Payment Collections by Channel
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Authoritative register reconciliation across counter payments and customer account settlements.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Total Collected Today:</span>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatMoney(data.payments.totalPaymentsCollected)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
            {/* Cash */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>Cash Drawer</span>
                <IconBanknotes className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {formatMoney(data.payments.totalCashCollected)}
              </div>
            </div>

            {/* EasyPaisa */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>EasyPaisa</span>
                <IconDeviceMobile className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {formatMoney(data.payments.totalEasyPaisaCollected)}
              </div>
            </div>

            {/* JazzCash */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>JazzCash</span>
                <IconDeviceMobile className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {formatMoney(data.payments.totalJazzCashCollected)}
              </div>
            </div>

            {/* M-Pesa */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>M-Pesa</span>
                <IconCreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {formatMoney(data.payments.totalMpesaCollected)}
              </div>
            </div>

            {/* QR Code */}
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/60">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>QR Code</span>
                <IconQrCode className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                {formatMoney(data.payments.totalQrCollected)}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 5. OWNER-ONLY: PENDING STOCK ADJUSTMENTS SECTION           */}
        {/* ========================================================= */}
        {isOwner && (data as OwnerDashboardData).pendingAdjustments.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-amber-200 dark:border-amber-900/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Owner Action Required
                </span>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  Pending Stock Discrepancy Adjustments ({(data as OwnerDashboardData).pendingAdjustments.length})
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Submitted physical count discrepancies awaiting your one-time approval or rejection.
                </p>
              </div>
              <Link
                href="/stock-counts"
                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors"
              >
                Review All &rarr;
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-3 text-right">Count Diff</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Submitted By</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {(data as OwnerDashboardData).pendingAdjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {adj.productName} <span className="text-zinc-400">({adj.productBrand})</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold">
                        <span className={adj.difference > 0 ? "text-emerald-600" : "text-rose-600"}>
                          {adj.difference > 0 ? `+${adj.difference}` : adj.difference} crates
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                        {adj.reason}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400">
                        {adj.requestedByName}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          href={adj.closingId ? `/stock-counts/${adj.closingId}` : "/stock-counts"}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Resolve &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 6. LOW STOCK WATCHLIST (BOTH ROLES)                       */}
        {/* ========================================================= */}
        {data.inventory.lowStockProducts.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Low-Stock Inventory Watchlist ({data.inventory.lowStockCount} total)
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Products currently at or below minimum threshold requiring warehouse replenishment.
                </p>
              </div>
              <Link
                href={isOwner ? "/receiving/new" : "/products"}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {isOwner ? "+ Record Delivery" : "View Full Catalog"} &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {data.inventory.lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Brand: {p.brand}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs font-bold ${p.currentStock <= 0 ? "text-rose-600" : "text-amber-600"}`}>
                      {p.currentStock} / {p.minimumStockLevel} crates
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {p.currentStock <= 0 ? "OUT OF STOCK" : "LOW STOCK"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 7. QUICK ACCESS LAUNCHER GRID                             */}
        {/* ========================================================= */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
            Quick Navigation Launcher
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Staff Featured: New Sale */}
            {!isOwner && (
              <Link
                href="/sales/new"
                className="p-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="text-2xl mb-1">⚡</div>
                  <div className="font-bold text-white text-sm">+ New Sale / Invoice</div>
                  <p className="text-xs text-blue-100 mt-1">Start a fresh retail or wholesale invoice immediately.</p>
                </div>
                <div className="mt-3 text-xs font-semibold text-blue-100">
                  Open Register &rarr;
                </div>
              </Link>
            )}

            {/* Sales */}
            <Link
              href="/sales"
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
                <IconReceipt className="w-4 h-4" />
              </div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Sales & Invoicing</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Search invoices, print receipts, and track payments.</p>
            </Link>

            {/* Receiving */}
            <Link
              href="/receiving"
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-purple-400 dark:hover:border-purple-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2.5">
                <IconTruck className="w-4 h-4" />
              </div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Receiving / Purchase</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Log supplier crate deliveries and intake inventory.</p>
            </Link>

            {/* Stock Counts */}
            <Link
              href="/stock-counts"
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-teal-400 dark:hover:border-teal-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-2.5">
                <IconClipboardList className="w-4 h-4" />
              </div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Stock Counts & Audits</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Physical count sheets and discrepancy resolution.</p>
            </Link>

            {/* Daily Closing (Both can access, staff prepares, owner approves) */}
            <Link
              href="/daily-closing"
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
                <IconScale className="w-4 h-4" />
              </div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Daily Closing</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Cash drawer balancing and end-of-day reconciliation.</p>
            </Link>

            {/* Customers */}
            <Link
              href="/customers"
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5">
                <IconUsers className="w-4 h-4" />
              </div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Customers & Credit</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Accounts receivable ledgers, credit limits, and payments.</p>
            </Link>

            {/* Products */}
            <Link
              href="/products"
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center mb-2.5">
                <IconPackage className="w-4 h-4" />
              </div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Products & Prices</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Product catalog, current crate stocks, and active tiers.</p>
            </Link>

            {/* Returns */}
            <Link
              href="/returns"
              className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-700 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2.5">
                <IconRotateCcw className="w-4 h-4" />
              </div>
              <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Returns & Quarantine</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Customer crate returns and quarantine inspection.</p>
            </Link>

            {/* OWNER ONLY: Reports Hub */}
            {isOwner && (
              <Link
                href="/reports"
                className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-violet-400 dark:hover:border-violet-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-2.5">
                  <IconChartBar className="w-4 h-4" />
                </div>
                <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Reports & Intelligence</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Comprehensive sales, stock, dispatch, and customer ledgers.</p>
              </Link>
            )}

            {/* OWNER ONLY: Profit Analytics */}
            {isOwner && (
              <Link
                href="/reports/profit"
                className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-2.5">
                  <IconDollarSign className="w-4 h-4" />
                </div>
                <div className="font-bold text-emerald-900 dark:text-emerald-300 text-sm">Profit & Margins</div>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1">Owner-only gross return, product margins, and invoices.</p>
              </Link>
            )}

            {/* OWNER ONLY: Users Management */}
            {isOwner && (
              <Link
                href="/settings/users"
                className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2.5">
                  <IconUsers className="w-4 h-4" />
                </div>
                <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">Staff User Provisioning</div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Add staff members, manage roles, and toggle active status.</p>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
