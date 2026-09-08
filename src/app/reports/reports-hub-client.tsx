"use client";

import Link from "next/link";
import { ReportsHubSummary } from "@/lib/reports/service";
import { formatCurrency } from "@/lib/formatters";
import {
  IconChartBar,
  IconPackage,
  IconTruck,
  IconUsers,
  IconAlertTriangle,
  IconReceipt,
  IconDollarSign,
  IconBox,
} from "@/components/ui/icons";

interface ReportsHubClientProps {
  summary: ReportsHubSummary;
  isOwner: boolean;
}

export function ReportsHubClient({ summary, isOwner }: ReportsHubClientProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
          Business Reports & Intelligence
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Operational reporting, sales analytics, stock velocity, customer balances, and gross margins.
        </p>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales This Month */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Monthly Sales
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IconChartBar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            {formatCurrency(summary.salesThisMonth.revenue)}
          </div>
          <div className="text-xs text-zinc-500 flex justify-between">
            <span>{summary.salesThisMonth.cratesSold} crates sold</span>
            <span>{summary.salesThisMonth.invoicesCount} invoices</span>
          </div>
        </div>

        {/* Current Inventory */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Stock on Hand
            </span>
            <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <IconPackage className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            {summary.inventory.totalStockCrates} crates
          </div>
          <div className="text-xs text-zinc-500 flex justify-between">
            <span>{summary.inventory.totalActiveProducts} active products</span>
            {summary.inventory.lowStockAlerts > 0 ? (
              <span className="text-amber-600 font-bold">
                {summary.inventory.lowStockAlerts} low stock
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">Optimal</span>
            )}
          </div>
        </div>

        {/* Customer Credit */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Outstanding Credit
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <IconUsers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {formatCurrency(summary.customers.totalCreditOutstanding)}
          </div>
          <div className="text-xs text-zinc-500 flex justify-between">
            <span>Across active accounts</span>
            <span>{summary.customers.totalActive} customers</span>
          </div>
        </div>

        {/* Profit This Month (OWNER ONLY) or Monthly Deliveries (STAFF) */}
        {isOwner && summary.profitThisMonth ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-purple-200 dark:border-purple-900/50 shadow-xs space-y-2 bg-purple-50/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                Gross Profit (MTD)
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                OWNER
              </span>
            </div>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
              {formatCurrency(summary.profitThisMonth.grossProfit)}
            </div>
            <div className="text-xs text-zinc-500 flex justify-between">
              <span>Margin: {summary.profitThisMonth.marginPercent.toFixed(1)}%</span>
              <span>Cost: {formatCurrency(summary.profitThisMonth.cost)}</span>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Receiving (MTD)
              </span>
              <IconTruck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
              {summary.operationsThisMonth.cratesReceived} crates
            </div>
            <div className="text-xs text-zinc-500">
              Supplier intake this month
            </div>
          </div>
        )}
      </div>

      {/* Reports Directory Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Available Reports
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Sales Report */}
          <Link
            href="/reports/sales"
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors shadow-xs group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <IconReceipt className="w-4 h-4" />
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
                View Report →
              </span>
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Sales & Invoicing Report
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Comprehensive sales audit by date, customer, payment status, and sale type. Excludes cancelled sales.
            </p>
          </Link>

          {/* Receiving Report */}
          <Link
            href="/reports/receiving"
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors shadow-xs group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <IconBox className="w-4 h-4" />
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
                View Report →
              </span>
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Receiving / Purchase Report
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Supplier intake history and delivery volumes. Cost breakdown accessible to Owner only.
            </p>
          </Link>

          {/* Dispatch Report */}
          <Link
            href="/reports/dispatch"
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors shadow-xs group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <IconTruck className="w-4 h-4" />
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
                View Report →
              </span>
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Stock Dispatch Report
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Outbound stock movements, delivery tracking per product, and customer shipment logs.
            </p>
          </Link>

          {/* Stock & Inventory Report */}
          <Link
            href="/reports/stock"
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors shadow-xs group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <IconPackage className="w-4 h-4" />
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
                View Report →
              </span>
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Inventory Balance & Valuation
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Authoritative stock derived from immutable movements, low-stock alerts, and crate counts.
            </p>
          </Link>

          {/* Customer Credit Report */}
          <Link
            href="/reports/customers"
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors shadow-xs group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <IconUsers className="w-4 h-4" />
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
                View Report →
              </span>
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Customer Ledger & Credit
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Customer outstanding balances, purchase volume, payments received, and returnable container balance.
            </p>
          </Link>

          {/* Damage & Write-Off Report */}
          <Link
            href="/reports/damage"
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors shadow-xs group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
                <IconAlertTriangle className="w-4 h-4" />
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
                View Report →
              </span>
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Damaged & Expired Goods
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Write-off logs categorized by transit, warehouse, leakage, or expiration. Cost loss for Owner only.
            </p>
          </Link>

          {/* Prices & Tier Catalog */}
          <Link
            href="/reports/prices"
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors shadow-xs group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center">
                <IconDollarSign className="w-4 h-4" />
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
                View Report →
              </span>
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Price Tiers & History
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Price comparison across Retail, Wholesale, Key Account, and immutable price change history.
            </p>
          </Link>

          {/* Profit & Margin Report (OWNER ONLY) */}
          {isOwner ? (
            <Link
              href="/reports/profit"
              className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-purple-300 dark:border-purple-800 hover:border-purple-500 transition-colors shadow-xs group space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <IconChartBar className="w-4 h-4" />
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  OWNER ONLY
                </span>
              </div>
              <h3 className="font-bold text-base text-purple-900 dark:text-purple-200">
                Gross Profit & Margins
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Revenue vs historical cost snapshot, product margins, customer profitability, and net gross returns.
              </p>
            </Link>
          ) : (
            <div className="p-5 rounded-2xl bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 opacity-60 space-y-2 cursor-not-allowed">
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center">
                  <IconAlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                  RESTRICTED
                </span>
              </div>
              <h3 className="font-bold text-base text-zinc-500">
                Gross Profit & Margins
              </h3>
              <p className="text-xs text-zinc-400">
                Financial profitability and margin analytics are restricted to Owner accounts.
              </p>
            </div>
          )}
          {/* Fast / Slow Moving Report */}
          <Link
            href="/reports/fast-slow"
            className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors shadow-xs group space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <IconChartBar className="w-4 h-4" />
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold group-hover:underline">
                View Report →
              </span>
            </div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              Fast / Slow Moving Products
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Classify products as Fast, Slow, or Average movers based on crates sold vs. period average.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
