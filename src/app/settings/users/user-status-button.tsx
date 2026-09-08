"use client";

import { useState, useTransition } from "react";
import { toggleUserStatusAction } from "./actions";

export function UserStatusButton({
  userId,
  isActive,
  isOwner,
}: {
  userId: string;
  isActive: boolean;
  isOwner: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isOwner) {
    return (
      <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
        Protected Owner
      </span>
    );
  }

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const result = await toggleUserStatusAction(userId);
      if (result?.error) {
        setError(result.error);
      }
      setConfirming(false);
    });
  };

  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => setError(null)}
          className="underline hover:text-red-700 cursor-pointer"
        >
          Dismiss
        </button>
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="text-zinc-600 dark:text-zinc-400">
          {isActive ? "Deactivate?" : "Activate?"}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={handleToggle}
          className="px-2 py-0.5 rounded font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
        >
          {isPending ? "..." : "Yes"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => setConfirming(false)}
          className="px-2 py-0.5 rounded font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={isPending}
      className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
        isActive
          ? "bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 border border-red-200 dark:border-red-800"
          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
      }`}
    >
      {isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
