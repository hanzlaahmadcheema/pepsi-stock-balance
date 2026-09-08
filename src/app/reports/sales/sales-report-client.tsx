"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SaleType } from "@prisma/client";
import { SalesReportResult } from "@/lib/reports/service";
import { formatCurrency } from "@/lib/formatters";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { IconDownload, IconFileSpreadsheet } from "@/components/ui/icons";

interface SalesReportClientProps {
  data: SalesReportResult;
  isOwner: boolean;
  customers: { id: string; name: string }[];
  filters: {
    startDate: string;
    endDate: string;
    customerId?: string;
    saleType?: SaleType;
    page: number;
  };
}

export function SalesReportClient({
  data,
  isOwner,
  customers,
  filters,
}: SalesReportClientProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const [customerId, setCustomerId] = useState(filters.customerId || "");
  const [saleType, setSaleType] = useState<string>(filters.saleType || "");

  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (customerId) q.set("customerId", customerId);
    if (saleType) q.set("saleType", saleType);
    q.set("page", "1");
    router.push(`/reports/sales?${q.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (customerId) q.set("customerId", customerId);
    if (saleType) q.set("saleType", saleType);
    q.set("page", newPage.toString());
    router.push(`/reports/sales?${q.toString()}`);
  };

  const exportUrl = `/api/reports/export?report=sales&startDate=${startDate}&endDate=${endDate}&customerId=${customerId}&saleType=${saleType}`;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/reports" className="hover:underline">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span>Sales & Invoicing Report</span>
      </div>

      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            Sales & Invoicing Report
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Revenue metrics, invoice summaries, and completed sales performance. Cancelled invoices excluded.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${exportUrl}&format=csv`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-xs transition-colors"
          >
            <IconDownload className="w-3.5 h-3.5" />
            <span>CSV</span>
          </a>
          <a
            href={`${exportUrl}&format=xlsx`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <IconFileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </a>
        </div>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleFilter}
        className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
      >
        <div>
          <label className="text-[11px] font-bold text-zinc-500 uppercase">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-zinc-500 uppercase">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-zinc-500 uppercase">Customer</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          >
            <option value="">All Customers (Incl. Retail)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-zinc-500 uppercase">Sale Type</label>
          <select
            value={saleType}
            onChange={(e) => setSaleType(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          >
            <option value="">All Types</option>
            <option value={SaleType.RETAIL}>Retail</option>
            <option value={SaleType.WHOLESALE}>Wholesale</option>
            <option value={SaleType.KEY_ACCOUNT}>Key Account</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full text-xs font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Total Revenue</span>
          <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">
            {formatCurrency(data.summary.totalRevenue)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Collected</span>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatCurrency(data.summary.totalPaid)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Credit (Unpaid)</span>
          <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(data.summary.totalCredit)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Crates Sold</span>
          <div className="text-lg font-black text-zinc-900 dark:text-zinc-50 mt-1">
            {data.summary.totalCratesSold}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Invoices</span>
          <div className="text-lg font-black text-zinc-900 dark:text-zinc-50 mt-1">
            {data.summary.totalInvoices}
          </div>
        </div>

        {isOwner && data.summary.totalProfit !== undefined ? (
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 shadow-xs">
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase">
              Gross Profit
            </span>
            <div className="text-lg font-black text-purple-700 dark:text-purple-300 mt-1">
              {formatCurrency(data.summary.totalProfit)}
            </div>
            <div className="text-[10px] text-purple-600">
              Margin: {data.summary.marginPercent?.toFixed(1)}%
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase">Avg Invoice</span>
            <div className="text-lg font-black text-zinc-900 dark:text-zinc-50 mt-1">
              {formatCurrency(data.summary.averageInvoiceValue)}
            </div>
          </div>
        )}
      </div>

      {/* Invoices Data Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <ScrollableTable>
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
              <tr>
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3 text-center">Type</th>
                <th className="px-5 py-3 text-center">Crates</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Credit</th>
                {isOwner && (
                  <>
                    <th className="px-5 py-3 text-right text-purple-600">Cost</th>
                    <th className="px-5 py-3 text-right text-purple-600">Profit</th>
                    <th className="px-5 py-3 text-center text-purple-600">Margin</th>
                  </>
                )}
                <th className="px-5 py-3">Cashier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 12 : 9}
                    className="px-5 py-8 text-center text-zinc-500"
                  >
                    No sales found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                data.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-5 py-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      <Link href={`/sales/${inv.id}`} className="hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">
                      {new Date(inv.soldAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      {inv.customerName}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {inv.saleType}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center font-bold text-zinc-800 dark:text-zinc-200">
                      {inv.totalCrates}
                    </td>
                    <td className="px-5 py-3 text-right font-black text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-emerald-600">
                      {formatCurrency(inv.paidAmount)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-amber-600">
                      {formatCurrency(inv.creditAmount)}
                    </td>
                    {isOwner && (
                      <>
                        <td className="px-5 py-3 text-right text-zinc-500 font-mono">
                          {formatCurrency(inv.cost || 0)}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-purple-700 dark:text-purple-300">
                          {formatCurrency(inv.profit || 0)}
                        </td>
                        <td className="px-5 py-3 text-center text-purple-600 font-bold">
                          {(inv.margin || 0).toFixed(1)}%
                        </td>
                      </>
                    )}
                    <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">
                      {inv.cashierName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>

        {/* Pagination Strip */}
        {data.pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <span>
              Showing Page {data.pagination.currentPage} of {data.pagination.totalPages} (
              {data.pagination.totalRecords} total invoices)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePageChange(data.pagination.currentPage - 1)}
                disabled={data.pagination.currentPage <= 1}
                className="px-3 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(data.pagination.currentPage + 1)}
                disabled={data.pagination.currentPage >= data.pagination.totalPages}
                className="px-3 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
