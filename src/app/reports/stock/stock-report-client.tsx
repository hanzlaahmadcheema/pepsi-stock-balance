"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StockReportResult } from "@/lib/reports/service";
import { formatCurrency } from "@/lib/formatters";
import { IconDownload, IconFileSpreadsheet } from "@/components/ui/icons";

interface StockReportClientProps {
  data: StockReportResult;
  isOwner: boolean;
  filters: {
    search: string;
    statusFilter: string;
    page: number;
  };
}

export function StockReportClient({
  data,
  isOwner,
  filters,
}: StockReportClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);
  const [statusFilter, setStatusFilter] = useState(filters.statusFilter);

  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (statusFilter && statusFilter !== "ALL") q.set("statusFilter", statusFilter);
    q.set("page", "1");
    router.push(`/reports/stock?${q.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (statusFilter && statusFilter !== "ALL") q.set("statusFilter", statusFilter);
    q.set("page", newPage.toString());
    router.push(`/reports/stock?${q.toString()}`);
  };

  const exportUrl = `/api/reports/export?report=stock&search=${encodeURIComponent(search)}&statusFilter=${statusFilter}`;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/reports" className="hover:underline">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span>Inventory & Stock Balance Report</span>
      </div>

      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            Inventory & Stock Balance Report
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Authoritative on-hand crate stock derived from immutable stock movements.
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
        className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <div className="sm:col-span-2">
          <label className="text-xs font-bold text-zinc-500 uppercase">Search Product / Brand</label>
          <input
            type="text"
            placeholder="Search by product name or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">Stock Health Filter</label>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
            >
              <option value="ALL">All Products</option>
              <option value="IN_STOCK">Optimal In-Stock</option>
              <option value="LOW_STOCK">Low Stock Alert</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
            <button
              type="submit"
              className="text-xs font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
            >
              Filter
            </button>
          </div>
        </div>
      </form>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Total Products</span>
          <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
            {data.summary.totalProducts}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Total Crates</span>
          <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {data.summary.totalStockCrates} crates
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Low Stock Alerts</span>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {data.summary.lowStockCount}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Out of Stock</span>
          <div className="text-xl font-black text-red-600 dark:text-red-400 mt-1">
            {data.summary.outOfStockCount}
          </div>
        </div>

        {isOwner && data.summary.totalValuation !== undefined && (
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 shadow-xs col-span-2 sm:col-span-1">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase">
              Inventory Value
            </span>
            <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
              {formatCurrency(data.summary.totalValuation)}
            </div>
          </div>
        )}
      </div>

      {/* Stock Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
              <tr>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3 text-center">Current Stock</th>
                <th className="px-5 py-3 text-center">Min Threshold</th>
                <th className="px-5 py-3 text-center">Status</th>
                {isOwner && (
                  <>
                    <th className="px-5 py-3 text-right text-purple-600">Cost/Crate</th>
                    <th className="px-5 py-3 text-right text-purple-600">Total Value</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.products.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 7 : 5} className="px-5 py-8 text-center text-zinc-500">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                data.products.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      <Link href={`/products/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{p.brand}</td>
                    <td className="px-5 py-3 text-center font-black text-sm text-zinc-900 dark:text-zinc-100">
                      {p.currentStock} crates
                    </td>
                    <td className="px-5 py-3 text-center text-zinc-500">
                      {p.minimumStockLevel} crates
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold ${
                          p.status === "OPTIMAL"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : p.status === "LOW_STOCK"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {p.status.replace("_", " ")}
                      </span>
                    </td>
                    {isOwner && (
                      <>
                        <td className="px-5 py-3 text-right text-zinc-600 dark:text-zinc-400 font-mono">
                          {formatCurrency(p.latestPurchasePrice || 0)}
                        </td>
                        <td className="px-5 py-3 text-right font-black text-purple-700 dark:text-purple-300">
                          {formatCurrency(p.inventoryValue || 0)}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
            <span>
              Page {data.pagination.currentPage} of {data.pagination.totalPages} (
              {data.pagination.totalRecords} products)
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
