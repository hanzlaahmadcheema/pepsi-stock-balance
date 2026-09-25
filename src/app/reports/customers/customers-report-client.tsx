"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomerReportResult } from "@/lib/reports/service";
import { formatCurrency } from "@/lib/formatters";
import { IconDownload, IconFileSpreadsheet } from "@/components/ui/icons";

interface CustomersReportClientProps {
  data: CustomerReportResult;
  filters: {
    search: string;
    onlyWithBalance: boolean;
    page: number;
  };
}

export function CustomersReportClient({
  data,
  filters,
}: CustomersReportClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(filters.search);
  const [onlyWithBalance, setOnlyWithBalance] = useState(filters.onlyWithBalance);

  const handleFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (onlyWithBalance) q.set("onlyWithBalance", "true");
    q.set("page", "1");
    router.push(`/reports/customers?${q.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const q = new URLSearchParams();
    if (search.trim()) q.set("search", search.trim());
    if (onlyWithBalance) q.set("onlyWithBalance", "true");
    q.set("page", newPage.toString());
    router.push(`/reports/customers?${q.toString()}`);
  };

  const exportUrl = `/api/reports/export?report=customers&search=${encodeURIComponent(search)}&onlyWithBalance=${onlyWithBalance}`;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/reports" className="hover:underline">
          ← Back to Reports
        </Link>
        <span>/</span>
        <span>Customer Credit & Ledger Report</span>
      </div>

      {/* Header & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            Customer Credit & Ledger Report
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Accounts receivable balances, lifetime payments, crate purchase volume, and empty container balance.
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
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={onlyWithBalance}
              onChange={(e) => setOnlyWithBalance(e.target.checked)}
              className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Only with Outstanding Balance</span>
          </label>

          <button
            type="submit"
            className="text-xs font-bold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      </form>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Active Accounts</span>
          <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
            {data.summary.totalActiveCustomers} customers
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Total Receivables</span>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {formatCurrency(data.summary.totalCreditOutstanding)}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <span className="text-xs font-semibold text-zinc-500 uppercase">Accounts with Balance</span>
          <div className="text-xl font-black text-zinc-900 dark:text-zinc-50 mt-1">
            {data.summary.customersWithBalanceCount} accounts
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
              <tr>
                <th className="px-5 py-3">Customer Name</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3 text-center">Tier</th>
                <th className="px-5 py-3 text-right">Total Purchases</th>
                <th className="px-5 py-3 text-center">Crates</th>
                <th className="px-5 py-3 text-right">Payments Made</th>
                <th className="px-5 py-3 text-right font-bold text-amber-600">Balance Due</th>
                <th className="px-5 py-3 text-center">Glass Bottles</th>
                <th className="px-5 py-3 text-center">Plastic Crates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-zinc-500">
                    No customers found matching the criteria.
                  </td>
                </tr>
              ) : (
                data.customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                      <Link href={`/customers/${c.id}`} className="hover:underline text-blue-600 dark:text-blue-400 font-bold">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-500 font-mono">{c.phone || "—"}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs">
                        {c.priceTier}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-zinc-800 dark:text-zinc-200">
                      {formatCurrency(c.totalSalesAmount)}
                    </td>
                    <td className="px-5 py-3 text-center font-bold text-zinc-800 dark:text-zinc-200">
                      {c.totalCratesBought}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-emerald-600">
                      {formatCurrency(c.totalPaymentsAmount)}
                    </td>
                    <td className="px-5 py-3 text-right font-black text-sm text-amber-600">
                      {c.outstandingBalance > 0.01 ? formatCurrency(c.outstandingBalance) : "—"}
                    </td>
                    <td className="px-5 py-3 text-center font-mono">
                      {c.glassBottleBalance > 0 ? (
                        <span className="text-amber-600 font-bold">+{c.glassBottleBalance}</span>
                      ) : (
                        <span className="text-zinc-400">0</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center font-mono">
                      {c.plasticCrateBalance > 0 ? (
                        <span className="text-amber-600 font-bold">+{c.plasticCrateBalance}</span>
                      ) : (
                        <span className="text-zinc-400">0</span>
                      )}
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
              {data.pagination.totalRecords} customers)
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
