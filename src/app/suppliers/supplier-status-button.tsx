"use client";

import { useState, useTransition } from "react";
import { toggleSupplierStatusAction } from "./actions";

export function SupplierStatusButton({
  supplierId,
  isActive,
}: {
  supplierId: string;
  isActive: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const res = await toggleSupplierStatusAction(supplierId);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleToggle}
          disabled={isPending}
          title={isActive
            ? "Hide from new entries — click again to bring it back"
            : "Make selectable again in new entries"}
          className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
            isActive
              ? "border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100"
              : "border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
          }`}
        >
          {isActive ? "Deactivate" : "Activate"}
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

