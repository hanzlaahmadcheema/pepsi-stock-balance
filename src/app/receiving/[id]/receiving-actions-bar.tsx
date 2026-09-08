"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postReceivingAction, deleteReceivingAction } from "../actions";

export function ReceivingActionsBar({
  receivingId,
  isPosted,
}: {
  receivingId: string;
  isPosted: boolean;
}) {
  const router = useRouter();
  const [confirmAction, setConfirmAction] = useState<"post" | "delete" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isPosted) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Posted to Stock Ledger (Permanent)
      </div>
    );
  }

  const executePost = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await postReceivingAction(receivingId);
      if (res?.error) {
        setErrorMessage(res.error);
        setConfirmAction(null);
      } else {
        setConfirmAction(null);
        router.refresh();
      }
    });
  };

  const executeDelete = () => {
    setErrorMessage(null);
    startTransition(async () => {
      const res = await deleteReceivingAction(receivingId);
      if (res?.error) {
        setErrorMessage(res.error);
        setConfirmAction(null);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {errorMessage && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-3 py-1 rounded border border-red-200 dark:border-red-800">
          {errorMessage}
        </div>
      )}

      {confirmAction === "post" && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg text-xs">
          <span className="text-amber-800 dark:text-amber-200 font-medium">
            Post to stock ledger permanently?
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={executePost}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Posting..." : "Yes, Post"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmAction(null)}
            className="px-2.5 py-1 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {confirmAction === "delete" && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-lg text-xs">
          <span className="text-red-800 dark:text-red-200 font-medium">
            Delete this draft delivery?
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={executeDelete}
            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-semibold disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Deleting..." : "Yes, Delete"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmAction(null)}
            className="px-2.5 py-1 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {confirmAction === null && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmAction("delete")}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Delete Draft
          </button>

          <button
            type="button"
            onClick={() => setConfirmAction("post")}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs focus:ring-2 focus:ring-emerald-500 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Post to Stock Ledger
          </button>
        </div>
      )}
    </div>
  );
}
