import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getCustomerDetails } from "@/lib/customers/service";
import { CustomerDetailActions } from "./customer-detail-actions";
import { formatCurrency, formatCrates } from "@/lib/formatters";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { IconPhone, IconMapPin } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

interface CustomerDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: CustomerDetailsPageProps) {
  const { id } = await params;
  const customer = await getCustomerDetails(id);
  return {
    title: customer ? `${customer.name} - Ledger` : "Customer Ledger",
  };
}

export default async function CustomerDetailsPage({ params }: CustomerDetailsPageProps) {
  const { id } = await params;
  const user = await requireDbUser();
  const customer = await getCustomerDetails(id);

  if (!customer) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/customers" className="hover:underline">
            ← Back to Customers
          </Link>
        </div>

        {/* Customer Header */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {customer.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  customer.isActive
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    customer.isActive ? "bg-emerald-500" : "bg-zinc-400"
                  }`}
                />
                {customer.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {customer.phone && (
                <div className="flex items-center gap-1.5">
                  <IconPhone className="w-3.5 h-3.5" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-1.5">
                  <IconMapPin className="w-3.5 h-3.5" />
                  <span>{customer.address}</span>
                </div>
              )}
              <div>
                Tier: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{customer.priceTier}</span>
              </div>
              <div>
                Credit:{" "}
                <span
                  className={`font-semibold ${
                    customer.creditAllowed ? "text-emerald-600" : "text-zinc-500"
                  }`}
                >
                  {customer.creditAllowed ? "Approved" : "Not Allowed"}
                </span>
              </div>
            </div>
          </div>

          <CustomerDetailActions
            customer={customer}
            isOwner={user.role === Role.OWNER}
          />
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Total Invoiced (Completed)
            </span>
            <div className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50 mt-1">
              {formatCurrency(customer.totalBilled)}
            </div>
            <p className="text-xs text-zinc-400 mt-1">Cumulative sales billed to account</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Total Payments Received
            </span>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
              {formatCurrency(customer.totalPaid)}
            </div>
            <p className="text-xs text-zinc-400 mt-1">Cash, online &amp; lump-sum payments</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Amount Customer Owes
            </span>
            <div
              className={`text-2xl font-extrabold tabular-nums mt-1 ${
                customer.outstandingBalance > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {formatCurrency(customer.outstandingBalance)}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {customer.outstandingBalance > 0 ? "Pending credit to be collected" : "Account fully paid"}
            </p>
          </div>
        </div>

        {/* Container Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Plastic Crate Balance
            </span>
            <div
              className={`text-2xl font-bold tabular-nums mt-1 ${
                customer.plasticCrateBalance > 0
                  ? "text-orange-600 dark:text-orange-400"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {formatCrates(customer.plasticCrateBalance)}
            </div>
            <p className="text-xs text-zinc-400 mt-1">Outstanding plastic crates with customer</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Glass Bottle Balance
            </span>
            <div
              className={`text-2xl font-bold tabular-nums mt-1 ${
                customer.glassBottleBalance > 0
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-zinc-900 dark:text-zinc-50"
              }`}
            >
              {customer.glassBottleBalance} bottles
            </div>
            <p className="text-xs text-zinc-400 mt-1">Outstanding glass bottles with customer</p>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Account Ledger &amp; Transaction History
            </h2>
            <span className="text-xs text-zinc-500">
              {customer.ledger.length} entries recorded
            </span>
          </div>

          <ScrollableTable>
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Reference</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3 text-right">Debit (Invoiced)</th>
                  <th className="px-6 py-3 text-right">Credit (Paid)</th>
                  <th className="px-6 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {customer.ledger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                      No transactions recorded for this customer yet.
                    </td>
                  </tr>
                ) : (
                  customer.ledger.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${
                        entry.status === "CANCELLED" || entry.status === "CANCELLED_SALE"
                          ? "opacity-50 line-through"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-500">
                        {new Date(entry.date).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            entry.type === "INVOICE"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold">
                        {entry.saleId ? (
                          <div>
                            <Link
                              href={`/sales/${entry.saleId}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-bold"
                            >
                              {entry.reference}
                            </Link>
                            <Link
                              href={`/sales/${entry.saleId}`}
                              className="block text-[11px] font-sans font-medium text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
                            >
                              View Invoice &rarr;
                            </Link>
                          </div>
                        ) : (
                          entry.reference
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-300">
                        {entry.description}
                      </td>
                      <td className="px-6 py-4 text-right font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {entry.saleId && (
                          <Link
                            href={`/sales/${entry.saleId}`}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View Invoice
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollableTable>
        </div>

        {/* Container Movement History */}
        {customer.containerMovements.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                Container Ledger
              </h2>
              <span className="text-xs text-zinc-500">
                {customer.containerMovements.length} entries
              </span>
            </div>
            <ScrollableTable>
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Container Type</th>
                    <th className="px-6 py-3">Direction</th>
                    <th className="px-6 py-3 text-right">Quantity</th>
                    <th className="px-6 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {customer.containerMovements.map((cm) => (
                    <tr key={cm.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-6 py-3 whitespace-nowrap text-xs text-zinc-500">
                        {new Date(cm.createdAt).toLocaleString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {cm.containerType === "PLASTIC_CRATE" ? "Plastic Crate" : "Glass Bottle"}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            cm.movementType === "DEBIT"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {cm.movementType === "DEBIT" ? "Dispatched" : "Returned"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {cm.quantity}
                      </td>
                      <td className="px-6 py-3 text-xs text-zinc-500">{cm.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        )}
      </main>
    </div>
  );
}
