import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getReceivingDetails } from "@/lib/receiving/service";
import { ReceivingActionsBar } from "./receiving-actions-bar";

export const dynamic = "force-dynamic";

interface ReceivingDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: ReceivingDetailsPageProps) {
  const { id } = await params;
  return {
    title: `Receiving Voucher #${id.slice(0, 8)} - Pepsi Stock Balance`,
  };
}

export default async function ReceivingDetailsPage({ params }: ReceivingDetailsPageProps) {
  const { id } = await params;

  // 1. Authenticated user assertion
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  // 2. Fetch receiving details
  const receiving = await getReceivingDetails(id, isOwner);

  if (!receiving) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader user={user} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="space-y-6">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/receiving" className="hover:underline">
              Receiving
            </Link>
            <span>/</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-medium">
              Voucher #{receiving.referenceNumber || receiving.id.slice(0, 8)}
            </span>
          </div>

          {/* Header & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  Stock Delivery #{receiving.referenceNumber || receiving.id.slice(0, 8)}
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    receiving.isPosted
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      receiving.isPosted ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {receiving.isPosted ? "Posted to Stock Ledger" : "Draft (Unposted)"}
                </span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Supplier: <strong className="text-zinc-900 dark:text-zinc-100">{receiving.supplierName}</strong>
              </p>
            </div>

            <ReceivingActionsBar receivingId={receiving.id} isPosted={receiving.isPosted} />
          </div>

          {/* Delivery Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Received Date
              </span>
              <p className="text-base font-bold mt-1 text-zinc-900 dark:text-zinc-100">
                {new Date(receiving.receivedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 block">
                Recorded by: {receiving.createdByName}
              </span>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Total Volume
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
                  {receiving.totalCrates}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  crates ({receiving.items.length} line items)
                </span>
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 block">
                {receiving.isPosted ? "Added to on-hand inventory" : "Pending stock entry"}
              </span>
            </div>

            {/* Total Cost (OWNER ONLY) */}
            {isOwner && (
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                    Total Invoiced Cost
                  </span>
                  <span className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold px-1.5 py-0.5 rounded">
                    OWNER
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xs text-zinc-400">Rs.</span>
                  <span className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
                    {receiving.totalCost ?? "0.00"}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 block">
                  Delivery invoice total
                </span>
              </div>
            )}
          </div>

          {/* Notes Card if present */}
          {receiving.notes && (
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
                Delivery Notes
              </span>
              {receiving.notes}
            </div>
          )}

          {/* Received Items Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Delivered Items Breakdown
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th scope="col" className="px-6 py-3">Product Name</th>
                    <th scope="col" className="px-6 py-3">Brand</th>
                    <th scope="col" className="px-6 py-3">Quantity (Full Crates)</th>
                    {isOwner && <th scope="col" className="px-6 py-3">Cost / Crate</th>}
                    {isOwner && <th scope="col" className="px-6 py-3 text-right">Line Total</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {receiving.items.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.productName}
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-xs">
                        {item.brand}
                      </td>
                      <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100">
                        {item.quantity} <span className="text-xs font-normal text-zinc-500">crates</span>
                      </td>
                      {isOwner && (
                        <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300">
                          Rs. {item.purchasePrice}
                        </td>
                      )}
                      {isOwner && (
                        <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-50">
                          Rs. {item.totalCost}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
