"use client";

import { useState, useTransition } from "react";
import { toggleProductStatusAction } from "../actions";

export function ProductStatusButton({
  productId,
  isActive,
}: {
  productId: string;
  isActive: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const res = await toggleProductStatusAction(productId);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  return (
    <>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          title={isActive
            ? "Hide from new entries — click again to bring it back"
            : "Make selectable again in new entries"}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
            isActive
              ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
              : "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          }`}
        >
          {isActive ? "Deactivate Product" : "Activate Product"}
        </button>

        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    </>
  );
}
