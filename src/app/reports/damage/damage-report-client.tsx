"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DamageType } from "@prisma/client";
import { DamageReportResult } from "@/lib/reports/service";
import { formatCurrency } from "@/lib/formatters";
import { IconDownload, IconFileSpreadsheet } from "@/components/ui/icons";

interface DamageReportClientProps {
  data: DamageReportResult;
  isOwner: boolean;
  products: { id: string; name: string }[];
  filters: {
    startDate: string;
    endDate: string;
    productId?: string;
    damageType?: DamageType;
    page: number;
  };
}

export function DamageReportClient({
  data,
  isOwner,
  products,
  filters,
}: DamageReportClientProps) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const [productId, setProductId] = useState(filters.productId || "");
  const [damageType, setDamageType] = useState<string>(filters.damageType || "");

  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (productId) q.set("productId", productId);
    if (damageType) q.set("damageType", damageType);
    q.set("page", "1");
    router.push(`/reports/damage?${q.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const q = new URLSearchParams();
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    if (productId) q.set("productId", productId);
    if (damageType) q.set("damageType", damageType);
    q.set("page", newPage.toString());
    router.push(`/reports/damage?${q.toString()}`);
  };

  const exportUrl = `/api/reports/export?report=damage&startDate=${startDate}&endDate=${endDate}&productId=${productId}&damageType=${damageType}`;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/reports" className="hover:underline">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span>Damaged & Expired Goods Report</span>
      </div>

      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            Damaged & Expired Goods Report
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Write-offs tracking by reason, category, product, and financial inventory loss.
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
          <label className="text-xs font-bold text-zinc-500 uppercase">Damage Type</label>
          <select
            value={damageType}
            onChange={(e) => setDamageType(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          >
            <option value="">All Categories</option>
            {Object.values(DamageType).map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Write-Off Logs</span>
          <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
            {data.summary.totalRecords} records
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Crates Damaged</span>
          <div className="text-xl font-black text-red-600 dark:text-red-400 mt-1">
            {data.summary.totalCratesDamaged} crates
          </div>
        </div>

        {isOwner && data.summary.totalCostLoss !== undefined ? (
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 shadow-xs">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase">
              Financial Cost Loss
            </span>
            <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
              {formatCurrency(data.summary.totalCostLoss)}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <span className="text-xs font-semibold text-zinc-500 uppercase">Category Count</span>
            <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
              {data.summary.typeBreakdown.filter((t) => t.crates > 0).length} active types
            </div>
          </div>
        )}
      </div>

      {/* Category Pills */}
      <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
          Loss by Category:
        </span>
        <div className="flex flex-wrap gap-2 pt-1">
          {data.summary.typeBreakdown.map((tb) => (
            <div
              key={tb.damageType}
              className="px-3 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 text-xs flex items-center gap-2"
            >
              <span className="text-zinc-600 dark:text-zinc-400">{tb.damageType.replace(/_/g, " ")}:</span>
              <b className={tb.crates > 0 ? "text-red-600 font-bold" : "text-zinc-400"}>
                {tb.crates} crates
              </b>
            </div>
          ))}
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Brand</th>
                <th className="px-5 py-3 text-center">Crates Written Off</th>
                <th className="px-5 py-3 text-center">Category</th>
                <th className="px-5 py-3">Reason / Remarks</th>
                {isOwner && <th className="px-5 py-3 text-right text-purple-600">Cost Loss</th>}
                <th className="px-5 py-3">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.records.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 8 : 7} className="px-5 py-8 text-center text-zinc-500">
                    No damage records found matching the criteria.
                  </td>
                </tr>
              ) : (
                data.records.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">
                      {new Date(r.recordedAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      {r.productName}
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{r.productBrand}</td>
                    <td className="px-5 py-3 text-center font-bold text-red-600 dark:text-red-400">
                      {r.quantity} crates
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs">
                        {r.damageType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                      {r.reason || "—"}
                    </td>
                    {isOwner && (
                      <td className="px-5 py-3 text-right font-black text-purple-700 dark:text-purple-300 font-mono">
                        {formatCurrency(r.costLoss || 0)}
                      </td>
                    )}
                    <td className="px-5 py-3 text-zinc-500 whitespace-nowrap">
                      {r.recordedByName}
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
              {data.pagination.totalRecords} write-offs)
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
