"use client";

import { useState, useTransition } from "react";
import { toggleSupplierStatusAction } from "./actions";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function SupplierStatusButton({
  supplierId,
  isActive,
}: {
  supplierId: string;
  isActive: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const res = await toggleSupplierStatusAction(supplierId);
      if (res?.error) {
        setError(res.error);
      }
      setModalOpen(false);
    });
  };

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={isPending}
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

      <ConfirmModal
        isOpen={modalOpen}
        title={isActive ? "Deactivate Supplier" : "Activate Supplier"}
        description={
          isActive
            ? "Are you sure you want to deactivate this supplier? Deactivated suppliers cannot be selected for new receiving deliveries."
            : "Are you sure you want to reactivate this supplier? They will immediately become available for receiving entries."
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

