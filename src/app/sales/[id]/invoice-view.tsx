"use client";

import { useState } from "react";
import Link from "next/link";
import { SaleStatus } from "@prisma/client";
import { CancelSaleModal } from "./cancel-modal";
import { formatCurrency, formatCrates, formatDateTime } from "@/lib/formatters";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  IconPrinter,
  IconPencil,
  IconLock,
  IconHistory,
  IconReceipt,
  IconFileSpreadsheet,
  IconAlertTriangle,
} from "@/components/ui/icons";
import { ThermalReceipt } from "@/components/ui/thermal-receipt";
import type { SaleDetails } from "@/lib/sales/service";
import { isCloudPortal } from "@/lib/config/portal-mode";

export function InvoiceView({
  sale,
  isOwner,
}: {
  sale: SaleDetails;
  isOwner: boolean;
}) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"thermal" | "ledger">("thermal");

  const handlePrint = () => {
    window.print();
  };

  const isCancelled = sale.status === SaleStatus.CANCELLED;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TOP ACTION & NAVIGATION BAR (Hidden during print)                      */}
      {/* ========================================================================= */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/sales"
            className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            ← Back to Sales
          </Link>
          <span className="text-zinc-300 dark:text-zinc-700">|</span>
          <span className="font-mono text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {sale.invoiceNumber}
          </span>
          <StatusBadge status={sale.status} />

          {/* View Mode Switcher Pills */}
          <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("thermal")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === "thermal"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <IconReceipt className="w-3.5 h-3.5" />
              <span>80mm Thermal Receipt</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("ledger")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMode === "ledger"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              <IconFileSpreadsheet className="w-3.5 h-3.5" />
              <span>Full Ledger View</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-xs transition-all cursor-pointer flex items-center gap-2"
            title="Print on 80mm thermal receipt printer (Ctrl+P)"
          >
            <IconPrinter className="w-4 h-4" />
            <span>Print 80mm Receipt</span>
          </button>

          {/* Edit and Cancel Actions (Depot mode only) */}
          {!isCancelled && !isCloudPortal() && (
            <>
              <Link
                href={`/sales/${sale.id}/edit`}
                className="px-3.5 py-2 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center gap-1.5"
                title="Edit products, rates, quantities or discounts"
              >
                <IconPencil className="w-3.5 h-3.5" />
                <span>Edit Invoice</span>
              </Link>

              <button
                type="button"
                onClick={() => setCancelModalOpen(true)}
                className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
                title="Cancel invoice and restore stock (Owner Only)"
              >
                Cancel Invoice
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 80MM POS THERMAL RECEIPT                                                */}
      {/* Rendered by isolated ThermalReceipt component (thermal-receipt.tsx)       */}
      {/* Visible on-screen when viewMode==="thermal"; always printed via @media print */}
      {/* ========================================================================= */}
      <div
        className={`${
          viewMode === "thermal" ? "block" : "hidden print:block"
        } mx-auto my-2`}
      >
        <ThermalReceipt sale={sale} />
      </div>

      {/* ========================================================================= */}
      {/* 3. FULL ENTERPRISE LEDGER VIEW (Screen only, toggled via pills)            */}
      {/* ========================================================================= */}
      {viewMode === "ledger" && (
        <div className="print:hidden bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 shadow-xs space-y-8">
          {/* Cancelled Banner */}
          {isCancelled && (
            <div className="p-4 rounded-xl bg-red-100 dark:bg-red-950/70 border-2 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="font-black text-lg tracking-wider flex items-center gap-2">
                  <IconAlertTriangle className="w-5 h-5 shrink-0" />
                  <span>INVOICE CANCELLED</span>
                </div>
                <p className="text-xs mt-0.5">
                  Reason: <b>{sale.cancellationReason || "Not specified"}</b>
                </p>
              </div>
              <div className="text-xs text-right text-red-700 dark:text-red-300">
                {sale.cancelledAt && (
                  <div>Cancelled on {new Date(sale.cancelledAt).toLocaleString()}</div>
                )}
                {sale.updatedByName && <div>By {sale.updatedByName}</div>}
              </div>
            </div>
          )}

          {/* Desktop Invoice Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-black shadow-xs">
                  P
                </span>
                <span className="font-extrabold text-xl text-zinc-900 dark:text-zinc-50">
                  Pepsi Stock Balance &amp; Distribution
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Authorized Distribution Center • Full Crate Invoicing
              </p>
              <p className="text-xs text-zinc-500">
                Cashier / Issued By:{" "}
                <b className="text-zinc-700 dark:text-zinc-300">{sale.createdByName}</b>
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
                SALES INVOICE
              </h1>
              <div className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                {sale.invoiceNumber}
              </div>
              <div className="text-xs text-zinc-500">
                Date: {formatDateTime(sale.soldAt)}
              </div>
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Tier: {sale.saleType}
              </div>
            </div>
          </div>

          {/* Customer Information Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-zinc-50 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <div>
              <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                Billed To:
              </span>
              {sale.customer ? (
                <div className="mt-1">
                  <div className="font-bold text-base text-zinc-900 dark:text-zinc-50">
                    {sale.customer.name}
                  </div>
                  {sale.customer.phone && (
                    <div className="text-xs text-zinc-500">Phone: {sale.customer.phone}</div>
                  )}
                  {sale.customer.address && (
                    <div className="text-xs text-zinc-500">Address: {sale.customer.address}</div>
                  )}
                </div>
              ) : (
                <div className="mt-1 font-semibold text-zinc-700 dark:text-zinc-300">
                  Anonymous Walk-in (No Customer Record)
                </div>
              )}
            </div>

            {sale.customer && (
              <div className="sm:text-right">
                <span className="text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                  Account Outstanding
                </span>
                <div className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(sale.customer.outstandingBalance)}
                </div>
                <p className="text-xs text-zinc-400">Net balance across customer ledger</p>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Product Description</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4 text-center">Crates</th>
                  <th className="py-3 px-4 text-right">Price / Crate</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {sale.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20">
                    <td className="py-3 px-4 text-xs text-zinc-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-50">
                      {item.productName}
                    </td>
                    <td className="py-3 px-4 text-xs text-zinc-500">{item.productBrand}</td>
                    <td className="py-3 px-4 text-center font-bold">{formatCrates(item.quantity)}</td>
                    <td className="py-3 px-4 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-3 px-4 text-right font-bold text-zinc-900 dark:text-zinc-50">
                      {formatCurrency(item.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Desktop Summary Footer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <div>
              <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider">
                Payments &amp; Collections
              </span>
              <div className="mt-2 space-y-2">
                {sale.payments.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">No payments recorded on this invoice.</p>
                ) : (
                  sale.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800"
                    >
                      <div>
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">
                          {p.paymentMethod}
                        </span>
                        {p.referenceNumber && (
                          <span className="text-zinc-400 ml-2">({p.referenceNumber})</span>
                        )}
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatCurrency(sale.subtotal)}
                </span>
              </div>

              {sale.discount > 0 && (
                <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount:</span>
                  <span>-{formatCurrency(sale.discount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-base font-extrabold text-zinc-900 dark:text-zinc-50 border-t border-zinc-200 dark:border-zinc-700 pt-2">
                <span>Total Invoice:</span>
                <span>{formatCurrency(sale.totalAmount)}</span>
              </div>

              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span>Paid Amount:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(sale.paidAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between text-base font-bold border-t border-zinc-200 dark:border-zinc-700 pt-2">
                <span>Credit Due:</span>
                <span
                  className={
                    sale.creditAmount > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-500"
                  }
                >
                  {formatCurrency(sale.creditAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. OWNER-ONLY FINANCIAL SUMMARY (Print:Hidden)                             */}
      {/* ========================================================================= */}
      {isOwner && sale.grossProfit !== undefined && (
        <div className="print:hidden p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                <IconLock className="w-3.5 h-3.5" />
                <span>Owner Financial Confidential Summary</span>
              </span>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                Gross profit calculated from snapshot purchase cost at transaction time. Confidential to Owner.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                Gross Profit:
              </span>
              <div className="text-xl font-extrabold text-purple-900 dark:text-purple-100">
                {formatCurrency(sale.grossProfit)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. IMMUTABLE AUDIT TRAIL (Print:Hidden)                                    */}
      {/* ========================================================================= */}
      {sale.auditLogs.length > 0 && (
        <div className="print:hidden pt-4 space-y-3">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <IconHistory className="w-4 h-4 text-zinc-500" />
            <span>Immutable Audit Trail</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-normal">
              {sale.auditLogs.length} modifications
            </span>
          </h3>

          <div className="space-y-2">
            {sale.auditLogs.map((log) => (
              <div
                key={log.id}
                className="text-xs p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 space-y-1"
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-blue-600 dark:text-blue-400">{log.action}</span>
                  <span className="text-zinc-500">
                    {new Date(log.createdAt).toLocaleString()} by {log.userName}
                  </span>
                </div>
                <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                  Reason: &ldquo;{log.reason}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. OWNER-ONLY CANCELLATION MODAL                                          */}
      {/* ========================================================================= */}
      {cancelModalOpen && (
        <CancelSaleModal
          saleId={sale.id}
          invoiceNumber={sale.invoiceNumber}
          onClose={() => setCancelModalOpen(false)}
        />
      )}
    </>
  );
}
