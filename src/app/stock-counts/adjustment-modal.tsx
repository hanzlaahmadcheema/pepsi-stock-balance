"use client";

import { useState, useActionState } from "react";
import { resolveAdjustmentAction } from "./actions";
import type { PendingAdjustmentSummary } from "@/lib/stock-counts/service";

export function AdjustmentModal({
  adjustment,
  onClose,
}: {
  adjustment: PendingAdjustmentSummary;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(resolveAdjustmentAction, null);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [reason, setReason] = useState("");

  if (state?.success) {
    onClose();
  }

  const isPositive = adjustment.difference > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900 dark:text-zinc-50">
            Owner Review: Stock Discrepancy
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="p-6 space-y-4">
          <input type="hidden" name="adjustmentId" value={adjustment.id} />
          <input type="hidden" name="decision" value={decision} />

          {state?.error && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
              {state.error}
            </div>
          )}

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700/50 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">Product:</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                {adjustment.productName} ({adjustment.productBrand})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Counted By:</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {adjustment.requestedByName}
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-zinc-200 dark:border-zinc-700 pt-2">
              <span className="text-zinc-500">Count vs System:</span>
              <span>
                Count: <b>{adjustment.newQuantity}</b> | System: <b>{adjustment.oldQuantity}</b>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Discrepancy:</span>
              <span
                className={`font-black text-sm ${
                  isPositive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {isPositive ? `+${adjustment.difference}` : adjustment.difference} crates{" "}
                {isPositive ? "(Surplus)" : "(Shortage)"}
              </span>
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2">
              <span className="text-zinc-500">Staff Reason:</span>
              <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                &ldquo;{adjustment.reason}&rdquo;
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1.5">
              Owner Decision *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDecision("APPROVE")}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  decision === "APPROVE"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                ✅ APPROVE ADJUSTMENT
              </button>
              <button
                type="button"
                onClick={() => setDecision("REJECT")}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  decision === "REJECT"
                    ? "bg-red-600 text-white border-red-600"
                    : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                ❌ REJECT ADJUSTMENT
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {decision === "APPROVE"
                ? `Approving will atomically create a StockMovement (${
                    isPositive ? "ADJUSTMENT_ADD" : "ADJUSTMENT_SUB"
                  }) to update on-hand stock.`
                : "Rejecting will record the rejection and make no changes to inventory."}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
              Decision Explanation / Remarks *
            </label>
            <textarea
              name="reason"
              rows={2}
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Verified physical crates in cold storage / Discrepancy explained by delivery slip"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || reason.trim().length < 3}
              className={`px-5 py-2 text-sm font-bold rounded-lg text-white disabled:opacity-50 cursor-pointer transition-colors ${
                decision === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isPending
                ? "Processing..."
                : decision === "APPROVE"
                ? "Confirm Approval"
                : "Confirm Rejection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
