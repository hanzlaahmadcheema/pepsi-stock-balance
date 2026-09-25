"use client";

import { useState } from "react";
import Link from "next/link";
import { DailyClosingStatus, AdjustmentStatus } from "@prisma/client";
import { AdjustmentModal } from "../adjustment-modal";
import type {
  StockCountDetails,
  PendingAdjustmentSummary,
} from "@/lib/stock-counts/service";
import { IconHistory, IconAlertTriangle, IconCheck, IconInfo } from "@/components/ui/icons";
import { isCloudPortal } from "@/lib/config/portal-mode";

export function CountDetailsClient({
  countDetails,
  isOwner,
}: {
  countDetails: StockCountDetails;
  isOwner: boolean;
}) {
  const isCloud = isCloudPortal();
  const [selectedAdjustment, setSelectedAdjustment] =
    useState<PendingAdjustmentSummary | null>(null);

  const isOpen = countDetails.status === DailyClosingStatus.OPEN;
  const isInReview = countDetails.status === DailyClosingStatus.IN_REVIEW;
  const isClosed = countDetails.status === DailyClosingStatus.CLOSED;

  const discrepancies = countDetails.items.filter((i) => i.difference !== 0);
  const pendingCount = countDetails.items.filter(
    (i) => i.adjustment?.status === AdjustmentStatus.PENDING
  ).length;

  return (
    <>
      {/* Navigation Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/stock-counts" className="hover:underline">
          ← Back to Stock Counts
        </Link>
        <span>/</span>
        <span>
          Count Session (
          {new Date(countDetails.businessDate).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
          )
        </span>
      </div>

      {/* Header Voucher Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
              Stock Count Sheet:{" "}
              {new Date(countDetails.businessDate).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                isOpen
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  : isInReview
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOpen ? "bg-blue-500" : isInReview ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                }`}
              />
              {countDetails.status.replace("_", " ")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-zinc-500">
            <div>
              Recorded By: <b className="text-zinc-800 dark:text-zinc-200">{countDetails.closedByName}</b>
            </div>
            <div>
              Inventory Status:{" "}
              <b className={countDetails.stockVerified ? "text-emerald-600" : "text-amber-600"}>
                {countDetails.stockVerified ? (
                  <span className="inline-flex items-center gap-1">
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>Verified &amp; Reconciled</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <IconAlertTriangle className="w-3.5 h-3.5" />
                    <span>Discrepancies Pending Review</span>
                  </span>
                )}
              </b>
            </div>
            {countDetails.closedAt && (
              <div>
                Closed On: <b>{new Date(countDetails.closedAt).toLocaleString()}</b>
              </div>
            )}
          </div>
        </div>

        {/* Action / Status Pill */}
        <div className="flex items-center gap-3">
          {isInReview && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <IconAlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                <strong className="font-bold">Discrepancies Detected:</strong> {pendingCount} adjustments{" "}
                awaiting resolution.
              </span>
            </div>
          )}
          {isClosed && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200 font-semibold flex items-center gap-1.5">
              <IconCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Stock count is finalized and closed.</span>
            </div>
          )}
        </div>
      </div>

      {/* Discrepancy & Approval Clarification Banner */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
          <IconInfo className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
              Your correction request has been submitted. Stock will change after approval.
            </h3>
            <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-1">
              There {pendingCount === 1 ? "is 1 discrepancy" : `are ${pendingCount} discrepancies`} between physical counts and system records. Warehouse stock remains unchanged until the Owner reviews and confirms the adjustments.
            </p>
          </div>
        </div>
      )}

      {/* Count Sheet Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-bold text-zinc-900 dark:text-zinc-50">
            Physical Count vs System Inventory
          </h2>
          <span className="text-xs text-zinc-500">
            {countDetails.items.length} products counted ({discrepancies.length} discrepancies)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3">Product Description</th>
                <th className="px-6 py-3 text-center">System Stock</th>
                <th className="px-6 py-3 text-center">Physical Count</th>
                <th className="px-6 py-3 text-center">Difference</th>
                <th className="px-6 py-3">Discrepancy Explanation</th>
                <th className="px-6 py-3 text-center">Adjustment Status</th>
                <th className="px-6 py-3 text-right">Owner Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {countDetails.items.map((item) => {
                const isDiff = item.difference !== 0;
                const isPositive = item.difference > 0;
                const adj = item.adjustment;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/30 ${
                      isDiff ? "bg-amber-50/20 dark:bg-amber-950/10" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">
                        {item.productName}
                      </div>
                      <div className="text-xs text-zinc-500">{item.productBrand}</div>
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-zinc-700 dark:text-zinc-300">
                      {item.systemQuantity} crates
                    </td>

                    <td className="px-6 py-4 text-center font-black text-base text-zinc-900 dark:text-zinc-100">
                      {item.physicalQuantity} crates
                    </td>

                    <td className="px-6 py-4 text-center">
                      {item.difference === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">
                          <IconCheck className="w-3 h-3" />
                          <span>Matched (0)</span>
                        </span>
                      ) : (
                        <span
                          className={`font-black text-xs px-2.5 py-1 rounded-full ${
                            isPositive
                              ? "text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50"
                              : "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50"
                          }`}
                        >
                          {isPositive ? `+${item.difference}` : item.difference} crates
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-400 max-w-xs">
                      {adj?.reason ? (
                        <div>
                          <span className="font-medium text-zinc-800 dark:text-zinc-200">
                            &ldquo;{adj.reason}&rdquo;
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">No discrepancy</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-center">
                      {adj ? (
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            adj.status === AdjustmentStatus.APPROVED
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : adj.status === AdjustmentStatus.REJECTED
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          }`}
                        >
                          {adj.status}
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">—</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {adj && adj.status === AdjustmentStatus.PENDING && !isCloud ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedAdjustment({
                              id: adj.id,
                              productId: item.productId,
                              productName: item.productName,
                              productBrand: item.productBrand,
                              oldQuantity: item.systemQuantity,
                              newQuantity: item.physicalQuantity,
                              difference: item.difference,
                              reason: adj.reason,
                              requestedByName: item.countedByName,
                              createdAt: item.countedAt,
                              closingId: countDetails.id,
                            })
                          }
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors cursor-pointer"
                        >
                          Decide
                        </button>
                      ) : adj?.approvedByName ? (
                        <div className="text-xs text-zinc-500">
                          {adj.status === AdjustmentStatus.APPROVED ? "Approved" : "Rejected"} by{" "}
                          <b>{adj.approvedByName}</b>
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs */}
      {countDetails.auditLogs.length > 0 && (
        <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <IconHistory className="w-4 h-4 text-zinc-500" />
            <span>Count Session Audit Trail</span>
          </h3>
          <div className="space-y-2">
            {countDetails.auditLogs.map((log) => (
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

      {selectedAdjustment && (
        <AdjustmentModal
          adjustment={selectedAdjustment}
          onClose={() => setSelectedAdjustment(null)}
        />
      )}
    </>
  );
}
