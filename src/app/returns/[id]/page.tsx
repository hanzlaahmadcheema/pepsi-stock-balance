import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role, ReturnStatus } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getReturnDetails } from "@/lib/returns/service";
import { InspectionPanel } from "./inspection-panel";
import { IconPackage, IconHistory, IconAlertTriangle } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

interface ReturnDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: ReturnDetailsPageProps) {
  const { id } = await params;
  return {
    title: `Return #${id.slice(0, 8)} - Pepsi Stock Balance`,
  };
}

export default async function ReturnDetailsPage({ params }: ReturnDetailsPageProps) {
  const { id } = await params;
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  const returnRecord = await getReturnDetails(id);

  if (!returnRecord) {
    notFound();
  }

  const isQuarantined = returnRecord.status === ReturnStatus.QUARANTINED;
  const isCompleted = returnRecord.status === ReturnStatus.COMPLETED;
  const isRejected = returnRecord.status === ReturnStatus.REJECTED;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/returns" className="hover:underline">
            ← Back to Returns
          </Link>
          <span>/</span>
          <span>Return #{returnRecord.id.slice(0, 8)}</span>
        </div>

        {/* Quarantine / Inspection Explanation Banner */}
        {isQuarantined && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
            <IconAlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                Returned goods have been placed in inspection.
              </h3>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-1">
                These returned items are currently in quarantine and are <strong>NOT available for sale</strong>. They will only enter sellable warehouse stock after an owner completes quality inspection and approves them.
              </p>
            </div>
          </div>
        )}

        {/* Voucher Header */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                Return Voucher #{returnRecord.id.slice(0, 8)}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isQuarantined
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : isCompleted
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : isRejected
                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                    : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isQuarantined
                      ? "bg-amber-500 animate-pulse"
                      : isCompleted
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                />
                {returnRecord.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-zinc-500">
              <div>
                Date Returned: <b>{new Date(returnRecord.returnedAt).toLocaleString()}</b>
              </div>
              <div>
                Created By: <b className="text-zinc-700 dark:text-zinc-300">{returnRecord.createdByName}</b>
              </div>
              {returnRecord.inspectedByName && (
                <div>
                  Inspected By: <b className="text-emerald-600">{returnRecord.inspectedByName}</b>
                </div>
              )}
            </div>
          </div>

          <div className="text-sm md:text-right space-y-1 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-semibold uppercase text-zinc-500">Linked Invoice</span>
            {returnRecord.invoiceNumber ? (
              <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                {returnRecord.saleId ? (
                  <Link href={`/sales/${returnRecord.saleId}`} className="hover:underline">
                    {returnRecord.invoiceNumber}
                  </Link>
                ) : (
                  returnRecord.invoiceNumber
                )}
              </div>
            ) : (
              <div className="text-xs text-zinc-400">Not linked</div>
            )}
            <div className="text-xs text-zinc-600 dark:text-zinc-300">
              Customer: <b>{returnRecord.customerName}</b>
            </div>
          </div>
        </div>

        {/* Reason & Remarks Box */}
        {(returnRecord.reason || returnRecord.notes) && (
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
            {returnRecord.reason && (
              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">Return Reason:</span>{" "}
                <span className="text-zinc-600 dark:text-zinc-400">{returnRecord.reason}</span>
              </div>
            )}
            {returnRecord.notes && (
              <div>
                <span className="font-bold text-zinc-700 dark:text-zinc-300">Remarks:</span>{" "}
                <span className="text-zinc-600 dark:text-zinc-400">{returnRecord.notes}</span>
              </div>
            )}
          </div>
        )}

        {/* Line Items Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
              Returned Products (Full Crates)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Product Description</th>
                  <th className="px-6 py-3">Brand</th>
                  <th className="px-6 py-3 text-center">Returned Crates</th>
                  <th className="px-6 py-3 text-center">Inspection Result</th>
                  <th className="px-6 py-3">Inspection Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {returnRecord.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-6 py-4 text-xs text-zinc-400">{idx + 1}</td>
                    <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      {item.productName}
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-500">{item.productBrand}</td>
                    <td className="px-6 py-4 text-center font-bold text-base">
                      {item.quantity}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          item.inspectionResult === "APPROVED_FOR_STOCK"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : item.inspectionResult === "REJECTED_DAMAGED"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : item.inspectionResult === "DISPOSED"
                            ? "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {item.inspectionResult.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      {item.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inspection Panel (Interactive for Owner if Quarantined, or Summary) */}
        <InspectionPanel returnRecord={returnRecord} isOwner={isOwner} />

        {/* Container Movements (if recorded) */}
        {returnRecord.containerMovements.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <IconPackage className="w-4 h-4 text-zinc-500" />
              <span>Returnable Container Ledger Activity</span>
            </h3>
            <p className="text-xs text-zinc-500">
              These movements were credited to the customer&apos;s container balance (separate from product stock).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {returnRecord.containerMovements.map((c) => (
                <div
                  key={c.id}
                  className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {c.containerType}
                    </span>
                    <div className="text-zinc-400">Movement: {c.movementType}</div>
                  </div>
                  <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    +{c.quantity} units
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Trail */}
        {returnRecord.auditLogs.length > 0 && (
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <IconHistory className="w-4 h-4 text-zinc-500" />
              <span>Immutable Audit Trail</span>
            </h3>
            <div className="space-y-2">
              {returnRecord.auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-blue-600 dark:text-blue-400">{log.action}</span>
                    <span className="text-zinc-500">
                      {new Date(log.createdAt).toLocaleString()} by {log.userName}
                    </span>
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Reason: &ldquo;{log.reason}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
