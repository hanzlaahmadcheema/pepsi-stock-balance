"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceivingReportResult } from "@/lib/reports/service";
import { formatCurrency } from "@/lib/formatters";
import { IconDownload, IconFileSpreadsheet } from "@/components/ui/icons";

interface ReceivingReportClientProps {
  data: ReceivingReportResult;
  isOwner: boolean;
  suppliers: { id: string; name: string }[];
  products: { id: string; name: string }[];
  filters: {
    startDate: string;
    endDate: string;
    supplierId?: string;
    productId?: string;
    page: number;
  };
}

export function ReceivingReportClient({
  data,
  isOwner,
  suppliers,
  products,
  filters,
}: ReceivingReportClientProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const [supplierId, setSupplierId] = useState(filters.supplierId || "");
  const [productId, setProductId] = useState(filters.productId || "");

  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (supplierId) q.set("supplierId", supplierId);
    if (productId) q.set("productId", productId);
    q.set("page", "1");
    router.push(`/reports/receiving?${q.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (supplierId) q.set("supplierId", supplierId);
    if (productId) q.set("productId", productId);
    q.set("page", newPage.toString());
    router.push(`/reports/receiving?${q.toString()}`);
  };

  const exportUrl = `/api/reports/export?report=receiving&startDate=${startDate}&endDate=${endDate}&supplierId=${supplierId}&productId=${productId}`;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/reports" className="hover:underline">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span>Receiving Report</span>
      </div>

      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            Receiving / Purchase Report
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Supplier crate delivery intake, delivery vouchers, and purchase audit.
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
          <label className="text-xs font-bold text-zinc-500 uppercase">Supplier</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
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

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full text-xs font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Total Deliveries</span>
          <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
            {data.summary.totalDeliveries} deliveries
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Total Crates Received</span>
          <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {data.summary.totalCratesReceived} crates
          </div>
        </div>

        {isOwner && data.summary.totalPurchaseCost !== undefined && (
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 shadow-xs">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase">
              Total Purchase Cost
            </span>
            <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
              {formatCurrency(data.summary.totalPurchaseCost)}
            </div>
          </div>
        )}
      </div>

      {/* Deliveries Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
              <tr>
                <th className="px-5 py-3">Reference #</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3 text-center">Total Crates</th>
                <th className="px-5 py-3">Products Received</th>
                {isOwner && <th className="px-5 py-3 text-right text-purple-600">Total Cost</th>}
                <th className="px-5 py-3">Received By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.deliveries.length === 0 ? (
                <tr>
                  <td
                    colSpan={isOwner ? 7 : 6}
                    className="px-5 py-8 text-center text-zinc-500"
                  >
                    No deliveries found matching the criteria.
                  </td>
                </tr>
              ) : (
                data.deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-5 py-3 font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                      <Link href={`/receiving/${d.id}`} className="hover:underline">
                        {d.referenceNumber || `#${d.id.slice(0, 8)}`}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">
                      {new Date(d.receivedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      {d.supplierName}
                    </td>
                    <td className="px-5 py-3 text-center font-bold text-zinc-800 dark:text-zinc-200">
                      {d.totalCrates}
                    </td>
                    <td className="px-5 py-3">
                      <div className="space-y-0.5">
                        {d.items.map((i) => (
                          <div key={i.productId} className="text-xs text-zinc-600 dark:text-zinc-400">
                            <b>{i.quantity} crates</b> &times; {i.productName}
                            {isOwner && i.totalCost !== undefined && (
                              <span className="text-purple-600 font-mono ml-1">
                                ({formatCurrency(i.totalCost)})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    {isOwner && (
                      <td className="px-5 py-3 text-right font-black text-purple-700 dark:text-purple-300">
                        {formatCurrency(d.totalCost || 0)}
                      </td>
                    )}
                    <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">
                      {d.receivedByName}
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
              {data.pagination.totalRecords} deliveries)
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
