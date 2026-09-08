"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProfitReportResult } from "@/lib/reports/service";
import { formatCurrency } from "@/lib/formatters";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { IconDownload, IconFileSpreadsheet } from "@/components/ui/icons";

interface ProfitReportClientProps {
  data: ProfitReportResult;
  products: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  filters: {
    startDate: string;
    endDate: string;
    productId?: string;
    customerId?: string;
    page: number;
  };
}

export function ProfitReportClient({
  data,
  products,
  customers,
  filters,
}: ProfitReportClientProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const [productId, setProductId] = useState(filters.productId || "");
  const [customerId, setCustomerId] = useState(filters.customerId || "");
  const [activeTab, setActiveTab] = useState<"products" | "customers" | "invoices">("products");

  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (productId) q.set("productId", productId);
    if (customerId) q.set("customerId", customerId);
    q.set("page", "1");
    router.push(`/reports/profit?${q.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (productId) q.set("productId", productId);
    if (customerId) q.set("customerId", customerId);
    q.set("page", newPage.toString());
    router.push(`/reports/profit?${q.toString()}`);
  };

  const exportUrl = `/api/reports/export?report=profit&startDate=${startDate}&endDate=${endDate}&productId=${productId}&customerId=${customerId}`;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/reports" className="hover:underline">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span>Gross Profit & Margins Report</span>
      </div>

      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
              Gross Profit & Margins Report
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
              OWNER ONLY
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Authoritative gross returns calculated against historical purchase costs at the moment of each sale.
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
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
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
          <label className="text-[11px] font-bold text-zinc-500 uppercase">Product</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-zinc-500 uppercase">Customer</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          >
            <option value="">All Customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full text-xs font-bold py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Total Revenue</span>
          <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {formatCurrency(data.summary.totalRevenue)}
          </div>
          <div className="text-[11px] text-zinc-400">{data.summary.cratesSold} crates sold</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Total Cost Basis</span>
          <div className="text-xl font-black text-zinc-700 dark:text-zinc-300 mt-1">
            {formatCurrency(data.summary.totalCost)}
          </div>
          <div className="text-[11px] text-zinc-400">Snapshot cost at sale</div>
        </div>

        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 shadow-xs">
          <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase">
            Gross Profit
          </span>
          <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
            {formatCurrency(data.summary.totalGrossProfit)}
          </div>
          <div className="text-[11px] text-purple-600">Net revenue minus cost</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Gross Margin %</span>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {data.summary.marginPercent.toFixed(1)}%
          </div>
          <div className="text-[11px] text-zinc-400">Overall return</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase">Profit / Crate</span>
          <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
            {formatCurrency(data.summary.cratesSold > 0 ? (data.summary.totalGrossProfit / data.summary.cratesSold) : 0)}
          </div>
          <div className="text-[11px] text-zinc-400">Average crate yield</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 px-6 pt-3 bg-zinc-50 dark:bg-zinc-800/40">
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "products"
                ? "border-purple-600 text-purple-700 dark:text-purple-300"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Profit by Product ({data.byProduct.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("customers")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "customers"
                ? "border-purple-600 text-purple-700 dark:text-purple-300"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Profit by Customer ({data.byCustomer.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "invoices"
                ? "border-purple-600 text-purple-700 dark:text-purple-300"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Invoice Profit Log ({data.pagination.totalRecords})
          </button>
        </div>

        {/* Tab 1: Product Profit */}
        {activeTab === "products" && (
          <ScrollableTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Brand</th>
                  <th className="px-5 py-3 text-center">Crates Sold</th>
                  <th className="px-5 py-3 text-right">Revenue ($)</th>
                  <th className="px-5 py-3 text-right">Cost ($)</th>
                  <th className="px-5 py-3 text-right text-purple-700 dark:text-purple-300">Gross Profit ($)</th>
                  <th className="px-5 py-3 text-center text-purple-700 dark:text-purple-300">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.byProduct.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-zinc-500">
                      No sales found for the selected period.
                    </td>
                  </tr>
                ) : (
                  data.byProduct.map((p) => (
                    <tr key={p.productId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        {p.productName}
                      </td>
                      <td className="px-5 py-3 text-zinc-500">{p.brand}</td>
                      <td className="px-5 py-3 text-center font-bold text-zinc-800 dark:text-zinc-200">
                        {p.cratesSold}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(p.revenue)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-zinc-500">
                        {formatCurrency(p.cost)}
                      </td>
                      <td className="px-5 py-3 text-right font-black text-purple-700 dark:text-purple-300">
                        {formatCurrency(p.profit)}
                      </td>
                      <td className="px-5 py-3 text-center font-black text-emerald-600">
                        {p.marginPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        )}

        {/* Tab 2: Customer Profit */}
        {activeTab === "customers" && (
          <ScrollableTable>
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                <tr>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3 text-center">Crates Sold</th>
                  <th className="px-5 py-3 text-right">Revenue</th>
                  <th className="px-5 py-3 text-right">Cost</th>
                  <th className="px-5 py-3 text-right text-purple-700 dark:text-purple-300">Gross Profit</th>
                  <th className="px-5 py-3 text-center text-purple-700 dark:text-purple-300">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.byCustomer.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-zinc-500">
                      No customer sales found for the selected period.
                    </td>
                  </tr>
                ) : (
                  data.byCustomer.map((c) => (
                    <tr key={c.customerId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        {c.customerName}
                      </td>
                      <td className="px-5 py-3 text-center font-bold text-zinc-800 dark:text-zinc-200">
                        {c.cratesSold}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(c.revenue)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-zinc-500">
                        {formatCurrency(c.cost)}
                      </td>
                      <td className="px-5 py-3 text-right font-black text-purple-700 dark:text-purple-300">
                        {formatCurrency(c.profit)}
                      </td>
                      <td className="px-5 py-3 text-center font-black text-emerald-600">
                        {c.marginPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        )}

        {/* Tab 3: Invoice Profit Log */}
        {activeTab === "invoices" && (
          <div>
            <ScrollableTable>
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                  <tr>
                    <th className="px-5 py-3">Invoice #</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3 text-right">Revenue</th>
                    <th className="px-5 py-3 text-right">Cost</th>
                    <th className="px-5 py-3 text-right text-purple-700 dark:text-purple-300">Profit</th>
                    <th className="px-5 py-3 text-center text-purple-700 dark:text-purple-300">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-zinc-500">
                        No invoices found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    data.invoices.map((inv) => (
                      <tr key={inv.invoiceId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                        <td className="px-5 py-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          <Link href={`/sales/${inv.invoiceId}`} className="hover:underline">
                            {inv.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">
                          {new Date(inv.soldAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                          {inv.customerName}
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(inv.totalAmount)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-zinc-500">
                          {formatCurrency(inv.totalCost)}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-purple-700 dark:text-purple-300">
                          {formatCurrency(inv.profit)}
                        </td>
                        <td className="px-5 py-3 text-center font-black text-emerald-600">
                          {inv.marginPercent.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollableTable>

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                <span>
                  Page {data.pagination.currentPage} of {data.pagination.totalPages} (
                  {data.pagination.totalRecords} invoices)
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
        )}
      </div>
    </div>
  );
}
