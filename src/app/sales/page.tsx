import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { Role, SaleStatus } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { listSales } from "@/lib/sales/service";
import { formatCurrency } from "@/lib/formatters";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IconShoppingCart } from "@/components/ui/icons";
import { ScrollableTable } from "@/components/ui/scrollable-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sales & Invoicing - Pepsi Stock Balance",
};

interface SalesPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const { search, status, startDate, endDate } = await searchParams;

  const validStatus =
    status === "COMPLETED"
      ? SaleStatus.COMPLETED
      : status === "CANCELLED"
      ? SaleStatus.CANCELLED
      : undefined;

  const sales = await listSales(
    {
      search,
      status: validStatus,
      startDate,
      endDate,
    },
    isOwner
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Sales & Invoicing
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Issue invoices, track crate dispatches, and manage customer credit.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/customers"
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-semibold transition-colors"
            >
              Customers & Balances
            </Link>
            <Link
              href="/sales/new"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              + New Sale
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                Search Invoice / Customer
              </label>
              <input
                type="text"
                name="search"
                defaultValue={search || ""}
                placeholder="e.g. INV-2026 or Customer"
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                Status
              </label>
              <select
                name="status"
                defaultValue={status || ""}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                From Date
              </label>
              <input
                type="date"
                name="startDate"
                defaultValue={startDate || ""}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  name="endDate"
                  defaultValue={endDate || ""}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
              >
                Filter
              </button>
            </div>
          </form>
        </div>

        {/* Sales Invoices List: Mobile Cards + Desktop Table */}
        {sales.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm">
            <EmptyState
              icon={<IconShoppingCart className="w-8 h-8 text-zinc-400" />}
              title="No sales invoices found"
              description="Record customer or walk-in sales to generate invoices, update inventory, and track receivables."
              actionLabel="+ New Sale"
              actionHref="/sales/new"
            />
          </div>
        ) : (
          <>
            {/* Mobile Card View (< sm screens) */}
            <div className="sm:hidden space-y-3">
              {sales.map((s) => (
                <div
                  key={s.id}
                  className={`bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3 ${
                    s.status === SaleStatus.CANCELLED ? "opacity-60 bg-red-50/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/sales/${s.id}`}
                      className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {s.invoiceNumber}
                    </Link>
                    <StatusBadge status={s.status} />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {s.customerId ? s.customerName : "Walk-in Customer"}
                    </span>
                    <span className="text-zinc-500">
                      {new Date(s.soldAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase font-bold">Total</span>
                      <span className="font-bold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(s.totalAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase font-bold">Paid</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(s.paidAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block text-[10px] uppercase font-bold">Credit</span>
                      <span className={s.creditAmount > 0 ? "font-bold text-amber-600 dark:text-amber-400" : "text-zinc-400"}>
                        {s.creditAmount > 0 ? formatCurrency(s.creditAmount) : "Rs. 0"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end border-t border-zinc-100 dark:border-zinc-800">
                    <Link
                      href={`/sales/${s.id}`}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View Invoice Details →
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (sm+ screens) */}
            <div className="hidden sm:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
              <ScrollableTable>
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-3">Invoice #</th>
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Total</th>
                      <th className="px-6 py-3 text-right">Paid</th>
                      <th className="px-6 py-3 text-right">Credit Due</th>
                      {isOwner && <th className="px-6 py-3 text-right">Gross Profit</th>}
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {sales.map((s) => (
                      <tr
                        key={s.id}
                        className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${
                          s.status === SaleStatus.CANCELLED ? "opacity-60 bg-red-50/20" : ""
                        }`}
                      >
                        <td className="px-6 py-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          <Link href={`/sales/${s.id}`} className="hover:underline">
                            {s.invoiceNumber}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          {s.customerId ? (
                            <Link
                              href={`/customers/${s.customerId}`}
                              className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
                            >
                              {s.customerName}
                            </Link>
                          ) : (
                            <span className="text-zinc-500 italic">Walk-in</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-500 whitespace-nowrap">
                          {new Date(s.soldAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                            {s.saleType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-6 py-4 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatCurrency(s.totalAmount)}
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatCurrency(s.paidAmount)}
                        </td>
                        <td className="px-6 py-4 text-right tabular-nums">
                          {s.creditAmount > 0 ? (
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {formatCurrency(s.creditAmount)}
                            </span>
                          ) : (
                            <span className="text-zinc-400">{formatCurrency(0)}</span>
                          )}
                        </td>
                        {isOwner && (
                          <td className="px-6 py-4 text-right font-semibold tabular-nums">
                            {s.grossProfit !== undefined ? (
                              <span
                                className={
                                  s.grossProfit >= 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-600"
                                }
                              >
                                {formatCurrency(s.grossProfit)}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <Link
                            href={`/sales/${s.id}`}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View Invoice
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
