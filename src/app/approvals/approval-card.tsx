"use client";

import { useState, useActionState } from "react";
import { resolveAdjustmentAction, type StockCountActionState } from "@/app/stock-counts/actions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { IconCheck, IconClose } from "@/components/ui/icons";

interface ApprovalCardProps {
  adjustmentId: string;
  productName: string;
  productBrand: string;
  oldQuantity: number;
  newQuantity: number;
  difference: number;
  reason: string;
  requestedByName: string;
  createdAt: Date;
}

export function ApprovalCard({
  adjustmentId,
  productName,
  productBrand,
  oldQuantity,
  newQuantity,
  difference,
  reason,
  requestedByName,
  createdAt,
}: ApprovalCardProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<StockCountActionState, FormData>(
    resolveAdjustmentAction,
    null
  );
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [reason2, setReason2] = useState("");
  const isResolved = Boolean(state?.success);

  useEffect(() => {
    if (state?.success) {
      router.refresh();
    }
  }, [state?.success, router]);

  if (isResolved) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-emerald-700 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2">
        <IconCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>Adjustment for <strong>{productName}</strong> has been resolved.</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="font-bold text-zinc-900 dark:text-zinc-50">{productName}</div>
          <div className="text-xs text-zinc-500">{productBrand}</div>
        </div>
        <div className="text-xs text-zinc-500 text-right">
          Submitted by <span className="font-semibold text-zinc-700 dark:text-zinc-300">{requestedByName}</span>
          <br />
          {new Date(createdAt).toLocaleString()}
        </div>
      </div>

      {/* Adjustment details */}
      <div className="px-6 py-4 grid grid-cols-3 gap-4 text-center border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="text-xs text-zinc-500 mb-1">System Stock</div>
          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{oldQuantity}</div>
          <div className="text-xs text-zinc-400">crates</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-1">Physical Count</div>
          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{newQuantity}</div>
          <div className="text-xs text-zinc-400">crates</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-1">Difference</div>
          <div
            className={`text-xl font-bold ${
              difference > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : difference < 0
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-500"
            }`}
          >
            {difference > 0 ? "+" : ""}
            {difference}
          </div>
          <div className="text-xs text-zinc-400">crates</div>
        </div>
      </div>

      <div className="px-6 py-3 text-xs text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">
        <span className="font-semibold text-zinc-500">Reason: </span>
        {reason.replace(/\[Count:\s*[a-f0-9-]+\]\s*/i, "")}
      </div>

      {/* Error state */}
      {state?.error && (
        <div className="mx-6 my-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">
          {state.error}
        </div>
      )}

      {/* Decision form */}
      {!decision ? (
        <div className="px-6 py-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDecision("APPROVE")}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <IconCheck className="w-4 h-4" />
            <span>Approve</span>
          </button>
          <button
            type="button"
            onClick={() => setDecision("REJECT")}
            className="px-4 py-2 text-sm font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <IconClose className="w-4 h-4" />
            <span>Reject</span>
          </button>
        </div>
      ) : (
        <form action={formAction} className="px-6 py-4 space-y-3">
          <input type="hidden" name="adjustmentId" value={adjustmentId} />
          <input type="hidden" name="decision" value={decision} />

          <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            {decision === "APPROVE" ? (
              <>
                <IconCheck className="w-4 h-4 text-emerald-600" />
                <span>Approving adjustment — provide reason:</span>
              </>
            ) : (
              <>
                <IconClose className="w-4 h-4 text-red-600" />
                <span>Rejecting adjustment — provide reason:</span>
              </>
            )}
          </div>

          <input
            type="text"
            name="reason"
            value={reason2}
            onChange={(e) => setReason2(e.target.value)}
            placeholder="Enter reason (required, min 3 chars)"
            required
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending || reason2.trim().length < 3}
              className={`px-4 py-2 text-sm font-bold rounded-lg text-white disabled:opacity-50 transition-colors cursor-pointer ${
                decision === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isPending
                ? "Saving..."
                : decision === "APPROVE"
                ? "Confirm Approval"
                : "Confirm Rejection"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDecision(null);
                setReason2("");
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
