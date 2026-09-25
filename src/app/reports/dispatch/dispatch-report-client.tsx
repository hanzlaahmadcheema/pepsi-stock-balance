"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DispatchReportResult } from "@/lib/reports/service";
import { IconDownload, IconFileSpreadsheet } from "@/components/ui/icons";

interface DispatchReportClientProps {
  data: DispatchReportResult;
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

export function DispatchReportClient({
  data,
  products,
  customers,
  filters,
}: DispatchReportClientProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const [productId, setProductId] = useState(filters.productId || "");
  const [customerId, setCustomerId] = useState(filters.customerId || "");

  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (productId) q.set("productId", productId);
    if (customerId) q.set("customerId", customerId);
    q.set("page", "1");
    router.push(`/reports/dispatch?${q.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (productId) q.set("productId", productId);
    if (customerId) q.set("customerId", customerId);
    q.set("page", newPage.toString());
    router.push(`/reports/dispatch?${q.toString()}`);
  };

  const exportUrl = `/api/reports/export?report=dispatch&startDate=${startDate}&endDate=${endDate}&productId=${productId}&customerId=${customerId}`;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/reports" className="hover:underline">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span>Stock Dispatch Report</span>
      </div>

      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            Stock Dispatch Report
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Outbound stock movements, sales fulfillment deliveries, and product velocity.
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
          <label className="text-xs font-bold text-zinc-500 uppercase">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase">Product</label>
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
          <label className="text-xs font-bold text-zinc-500 uppercase">Customer</label>
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
            className="w-full text-xs font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Dispatches Logged</span>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
            {data.summary.totalDispatchesCount} line movements
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Total Crates Dispatched</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {data.summary.totalCratesDispatched} crates
          </div>
        </div>
      </div>

      {/* Dispatches Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
              <tr>
                <th className="px-5 py-3">Dispatched Time</th>
                <th className="px-5 py-3">Product Description</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3 text-center">Crates Dispatched</th>
                <th className="px-5 py-3">Linked Invoice</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Dispatched By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.dispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-zinc-500">
                    No dispatches recorded for the selected filter range.
                  </td>
                </tr>
              ) : (
                data.dispatches.map((d) => (
                  <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">
                      {new Date(d.dispatchedAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      {d.productName}
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{d.productBrand}</td>
                    <td className="px-5 py-3 text-center font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {d.quantity} crates
                    </td>
                    <td className="px-5 py-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      {d.invoiceNumber || "—"}
                    </td>
                    <td className="px-5 py-3 text-zinc-700 dark:text-zinc-300">
                      {d.customerName || "—"}
                    </td>
                    <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">
                      {d.dispatchedByName}
                    </td>
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
              {data.pagination.totalRecords} total movements)
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
