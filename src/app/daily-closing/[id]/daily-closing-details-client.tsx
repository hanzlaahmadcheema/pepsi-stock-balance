"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { DailyClosingStatus } from "@prisma/client";
import { DailyClosingSummary } from "@/lib/daily-closing/service";
import {
  submitDailyClosingAction,
  finalizeDailyClosingAction,
  reopenDailyClosingAction,
  ActionState,
} from "../actions";
import { formatCurrency } from "@/lib/formatters";
import {
  IconReceipt,
  IconDollarSign,
  IconDeviceMobile,
  IconBanknotes,
  IconPackage,
  IconClipboardList,
} from "@/components/ui/icons";

interface DailyClosingDetailsClientProps {
  summary: DailyClosingSummary;
  isOwner: boolean;
  currentUserId: string;
}

export function DailyClosingDetailsClient({
  summary,
  isOwner,
}: DailyClosingDetailsClientProps) {
  const closing = summary.closing;
  const status = closing?.status || DailyClosingStatus.OPEN;
  const isOpen = status === DailyClosingStatus.OPEN;
  const isInReview = status === DailyClosingStatus.IN_REVIEW;
  const isClosed = status === DailyClosingStatus.CLOSED;

  const [activeTab, setActiveTab] = useState<"invoices" | "payments" | "stock" | "audit">(
    "invoices"
  );
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const [physicalCashInput, setPhysicalCashInput] = useState<string>(
    closing?.physicalCash ? closing.physicalCash.toString() : summary.cashDrawer.totalCashExpected.toString()
  );

  const [submitState, submitAction, isSubmitting] = useActionState<ActionState, FormData>(
    submitDailyClosingAction,
    {}
  );
  const [finalizeState, finalizeAction, isFinalizing] = useActionState<ActionState, FormData>(
    finalizeDailyClosingAction,
    {}
  );
  const [reopenState, reopenAction, isReopening] = useActionState<ActionState, FormData>(
    reopenDailyClosingAction,
    {}
  );

  const parsedCash = parseFloat(physicalCashInput);
  const currentDifference = !isNaN(parsedCash)
    ? parsedCash - summary.cashDrawer.totalCashExpected
    : 0;

  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/daily-closing" className="hover:underline">
          ← Back to Daily Closing
        </Link>
        <span>/</span>
        <span>Reconciliation ({summary.businessDate})</span>
      </div>

      {/* Header Voucher Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
              Daily Closing:{" "}
              {new Date(summary.businessDateObj).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isClosed
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : isInReview
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isClosed
                    ? "bg-emerald-500"
                    : isInReview
                    ? "bg-amber-500 animate-pulse"
                    : "bg-blue-500"
                }`}
              />
              {status.replace("_", " ")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-zinc-500">
            <div>
              Business Date: <b className="text-zinc-800 dark:text-zinc-200">{summary.businessDate}</b>
            </div>
            {closing?.closedByName && (
              <div>
                Operator: <b className="text-zinc-800 dark:text-zinc-200">{closing.closedByName}</b>
              </div>
            )}
            {closing?.closedAt && (
              <div>
                Finalized On: <b>{new Date(closing.closedAt).toLocaleString()}</b>
              </div>
            )}
            <div>
              Inventory Status:{" "}
              <b
                className={
                  summary.stockCount.status === "ready" || summary.stockCount.status === "completed"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }
              >
                {summary.stockCount.status.replace("_", " ").toUpperCase()}
              </b>
            </div>
          </div>
        </div>

        {/* Status Header Badge / Quick Alert */}
        <div className="flex items-center gap-3">
          {isClosed ? (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 font-semibold flex items-center gap-2">
              <span>✓ Official closing finalized.</span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowReopenModal(true)}
                  className="ml-2 text-xs font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                >
                  Reopen Session
                </button>
              )}
            </div>
          ) : isInReview ? (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 font-semibold">
              ⚠️ In Review: Awaiting Owner final verification and close.
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 font-semibold">
              ⚡ Open Session: Prepare physical cash and submit when operations conclude.
            </div>
          )}
        </div>
      </div>

      {/* Action Error Alerts */}
      {submitState.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium">
          {submitState.error}
        </div>
      )}
      {finalizeState.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium">
          {finalizeState.error}
        </div>
      )}
      {reopenState.error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium">
          {reopenState.error}
        </div>
      )}

      {/* Section 1: Four Main Reconciliation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Sales & Revenue */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Sales & Invoicing
            </span>
            <IconReceipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>

          <div>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
              {formatCurrency(summary.sales.totalRevenue)}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Total completed sales revenue</p>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
            <div className="flex justify-between">
              <span>Completed Invoices:</span>
              <b className="text-zinc-900 dark:text-zinc-100">{summary.sales.completedSalesCount}</b>
            </div>
            <div className="flex justify-between">
              <span>Immediate Paid on Invoices:</span>
              <b className="text-zinc-900 dark:text-zinc-100">{formatCurrency(summary.sales.totalImmediatePaid)}</b>
            </div>
            <div className="flex justify-between">
              <span>Credit Sales (Unpaid):</span>
              <b className="text-amber-600">{formatCurrency(summary.sales.totalCreditSales)}</b>
            </div>
            {summary.sales.cancelledSalesCount > 0 && (
              <div className="flex justify-between text-red-500 font-medium">
                <span>Cancelled Invoices (Excluded):</span>
                <span>{summary.sales.cancelledSalesCount}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Total Payments Collected */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Payments Collected
            </span>
            <IconDollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.payments.totalPaymentsCollected)}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Total collected across all channels</p>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
            <div className="flex justify-between">
              <span>Cash Collections:</span>
              <b className="text-zinc-900 dark:text-zinc-100">{formatCurrency(summary.payments.totalCashCollected)}</b>
            </div>
            <div className="flex justify-between">
              <span>Digital Collections:</span>
              <b className="text-zinc-900 dark:text-zinc-100">{formatCurrency(summary.payments.totalDigitalPayments)}</b>
            </div>
            <div className="flex justify-between text-[11px] text-zinc-400 pt-1">
              <span>From Invoices: {formatCurrency(summary.payments.invoicePaymentsTotal)}</span>
              <span>Account Ledger: {formatCurrency(summary.payments.accountPaymentsTotal)}</span>
            </div>
          </div>
        </div>

        {/* 3. Digital Channels Breakdown */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Digital Payment Methods
            </span>
            <IconDeviceMobile className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>

          <div>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
              {formatCurrency(summary.payments.totalDigitalPayments)}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Non-cash verified transactions</p>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
            <div className="flex justify-between">
              <span>EasyPaisa:</span>
              <b className="text-zinc-900 dark:text-zinc-100">
                {formatCurrency(summary.payments.totalEasyPaisaCollected)}
              </b>
            </div>
            <div className="flex justify-between">
              <span>JazzCash:</span>
              <b className="text-zinc-900 dark:text-zinc-100">
                {formatCurrency(summary.payments.totalJazzCashCollected)}
              </b>
            </div>
            <div className="flex justify-between">
              <span>M-Pesa:</span>
              <b className="text-zinc-900 dark:text-zinc-100">
                {formatCurrency(summary.payments.totalMpesaCollected)}
              </b>
            </div>
            <div className="flex justify-between">
              <span>QR Code:</span>
              <b className="text-zinc-900 dark:text-zinc-100">
                {formatCurrency(summary.payments.totalQrCollected)}
              </b>
            </div>
          </div>
        </div>

        {/* 4. Cash Drawer Reconciliation */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Cash Drawer Balancing
            </span>
            <IconBanknotes className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>

          <div>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
              {formatCurrency(summary.cashDrawer.totalCashExpected)}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Expected cash in drawer (No expenses)</p>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs space-y-1 text-zinc-600 dark:text-zinc-400">
            <div className="flex justify-between items-center">
              <span>Physical Cash Counted:</span>
              <b className="text-zinc-900 dark:text-zinc-100">
                {isClosed ? formatCurrency(summary.cashDrawer.physicalCash) : (!isNaN(parsedCash) ? formatCurrency(parsedCash) : formatCurrency(0))}
              </b>
            </div>
            <div className="flex justify-between items-center">
              <span>Variance / Difference:</span>
              {currentDifference === 0 ? (
                <span className="font-bold text-emerald-600">✓ {formatCurrency(0)} (Balanced)</span>
              ) : currentDifference > 0 ? (
                <span className="font-bold text-blue-600">+{formatCurrency(currentDifference)} (Over)</span>
              ) : (
                <span className="font-bold text-red-600">-{formatCurrency(Math.abs(currentDifference))} (Short)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Stock Count & Discrepancies Integration Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <IconPackage className="w-5 h-5 text-indigo-600 dark:text-indigo-400 inline-block" />
                <span>Physical Stock Count Integration</span>
              </h2>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  summary.stockCount.status === "ready" || summary.stockCount.status === "completed"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : summary.stockCount.status === "pending_adjustments"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : summary.stockCount.status === "in_progress"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {summary.stockCount.status.replace("_", " ").toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Physical crate counting must be performed and verified before finalizing daily closing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {summary.stockCount.closingId ? (
              <Link
                href={`/stock-counts/${summary.stockCount.closingId}`}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                Open Stock Count Sheet →
              </Link>
            ) : (
              <Link
                href="/stock-counts/new"
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Perform Physical Count →
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs">
            <span className="text-zinc-500">Products Counted:</span>
            <div className="text-lg font-black text-zinc-900 dark:text-zinc-100 mt-0.5">
              {summary.stockCount.totalProductsCounted} products
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs">
            <span className="text-zinc-500">Physical Discrepancies:</span>
            <div
              className={`text-lg font-black mt-0.5 ${
                summary.stockCount.discrepanciesCount > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {summary.stockCount.discrepanciesCount}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs">
            <span className="text-zinc-500">Pending Owner Adjustments:</span>
            <div
              className={`text-lg font-black mt-0.5 ${
                summary.stockCount.pendingAdjustmentsCount > 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {summary.stockCount.pendingAdjustmentsCount} pending
            </div>
          </div>
        </div>

        {summary.stockCount.pendingAdjustments.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="font-bold flex items-center justify-between">
              <span>⚠️ Action Required: Pending Physical Stock Adjustments</span>
              <Link
                href="/stock-counts"
                className="underline hover:no-underline font-semibold text-amber-800 dark:text-amber-300"
              >
                Go to Owner Approval Queue →
              </Link>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-zinc-700 dark:text-zinc-300">
              {summary.stockCount.pendingAdjustments.map((pa) => (
                <li key={pa.id}>
                  <b>{pa.productName}</b>: Difference of{" "}
                  <span className={pa.difference > 0 ? "text-blue-600 font-bold" : "text-red-600 font-bold"}>
                    {pa.difference > 0 ? `+${pa.difference}` : pa.difference} crates
                  </span>{" "}
                  &mdash; Reason: &ldquo;{pa.reason}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Section 3: Operational Closing Actions Panel */}
      {closing && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <IconClipboardList className="w-5 h-5 text-zinc-700 dark:text-zinc-300 inline-block" />
            <span>End-of-Day Balancing Workflow</span>
          </h2>

          {/* If Session is OPEN: Staff or Owner prepares and submits */}
          {isOpen && (
            <form action={submitAction} className="space-y-4">
              <input type="hidden" name="closingId" value={closing.id} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Physical Cash Drawer Count (Rs.) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="physicalCash"
                    value={physicalCashInput}
                    onChange={(e) => setPhysicalCashInput(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-base font-mono font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-[11px] text-zinc-500">
                    Expected: {formatCurrency(summary.cashDrawer.totalCashExpected)} | Variance:{" "}
                    <span className={currentDifference === 0 ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
                      {formatCurrency(currentDifference)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Closing Notes / Shift Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    name="notes"
                    placeholder="e.g. Evening shift balanced, cash reconciled."
                    defaultValue={closing.notes || ""}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-colors cursor-pointer"
                >
                  {isSubmitting ? "Submitting..." : "Submit Closing for Owner Review →"}
                </button>
              </div>
            </form>
          )}

          {/* If Session is IN_REVIEW: Owner Final Close Action */}
          {isInReview && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                <div>
                  <span className="font-bold">Awaiting Owner Final Review.</span> Staff has prepared the numbers.
                  Physical cash recorded: <b>{formatCurrency(closing.physicalCash)}</b>.
                </div>
                <div>
                  {summary.readiness.isReadyToClose ? (
                    <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                      ✓ All checks passed
                    </span>
                  ) : (
                    <span className="text-red-700 dark:text-red-300 font-bold">
                      ⚠️ Blocked: {summary.readiness.blockingReasons[0]}
                    </span>
                  )}
                </div>
              </div>

              {isOwner ? (
                <form action={finalizeAction} className="space-y-4 pt-2">
                  <input type="hidden" name="closingId" value={closing.id} />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        Verify Physical Cash Count (Rs.)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name="physicalCash"
                        value={physicalCashInput}
                        onChange={(e) => setPhysicalCashInput(e.target.value)}
                        className="w-full px-3 py-2 text-base font-mono font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        Owner Final Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        name="notes"
                        placeholder="e.g. Reviewed and verified by Owner."
                        defaultValue={closing.notes || ""}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isFinalizing || !summary.readiness.isReadyToClose}
                      className="px-6 py-2.5 text-sm font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-xs transition-colors cursor-pointer"
                    >
                      {isFinalizing ? "Finalizing Day..." : "✓ Finalize & Close Business Day"}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-xs text-zinc-500 italic">
                  Only the Owner can execute the final close action. Please notify the Owner to complete the end-of-day signoff.
                </div>
              )}
            </div>
          )}

          {/* If Session is CLOSED */}
          {isClosed && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="font-bold">Business Day is Closed:</span> Officially reconciled and verified on{" "}
                <b>{new Date(closing.closedAt!).toLocaleString()}</b> by <b>{closing.closedByName}</b>.
                {closing.notes && <div className="mt-1 italic">&ldquo;{closing.notes}&rdquo;</div>}
              </div>

              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowReopenModal(true)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Reopen Session
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 4: Detailed Drill-down Tabs */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Tab Header */}
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 px-6 pt-3 bg-zinc-50 dark:bg-zinc-800/40">
          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "invoices"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Completed Invoices ({summary.sales.completedSalesCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "payments"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Payments Collected ({summary.payments.list.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "stock"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Counted Products ({summary.stockCount.items.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === "audit"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            Audit Trail ({summary.auditLogs.length})
          </button>
        </div>

        {/* Tab 1: Invoices */}
        {activeTab === "invoices" && (
          <div className="overflow-x-auto">
            {summary.sales.invoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No completed sales recorded on this business date.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                  <tr>
                    <th className="px-6 py-3">Invoice #</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3 text-right">Total Amount</th>
                    <th className="px-6 py-3 text-right">Immediate Paid</th>
                    <th className="px-6 py-3 text-right">Credit Amount</th>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Cashier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {summary.sales.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-6 py-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        <Link href={`/sales/${inv.id}`} className="hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-6 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        {inv.customerName}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-emerald-600">
                        {formatCurrency(inv.paidAmount)}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-amber-600">
                        {formatCurrency(inv.creditAmount)}
                      </td>
                      <td className="px-6 py-3 text-zinc-500">
                        {new Date(inv.soldAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-6 py-3 text-zinc-500">{inv.createdByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Payments */}
        {activeTab === "payments" && (
          <div className="overflow-x-auto">
            {summary.payments.list.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No payments collected on this business date.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                  <tr>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-center">Payment Method</th>
                    <th className="px-6 py-3">Payment Type</th>
                    <th className="px-6 py-3">Customer / Invoice</th>
                    <th className="px-6 py-3">Reference #</th>
                    <th className="px-6 py-3">Received By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {summary.payments.list.map((p) => (
                    <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-6 py-3 text-zinc-500">
                        {new Date(p.paidAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-emerald-600">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                          {p.paymentMethod}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        {p.isAccountPayment ? (
                          <span className="font-bold text-purple-600 dark:text-purple-400">
                            Account Payment
                          </span>
                        ) : (
                          <span className="text-zinc-600 dark:text-zinc-400">Direct Sale</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {p.customerName && <span className="font-medium">{p.customerName}</span>}
                        {p.invoiceNumber && (
                          <span className="font-mono text-zinc-500 ml-1">({p.invoiceNumber})</span>
                        )}
                        {!p.customerName && !p.invoiceNumber && <span className="text-zinc-400">—</span>}
                      </td>
                      <td className="px-6 py-3 text-zinc-500 font-mono">{p.referenceNumber || "—"}</td>
                      <td className="px-6 py-3 text-zinc-500">{p.receivedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Stock Count */}
        {activeTab === "stock" && (
          <div className="overflow-x-auto">
            {summary.stockCount.items.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No physical stock items recorded for this closing sheet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                  <tr>
                    <th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3">Brand</th>
                    <th className="px-6 py-3 text-center">System Stock</th>
                    <th className="px-6 py-3 text-center">Physical Count</th>
                    <th className="px-6 py-3 text-center">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {summary.stockCount.items.map((item) => (
                    <tr key={item.productId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-6 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.productName}
                      </td>
                      <td className="px-6 py-3 text-zinc-500">{item.brand}</td>
                      <td className="px-6 py-3 text-center font-medium">{item.systemQuantity} crates</td>
                      <td className="px-6 py-3 text-center font-bold text-sm">{item.physicalQuantity} crates</td>
                      <td className="px-6 py-3 text-center">
                        {item.difference === 0 ? (
                          <span className="text-emerald-600 font-bold">✓ 0</span>
                        ) : item.difference > 0 ? (
                          <span className="text-blue-600 font-bold">+{item.difference}</span>
                        ) : (
                          <span className="text-red-600 font-bold">{item.difference}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 4: Audit Logs */}
        {activeTab === "audit" && (
          <div className="p-6 space-y-3">
            {summary.auditLogs.length === 0 ? (
              <div className="text-center text-xs text-zinc-500 py-4">
                No audit events recorded for this closing sheet yet.
              </div>
            ) : (
              <div className="space-y-2">
                {summary.auditLogs.map((log) => (
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
            )}
          </div>
        )}
      </div>

      {/* Reopen Session Modal (Owner only) */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Reopen Daily Closing Session
              </h3>
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="text-zinc-400 hover:text-zinc-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Reopening will transition this session back to <b>OPEN</b> status, allowing operational adjustments to be recorded. A mandatory audit explanation is required.
            </p>

            <form
              action={async (formData) => {
                await reopenAction(formData);
                setShowReopenModal(false);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="closingId" value={closing?.id} />

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Mandatory Reopen Reason *
                </label>
                <textarea
                  name="reason"
                  rows={3}
                  required
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Explain why this closed session is being reopened..."
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReopening || reopenReason.trim().length < 3}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition-colors cursor-pointer"
                >
                  {isReopening ? "Reopening..." : "Confirm Reopen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
