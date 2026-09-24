import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { listReceivings } from "@/lib/receiving/service";
import { formatCurrency } from "@/lib/formatters";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTruck } from "@/components/ui/icons";
import { ScrollableTable } from "@/components/ui/scrollable-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Receiving & Purchases - Pepsi Stock Balance",
  description: "Track beverage supplier deliveries, stock receiving, and inventory inflows",
};

export default async function ReceivingPage() {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  const receivings = await listReceivings(isOwner);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader user={user} />

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Stock Receiving</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Log and track inbound full-crate shipments from beverage suppliers.
              </p>
            </div>

            <Link
              href="/receiving/new"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Receiving
            </Link>
          </div>

          {/* Receivings Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Delivery Records ({receivings.length})
              </h2>
            </div>

            <ScrollableTable>
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th scope="col" className="px-6 py-3">Date</th>
                    <th scope="col" className="px-6 py-3">Supplier</th>
                    <th scope="col" className="px-6 py-3">Invoice / Ref #</th>
                    <th scope="col" className="px-6 py-3">Crates Received</th>
                    {isOwner && <th scope="col" className="px-6 py-3">Total Cost</th>}
                    <th scope="col" className="px-6 py-3">Recorded By</th>
                    <th scope="col" className="px-6 py-3">Status</th>
                    <th scope="col" className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {receivings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isOwner ? 8 : 7}
                        className="px-6 py-12"
                      >
                        <EmptyState
                          icon={<IconTruck className="w-8 h-8 text-zinc-400" />}
                          title="No receiving shipments found"
                          description="Log supplier delivery shipments to track stock inflows and purchase costs."
                          actionLabel="+ New Receiving"
                          actionHref="/receiving/new"
                        />
                      </td>
                    </tr>
                  ) : (
                    receivings.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                          {new Date(r.receivedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                          {r.supplierName}
                        </td>
                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap font-mono text-xs">
                          {r.referenceNumber || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {r.totalCrates}
                          </span>{" "}
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            crates ({r.itemsCount} items)
                          </span>
                        </td>
                        {isOwner && (
                          <td className="px-6 py-4 whitespace-nowrap font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                            {formatCurrency(r.totalCost)}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400 text-xs">
                          {r.createdByName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              r.isPosted
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                r.isPosted ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                            />
                            {r.isPosted ? "Posted to Stock" : "Draft"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <Link
                            href={`/receiving/${r.id}`}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View Details →
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        </div>
      </main>
    </div>
  );
}
