"use client";

import { useState, useTransition } from "react";
import { toggleProductStatusAction } from "../actions";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function ProductStatusButton({
  productId,
  isActive,
}: {
  productId: string;
  isActive: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const res = await toggleProductStatusAction(productId);
      if (res?.error) {
        setError(res.error);
      }
      setModalOpen(false);
    });
  };

  return (
    <>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={isPending}
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

      <ConfirmModal
        isOpen={modalOpen}
        title={isActive ? "Deactivate Product" : "Activate Product"}
        description={
          isActive
            ? "Are you sure you want to deactivate this product? Deactivated products cannot be selected for new customer sales or receiving deliveries."
            : "Are you sure you want to reactivate this product? It will immediately become available for sales and receiving."
        }
        confirmLabel={isActive ? "Confirm Deactivate" : "Confirm Activate"}
        cancelLabel={isActive ? "Keep Active" : "Keep Inactive"}
        variant={isActive ? "danger" : "primary"}
        isPending={isPending}
        onConfirm={handleToggle}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
