"use client";

import { useState } from "react";
import Link from "next/link";
import { DailyClosingStatus } from "@prisma/client";
import { AdjustmentModal } from "./adjustment-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { IconClipboardList } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import type {
  StockCountSessionSummary,
  PendingAdjustmentSummary,
} from "@/lib/stock-counts/service";

export function StockCountsClient({
  sessions,
  pendingAdjustments,
  isOwner,
}: {
  sessions: StockCountSessionSummary[];
  pendingAdjustments: PendingAdjustmentSummary[];
  isOwner: boolean;
}) {
  const [selectedAdjustment, setSelectedAdjustment] =
    useState<PendingAdjustmentSummary | null>(null);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Stock Counts & Adjustments
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Conduct physical inventory audits, track discrepancies, and process owner approvals.
          </p>
        </div>
        <Link
          href="/stock-counts/new"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          + New Stock Count
        </Link>
      </div>

      {/* Pending Owner Approvals Banner & Table */}
      {pendingAdjustments.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <h2 className="font-bold text-base text-amber-900 dark:text-amber-200">
                  Pending Owner Adjustments ({pendingAdjustments.length})
                </h2>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                  The following physical count discrepancies require exactly one Owner approval to update on-hand stock.
                </p>
              </div>
            </div>
            {isOwner && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold">
                Owner Action Required
              </span>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-amber-200 dark:border-amber-900/50 overflow-hidden">
            <ScrollableTable>
              <table className="w-full text-left text-xs">
                <thead className="bg-amber-50/50 dark:bg-zinc-800/60 font-semibold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider border-b border-amber-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-center">System Qty</th>
                    <th className="px-4 py-3 text-center">Counted Qty</th>
                    <th className="px-4 py-3 text-center">Discrepancy</th>
                    <th className="px-4 py-3">Staff Reason</th>
                    <th className="px-4 py-3">Requested By</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {pendingAdjustments.map((adj) => {
                    const isPositive = adj.difference > 0;

                    return (
                      <tr key={adj.id} className="hover:bg-amber-50/30 dark:hover:bg-zinc-800/30">
                        <td className="px-4 py-3">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">
                            {adj.productName}
                          </div>
                          <div className="text-zinc-500">{adj.productBrand}</div>
                          {isOwner && (
                            <div className="mt-2 lg:hidden">
                              <button
                                type="button"
                                onClick={() => setSelectedAdjustment(adj)}
                                className="px-2.5 py-1 text-xs rounded-md bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer transition-colors shadow-2xs"
                              >
                                Review &amp; Decide &rarr;
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-bold">{adj.oldQuantity}</td>
                        <td className="px-4 py-3 text-center font-bold">{adj.newQuantity}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`font-black px-2 py-0.5 rounded-full ${
                              isPositive
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            }`}
                          >
                            {isPositive ? `+${adj.difference}` : adj.difference} crates
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 max-w-xs truncate">
                          &ldquo;{adj.reason}&rdquo;
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{adj.requestedByName}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isOwner ? (
                            <button
                              type="button"
                              onClick={() => setSelectedAdjustment(adj)}
                              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer transition-colors"
                            >
                              Review &amp; Decide
                            </button>
                          ) : (
                            <span className="text-zinc-400 italic">Awaiting Owner</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollableTable>
          </div>
        </div>
      )}

      {/* Stock Count Sessions List */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-bold text-base text-zinc-900 dark:text-zinc-50">
            Stock Count Audit History
          </h2>
          <span className="text-xs text-zinc-500">{sessions.length} recorded sessions</span>
        </div>

        <ScrollableTable>
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3">Business Date</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">Products Counted</th>
                <th className="px-6 py-3 text-center">Discrepancies</th>
                <th className="px-6 py-3 text-center">Pending Adjustments</th>
                <th className="px-6 py-3">Recorded By</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <EmptyState
                      icon={<IconClipboardList className="w-8 h-8 text-zinc-400" />}
                      title="No stock count sessions recorded"
                      description="Conduct physical inventory counts by product and crate to detect discrepancies and request adjustments."
                      actionLabel="+ New Stock Count"
                      actionHref="/stock-counts/new"
                    />
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const isClosed = s.status === DailyClosingStatus.CLOSED;

                  return (
                    <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                      <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        <Link href={`/stock-counts/${s.id}`} className="hover:underline">
                          {new Date(s.businessDate).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </Link>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={s.status} />
                      </td>

                      <td className="px-6 py-4 text-center font-bold text-zinc-800 dark:text-zinc-200">
                        {s.totalProductsCounted}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {s.discrepanciesCount > 0 ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {s.discrepanciesCount}
                          </span>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        {s.pendingAdjustmentsCount > 0 ? (
                          <span className="font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-full text-xs">
                            {s.pendingAdjustmentsCount} pending
                          </span>
                        ) : isClosed ? (
                          <span className="text-emerald-600 text-xs font-semibold">✓ Verified</span>
                        ) : (
                          <span className="text-zinc-400 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-zinc-500">
                        <div>{s.closedByName}</div>
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <Link
                          href={`/stock-counts/${s.id}`}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View Count Sheet
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

      {selectedAdjustment && (
        <AdjustmentModal
          adjustment={selectedAdjustment}
          onClose={() => setSelectedAdjustment(null)}
        />
      )}
    </>
  );
}
