"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgingReportResult } from "@/lib/reports/service";
import { formatCurrency } from "@/lib/formatters";
import {
  IconDownload,
  IconFileSpreadsheet,
  IconUsers,
  IconClock,
  IconAlertTriangle,
} from "@/components/ui/icons";

interface AgingReportClientProps {
  data: AgingReportResult;
  filters: {
    search: string;
    hasBalanceOnly: boolean;
    page: number;
  };
}

export function AgingReportClient({ data, filters }: AgingReportClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);
  const [hasBalanceOnly, setHasBalanceOnly] = useState(filters.hasBalanceOnly);

  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (!hasBalanceOnly) q.set("hasBalanceOnly", "false");
    q.set("page", "1");
    router.push(`/reports/aging?${q.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (!hasBalanceOnly) q.set("hasBalanceOnly", "false");
    q.set("page", newPage.toString());
    router.push(`/reports/aging?${q.toString()}`);
  };

  const exportUrl = `/api/reports/export?report=aging&search=${encodeURIComponent(
    search
  )}&hasBalanceOnly=${hasBalanceOnly}`;

  const { summary } = data;
  const total = summary.totalOutstanding || 1; // avoid /0

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/reports" className="hover:underline">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span>Customer Accounts Receivable Aging</span>
      </div>

      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
            Accounts Receivable Aging Report
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Categorize customer outstanding balances by age brackets (Current, 31-60d, 61-90d, 90+d) using first-in first-out (FIFO) debt settlement.
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

      {/* Aging KPI Brackets Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Outstanding */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            <span>Total Receivables</span>
            <IconUsers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-zinc-900 dark:text-zinc-50">
            {formatCurrency(summary.totalOutstanding)}
          </div>
          <div className="text-xs text-zinc-500">
            {summary.totalCustomersWithBalance} customers with balance
          </div>
        </div>

        {/* Current: 0 - 30 Days */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-900/40 shadow-xs space-y-1 bg-emerald-50/10">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <span>Current (0-30 Days)</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {((summary.buckets.current / total) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-300">
            {formatCurrency(summary.buckets.current)}
          </div>
          <div className="text-xs text-zinc-500">Normal payment cycle</div>
        </div>

        {/* 31 - 60 Days */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-amber-200 dark:border-amber-900/40 shadow-xs space-y-1 bg-amber-50/10">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <span>31 - 60 Days</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
              {((summary.buckets.days31To60 / total) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-300">
            {formatCurrency(summary.buckets.days31To60)}
          </div>
          <div className="text-xs text-zinc-500">Follow-up suggested</div>
        </div>

        {/* 61 - 90 Days */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-orange-200 dark:border-orange-900/40 shadow-xs space-y-1 bg-orange-50/10">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
            <span>61 - 90 Days</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-black bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
              {((summary.buckets.days61To90 / total) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-xl font-black text-orange-700 dark:text-orange-300">
            {formatCurrency(summary.buckets.days61To90)}
          </div>
          <div className="text-xs text-zinc-500">Overdue collection</div>
        </div>

        {/* 90+ Days */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-red-200 dark:border-red-900/40 shadow-xs space-y-1 bg-red-50/10">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
            <span>90+ Days</span>
            <span className="text-xs px-1.5 py-0.5 rounded font-black bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
              {((summary.buckets.over90 / total) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="text-xl font-black text-red-700 dark:text-red-300">
            {formatCurrency(summary.buckets.over90)}
          </div>
          <div className="text-xs text-red-600 font-semibold">Critical / High Risk</div>
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
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={hasBalanceOnly}
              onChange={(e) => setHasBalanceOnly(e.target.checked)}
              className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Only with Outstanding Balance</span>
          </label>

          <button
            type="submit"
            className="text-xs font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
          >
            Apply Filter
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 text-right">Total Balance</th>
                <th className="py-3 px-4 text-right">Current (0-30d)</th>
                <th className="py-3 px-4 text-right">31 - 60 Days</th>
                <th className="py-3 px-4 text-right">61 - 90 Days</th>
                <th className="py-3 px-4 text-right">90+ Days</th>
                <th className="py-3 px-4 text-center">Oldest Unpaid</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No customers found matching the criteria.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr
                    key={row.customerId}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">
                        {row.customerName}
                      </div>
                      <div className="text-xs text-zinc-500 flex items-center gap-2 mt-0.5">
                        {row.phone && <span>{row.phone}</span>}
                        <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 font-medium uppercase text-xs">
                          {row.priceTier}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-zinc-900 dark:text-zinc-100">
                      {formatCurrency(row.outstandingBalance)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                      {row.buckets.current > 0 ? formatCurrency(row.buckets.current) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400 font-semibold">
                      {row.buckets.days31To60 > 0 ? formatCurrency(row.buckets.days31To60) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-orange-600 dark:text-orange-400 font-semibold">
                      {row.buckets.days61To90 > 0 ? formatCurrency(row.buckets.days61To90) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-red-600 dark:text-red-400">
                      {row.buckets.over90 > 0 ? formatCurrency(row.buckets.over90) : "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.oldestUnpaidDays > 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                            row.oldestUnpaidDays > 90
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : row.oldestUnpaidDays > 30
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          <IconClock className="w-3 h-3" />
                          <span>{row.oldestUnpaidDays} days</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/customers/${row.customerId}`}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View Ledger →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="py-3 px-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <div>
            Showing Page <strong>{data.pagination.page}</strong> of{" "}
            <strong>{data.pagination.totalPages}</strong> (
            <strong>{data.pagination.totalRows}</strong> customers)
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={data.pagination.page <= 1}
              onClick={() => handlePageChange(data.pagination.page - 1)}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={data.pagination.page >= data.pagination.totalPages}
              onClick={() => handlePageChange(data.pagination.page + 1)}
              className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
