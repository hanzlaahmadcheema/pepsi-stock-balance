"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PriceTier } from "@prisma/client";
import { PriceReportResult } from "@/lib/reports/service";
import { formatCurrency } from "@/lib/formatters";
import { IconDownload, IconFileSpreadsheet, IconHistory } from "@/components/ui/icons";

interface PricesReportClientProps {
  data: PriceReportResult;
  isOwner: boolean;
  filters: {
    search: string;
    tier?: PriceTier;
    includeHistory: boolean;
  };
}

export function PricesReportClient({
  data,
  isOwner,
  filters,
}: PricesReportClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);
  const [tier, setTier] = useState<string>(filters.tier || "");
  const [includeHistory, setIncludeHistory] = useState(filters.includeHistory);

  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (tier) q.set("tier", tier);
    if (includeHistory) q.set("includeHistory", "true");
    router.push(`/reports/prices?${q.toString()}`);
  };

  const exportUrl = `/api/reports/export?report=prices&search=${encodeURIComponent(search)}&tier=${tier}`;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/reports" className="hover:underline">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span>Price Tiers & History Report</span>
      </div>

      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            Price Tiers & Catalog Report
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Selling price tiers across Retail, Wholesale, and Key Account, with immutable price histories.
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
        className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by product name or brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          >
            <option value="">All Tiers</option>
            <option value={PriceTier.RETAIL}>Retail</option>
            <option value={PriceTier.WHOLESALE}>Wholesale</option>
            <option value={PriceTier.KEY_ACCOUNT}>Key Account</option>
          </select>

          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={includeHistory}
              onChange={(e) => setIncludeHistory(e.target.checked)}
              className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Show Price History Log</span>
          </label>

          <button
            type="submit"
            className="text-xs font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Active Price Tiers Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">
            Active Tier Pricing ({data.catalog.length} Products)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
              <tr>
                <th className="px-5 py-3">Product Name</th>
                <th className="px-5 py-3">Brand</th>
                {isOwner && <th className="px-5 py-3 text-right text-purple-600">Cost/Crate ($)</th>}
                <th className="px-5 py-3 text-right">Retail Tier ($)</th>
                {isOwner && <th className="px-5 py-3 text-center text-purple-600">Retail Margin</th>}
                <th className="px-5 py-3 text-right">Wholesale Tier ($)</th>
                {isOwner && <th className="px-5 py-3 text-center text-purple-600">Wholesale Margin</th>}
                <th className="px-5 py-3 text-right">Key Account Tier ($)</th>
                {isOwner && <th className="px-5 py-3 text-center text-purple-600">Key Account Margin</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.catalog.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 9 : 5} className="px-5 py-8 text-center text-zinc-500">
                    No products found matching the criteria.
                  </td>
                </tr>
              ) : (
                data.catalog.map((p) => (
                  <tr key={p.productId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      <Link href={`/products/${p.productId}`} className="hover:underline">
                        {p.productName}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{p.brand}</td>
                    {isOwner && (
                      <td className="px-5 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                        {formatCurrency(p.latestPurchasePrice || 0)}
                      </td>
                    )}
                    <td className="px-5 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                      {p.retailPrice !== null ? formatCurrency(p.retailPrice) : "—"}
                    </td>
                    {isOwner && (
                      <td className="px-5 py-3 text-center font-bold text-purple-600">
                        {p.retailMargin !== undefined ? `${p.retailMargin.toFixed(1)}%` : "—"}
                      </td>
                    )}
                    <td className="px-5 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                      {p.wholesalePrice !== null ? formatCurrency(p.wholesalePrice) : "—"}
                    </td>
                    {isOwner && (
                      <td className="px-5 py-3 text-center font-bold text-purple-600">
                        {p.wholesaleMargin !== undefined ? `${p.wholesaleMargin.toFixed(1)}%` : "—"}
                      </td>
                    )}
                    <td className="px-5 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                      {p.keyAccountPrice !== null ? formatCurrency(p.keyAccountPrice) : "—"}
                    </td>
                    {isOwner && (
                      <td className="px-5 py-3 text-center font-bold text-purple-600">
                        {p.keyAccountMargin !== undefined ? `${p.keyAccountMargin.toFixed(1)}%` : "—"}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Optional Price History Table */}
      {data.history && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden space-y-2">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <IconHistory className="w-4 h-4 text-zinc-500" />
              <span>Price Revision History (Past {data.history.length} changes)</span>
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3 text-center">Tier</th>
                  <th className="px-5 py-3 text-right">Price</th>
                  <th className="px-5 py-3">Effective From</th>
                  <th className="px-5 py-3">Effective To</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3">Set By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.history.map((h) => (
                  <tr key={h.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      {h.productName}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs">
                        {h.tier}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-black text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(h.amount)}
                    </td>
                    <td className="px-5 py-3 text-zinc-500">
                      {new Date(h.effectiveFrom).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-zinc-500">
                      {h.effectiveTo ? new Date(h.effectiveTo).toLocaleDateString() : "Present (Active)"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                          h.effectiveTo === null
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {h.effectiveTo === null ? "ACTIVE" : "HISTORICAL"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500">{h.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
