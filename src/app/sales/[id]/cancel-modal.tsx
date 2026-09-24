"use client";

import { useState, useActionState } from "react";
import { cancelSaleAction } from "../actions";
import { IconClose, IconAlertTriangle } from "@/components/ui/icons";

export function CancelSaleModal({
  saleId,
  invoiceNumber,
  onClose,
}: {
  saleId: string;
  invoiceNumber: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(cancelSaleAction, null);
  const [reason, setReason] = useState("");

  if (state?.success) {
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-red-600 dark:text-red-400">
            Cancel Invoice #{invoiceNumber}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        <form action={formAction} className="p-6 space-y-4">
          <input type="hidden" name="saleId" value={saleId} />

          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300">
            <p className="font-bold mb-1 flex items-center gap-1.5">
              <IconAlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>Warning: Invoice Cancellation</span>
            </p>
            <p>
              Cancelling this invoice will immediately:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Restore all sold crates back to on-hand inventory.</li>
              <li>Reverse customer credit balance effects.</li>
              <li>Mark invoice permanently as CANCELLED (cannot be undone).</li>
              <li>Record an immutable AuditLog entry with your name and timestamp.</li>
            </ul>
          </div>

          {state?.error && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
              {state.error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
              Mandatory Cancellation Reason *
            </label>
            <textarea
              name="reason"
              rows={3}
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide an explanation for cancelling this invoice (e.g. customer changed mind, duplicate bill, billing error)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer"
            >
              Keep Invoice
            </button>
            <button
              type="submit"
              disabled={isPending || reason.trim().length < 3}
              className="px-4 py-2 text-sm font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "Cancelling..." : "Confirm Cancellation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
