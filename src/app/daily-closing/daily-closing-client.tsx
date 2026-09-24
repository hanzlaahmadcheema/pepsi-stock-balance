"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DailyClosingStatus } from "@prisma/client";
import {
  DailyClosingListItem,
  DailyClosingSummary,
} from "@/lib/daily-closing/service";
import { openOrCreateDailyClosingAction } from "./actions";
import { formatCurrency } from "@/lib/formatters";
import { EmptyState } from "@/components/ui/empty-state";
import { IconCalendar, IconCheck, IconZap, IconAlertTriangle } from "@/components/ui/icons";
import { ScrollableTable } from "@/components/ui/scrollable-table";

interface DailyClosingClientProps {
  todaySummary: DailyClosingSummary;
  recentClosings: DailyClosingListItem[];
  isOwner: boolean;
  todayDateStr: string;
  unclosedPrevious?: {
    dateStr: string;
    status: DailyClosingStatus;
    id?: string;
  } | null;
}

export function DailyClosingClient({
  todaySummary,
  recentClosings,
  isOwner,
  todayDateStr,
  unclosedPrevious,
}: DailyClosingClientProps) {
  const router = useRouter();
  const [customDate, setCustomDate] = useState(todayDateStr);
  const [isOpeningCustomDate, setIsOpeningCustomDate] = useState(false);
  const [openingError, setOpeningError] = useState<string | null>(null);

  const todayClosing = todaySummary.closing;
  const todayStatus = todayClosing?.status || "NOT_INITIALIZED";
  const isOpen = todayStatus === DailyClosingStatus.OPEN;
  const isInReview = todayStatus === DailyClosingStatus.IN_REVIEW;
  const isClosed = todayStatus === DailyClosingStatus.CLOSED;

  const handleOpenDate = async (dateToOpen: string) => {
    try {
      setIsOpeningCustomDate(true);
      setOpeningError(null);
      const res = await openOrCreateDailyClosingAction(dateToOpen);
      router.push(`/daily-closing/${res.closingId}`);
    } catch (err: unknown) {
      setOpeningError(err instanceof Error ? err.message : "Failed to open date.");
      setIsOpeningCustomDate(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
            Daily Closing & Operational Reconciliation
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            End-of-day cash drawer balancing, sales reconciliation, and physical stock count signoff.
          </p>
        </div>

        {/* Date Selector Quick-Jump */}
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
          />
          <button
            type="button"
            onClick={() => handleOpenDate(customDate)}
            disabled={isOpeningCustomDate || !customDate}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            {isOpeningCustomDate ? "Opening..." : "Reconcile Date →"}
          </button>
        </div>
      </div>

      {openingError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 font-medium">
          {openingError}
        </div>
      )}

      {/* Previous Day Closing Required Notice */}
      {unclosedPrevious && !todayClosing && (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
              <IconAlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Previous Day Closing Required
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                The business day for <strong>{unclosedPrevious.dateStr}</strong> is still <strong>{unclosedPrevious.status.replace("_", " ")}</strong>. System policy requires all prior business days to be closed before opening today&apos;s operations.
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {unclosedPrevious.id ? (
              <Link
                href={`/daily-closing/${unclosedPrevious.id}`}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors inline-flex items-center gap-1.5"
              >
                <span>Go to {unclosedPrevious.dateStr} Closing Sheet →</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenDate(unclosedPrevious.dateStr)}
                disabled={isOpeningCustomDate}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Close {unclosedPrevious.dateStr} First →</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Featured Today's Business Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Today&apos;s Operations
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${
                  isClosed
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : isInReview
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : isOpen
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isClosed
                      ? "bg-emerald-500"
                      : isInReview
                      ? "bg-amber-500 animate-pulse"
                      : isOpen
                      ? "bg-blue-500"
                      : "bg-zinc-400"
                  }`}
                />
                {todayClosing ? todayClosing.status.replace("_", " ") : "NOT INITIALIZED"}
              </span>
            </div>

            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mt-1">
              {new Date(todaySummary.businessDateObj).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {todayClosing ? (
              <Link
                href={`/daily-closing/${todayClosing.id}`}
                className="px-4 py-2 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
              >
                View Closing Sheet →
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenDate(todayDateStr)}
                disabled={isOpeningCustomDate || Boolean(unclosedPrevious)}
                title={unclosedPrevious ? `Close ${unclosedPrevious.dateStr} first` : undefined}
                className="px-4 py-2 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {isOpeningCustomDate
                  ? "Initializing..."
                  : unclosedPrevious
                  ? `Close ${unclosedPrevious.dateStr} First`
                  : "Start Today's Closing →"}
              </button>
            )}
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Sales Card */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/80 space-y-1">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Completed Sales
            </span>
            <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
              {formatCurrency(todaySummary.sales.totalRevenue)}
            </div>
            <div className="text-xs text-zinc-500">
              {todaySummary.sales.completedSalesCount} completed invoice
              {todaySummary.sales.completedSalesCount === 1 ? "" : "s"}
              {todaySummary.sales.cancelledSalesCount > 0 && (
                <span className="text-red-500 ml-1">
                  ({todaySummary.sales.cancelledSalesCount} cancelled)
                </span>
              )}
            </div>
          </div>

          {/* Collections Card */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/80 space-y-1">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Payments Collected
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(todaySummary.payments.totalPaymentsCollected)}
            </div>
            <div className="text-xs text-zinc-500 flex items-center justify-between">
              <span>Cash: {formatCurrency(todaySummary.payments.totalCashCollected)}</span>
              <span>Digital: {formatCurrency(todaySummary.payments.totalDigitalPayments)}</span>
            </div>
          </div>

          {/* Credit Card */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/80 space-y-1">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Credit Extended
            </span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {formatCurrency(todaySummary.sales.totalCreditSales)}
            </div>
            <div className="text-xs text-zinc-500">
              Account-level payments: {formatCurrency(todaySummary.payments.accountPaymentsTotal)}
            </div>
          </div>

          {/* Stock Count Card */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800/80 space-y-1">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Physical Stock Count
            </span>
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  todaySummary.stockCount.status === "ready" ||
                  todaySummary.stockCount.status === "completed"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : todaySummary.stockCount.status === "pending_adjustments"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : todaySummary.stockCount.status === "in_progress"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {todaySummary.stockCount.status.replace("_", " ").toUpperCase()}
              </span>
            </div>
            <div className="text-xs text-zinc-500 pt-1">
              {todaySummary.stockCount.totalProductsCounted > 0 ? (
                <span>
                  {todaySummary.stockCount.totalProductsCounted} products counted (
                  {todaySummary.stockCount.discrepanciesCount} discrepanc
                  {todaySummary.stockCount.discrepanciesCount === 1 ? "y" : "ies"})
                </span>
              ) : (
                <span>Not counted yet today</span>
              )}
            </div>
          </div>
        </div>

        {/* Readiness Alert Banner */}
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-4 ${
            isClosed
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200"
              : todaySummary.readiness.isReadyToClose
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 text-blue-900 dark:text-blue-200"
              : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="shrink-0">
              {isClosed ? (
                <IconCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : todaySummary.readiness.isReadyToClose ? (
                <IconZap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <IconAlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              )}
            </span>
            <div>
              <span className="font-bold">
                {isClosed
                  ? "Business Day Finalized"
                  : todaySummary.readiness.isReadyToClose
                  ? "Ready for Final Close"
                  : "Closing Incomplete"}
                :
              </span>{" "}
              {isClosed ? (
                <span>
                  Closed on {new Date(todayClosing!.closedAt!).toLocaleString()} by{" "}
                  <b>{todayClosing!.closedByName}</b>.
                </span>
              ) : todaySummary.readiness.isReadyToClose ? (
                <span>
                  Stock count verified and discrepancies reconciled. {isOwner ? "You can finalize the day." : "Awaiting Owner signoff."}
                </span>
              ) : (
                <span>{todaySummary.readiness.blockingReasons.join(" ")}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {todaySummary.stockCount.status === "not_started" && (
              <Link
                href="/stock-counts/new"
                className="font-bold underline hover:no-underline text-amber-800 dark:text-amber-300"
              >
                Perform Stock Count →
              </Link>
            )}
            {todaySummary.stockCount.status === "pending_adjustments" && (
              <Link
                href="/stock-counts"
                className="font-bold underline hover:no-underline text-amber-800 dark:text-amber-300"
              >
                Review Discrepancies →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Historical Daily Closings Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-50">
            Closing Audit History
          </h2>
          <span className="text-xs text-zinc-500">
            Past {recentClosings.length} recorded session{recentClosings.length === 1 ? "" : "s"}
          </span>
        </div>

        {recentClosings.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={<IconCalendar className="w-8 h-8 text-zinc-400" />}
              title="No daily closing sessions recorded yet"
              description="Daily closing reconciles physical cash collected against sales invoices, verifies stock counts, and records official business day sign-offs."
            />
          </div>
        ) : (
          <ScrollableTable>
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 lg:px-6 py-3">Business Date</th>
                  <th className="px-4 lg:px-6 py-3 text-center">Status</th>
                  <th className="px-4 lg:px-6 py-3 text-right">Total Revenue</th>
                  <th className="px-4 lg:px-6 py-3 text-right">Cash Expected</th>
                  <th className="px-4 lg:px-6 py-3 text-right">Physical Cash</th>
                  <th className="px-4 lg:px-6 py-3 text-center">Cash Variance</th>
                  <th className="px-4 lg:px-6 py-3 text-center">Stock Count</th>
                  <th className="px-4 lg:px-6 py-3">Sign-off</th>
                  <th className="px-4 lg:px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {recentClosings.map((c) => {
                  const isSessClosed = c.status === DailyClosingStatus.CLOSED;
                  const isSessInReview = c.status === DailyClosingStatus.IN_REVIEW;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-4 lg:px-6 py-4 font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        <Link
                          href={`/daily-closing/${c.id}`}
                          className="hover:underline hover:text-blue-600 dark:hover:text-blue-400 block"
                        >
                          <div>
                            {new Date(c.businessDateObj).toLocaleDateString(undefined, {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 lg:hidden inline-block mt-0.5">
                            Reconcile &rarr;
                          </span>
                        </Link>
                      </td>

                      <td className="px-4 lg:px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isSessClosed
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isSessInReview
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSessClosed
                                ? "bg-emerald-500"
                                : isSessInReview
                                ? "bg-amber-500 animate-pulse"
                                : "bg-blue-500"
                            }`}
                          />
                          {c.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="px-4 lg:px-6 py-4 text-right font-semibold text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(c.totalSales)}
                      </td>

                      <td className="px-4 lg:px-6 py-4 text-right font-medium text-zinc-600 dark:text-zinc-400">
                        {formatCurrency(c.totalCashExpected)}
                      </td>

                      <td className="px-4 lg:px-6 py-4 text-right font-bold text-zinc-800 dark:text-zinc-200">
                        {formatCurrency(c.physicalCash)}
                      </td>

                      <td className="px-4 lg:px-6 py-4 text-center">
                        {c.cashDifference === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                            <IconCheck className="w-3 h-3" />
                            <span>{formatCurrency(0)}</span>
                          </span>
                        ) : c.cashDifference > 0 ? (
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full">
                            +{formatCurrency(c.cashDifference)}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full">
                            -{formatCurrency(Math.abs(c.cashDifference))}
                          </span>
                        )}
                      </td>

                      <td className="px-4 lg:px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold ${
                            c.stockVerified
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : c.stockCountStatus === "pending_adjustments"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {c.stockVerified ? (
                            <>
                              <IconCheck className="w-3 h-3" />
                              <span>Verified</span>
                            </>
                          ) : (
                            c.stockCountStatus.replace("_", " ")
                          )}
                        </span>
                      </td>

                      <td className="px-4 lg:px-6 py-4 text-xs text-zinc-500 whitespace-nowrap">
                        <div>
                          By: <b className="text-zinc-800 dark:text-zinc-200">{c.closedByName}</b>
                        </div>
                        {c.closedAt && (
                          <div className="text-[11px] text-zinc-400">
                            {new Date(c.closedAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        )}
                      </td>

                      <td className="px-4 lg:px-6 py-4 text-right whitespace-nowrap">
                        <Link
                          href={`/daily-closing/${c.id}`}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                        >
                          Reconcile →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollableTable>
        )}
      </div>
    </div>
  );
}
