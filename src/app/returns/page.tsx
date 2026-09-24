import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { ReturnStatus } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { listReturns } from "@/lib/returns/service";
import { EmptyState } from "@/components/ui/empty-state";
import { IconRotateCcw } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScrollableTable } from "@/components/ui/scrollable-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Returns & Quarantine Inspection - Pepsi Stock Balance",
};

interface ReturnsPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
  }>;
}

export default async function ReturnsPage({ searchParams }: ReturnsPageProps) {
  const user = await requireDbUser();
  const { search, status } = await searchParams;

  const validStatus =
    status === "QUARANTINED"
      ? ReturnStatus.QUARANTINED
      : status === "COMPLETED"
      ? ReturnStatus.COMPLETED
      : status === "REJECTED"
      ? ReturnStatus.REJECTED
      : status === "INSPECTED"
      ? ReturnStatus.INSPECTED
      : undefined;

  const returns = await listReturns({
    search,
    status: validStatus,
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Returns & Quarantine Inspection
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Track customer returns, quarantine incoming crates, and conduct owner quality inspections.
            </p>
          </div>
          <Link
            href="/returns/new"
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
          >
            + New Return
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <form method="GET" className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <input
                type="text"
                name="search"
                defaultValue={search || ""}
                placeholder="Search by invoice #, customer name, return ID, or reason..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="w-full sm:w-48">
              <select
                name="status"
                defaultValue={status || ""}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="QUARANTINED">Quarantined (Pending)</option>
                <option value="COMPLETED">Completed (Restocked)</option>
                <option value="REJECTED">Rejected / Damaged</option>
                <option value="INSPECTED">Inspected</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-semibold hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors cursor-pointer"
            >
              Filter
            </button>
          </form>
        </div>

        {/* Returns Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <ScrollableTable>
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3">Return ID</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Original Invoice</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3 text-center">Returned Crates</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3">Created / Inspected By</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12">
                      <EmptyState
                        icon={<IconRotateCcw className="w-8 h-8 text-zinc-400" />}
                        title="No customer returns recorded"
                        description="Record customer returns to initiate quarantine inspection, restock returnable crates, and balance container credit."
                        actionLabel="+ New Return"
                        actionHref="/returns/new"
                      />
                    </td>
                  </tr>
                ) : (
                  returns.map((r) => {
                    const isQuarantined = r.status === ReturnStatus.QUARANTINED;

                    return (
                      <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                        <td className="px-6 py-4 font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                          <Link href={`/returns/${r.id}`} className="hover:underline">
                            #{r.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-500 whitespace-nowrap">
                          {new Date(r.returnedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {r.invoiceNumber ? (
                            r.saleId ? (
                              <Link
                                href={`/sales/${r.saleId}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {r.invoiceNumber}
                              </Link>
                            ) : (
                              r.invoiceNumber
                            )
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {r.customerId ? (
                            <Link
                              href={`/customers/${r.customerId}`}
                              className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline"
                            >
                              {r.customerName}
                            </Link>
                          ) : (
                            <span className="text-zinc-500 italic">Anonymous</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center font-bold">
                          {r.totalCrates} crates
                          {r.approvedCrates > 0 && r.approvedCrates !== r.totalCrates && (
                            <div className="text-xs text-emerald-600 font-normal">
                              ({r.approvedCrates} restocked)
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-500">
                          <div>By: {r.createdByName}</div>
                          {r.inspectedByName && (
                            <div className="text-emerald-600 dark:text-emerald-400">
                              Inspected by: {r.inspectedByName}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <Link
                            href={`/returns/${r.id}`}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {isQuarantined ? "Inspect / Details" : "View Details"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      </main>
    </div>
  );
}
