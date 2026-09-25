"use client";

import { useState, useTransition } from "react";
import { toggleCustomerActiveAction } from "./actions";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function CustomerStatusButton({
  customerId,
  isActive,
}: {
  customerId: string;
  isActive: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    setError(null);
    startTransition(async () => {
      const res = await toggleCustomerActiveAction(customerId, !isActive);
      if (res?.error) {
        setError(res.error);
      }
      setModalOpen(false);
    });
  };

  return (
    <>
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={isPending}
          className={`btn btn-sm ${isActive ? "btn-danger" : "btn-good"}`}
        >
          {isActive ? "Stop Using" : "Use Again"}
        </button>

        {error ? (
          <span role="alert" className="text-sm font-bold text-stamp">
            {error}
          </span>
        ) : null}
      </span>

      <ConfirmModal
        isOpen={modalOpen}
        title={isActive ? "Stop using this customer?" : "Use this customer again?"}
        description={
          isActive
            ? "Their account will be hidden from the customer list and cannot be picked on new invoices. Their past invoices, balance and payments stay exactly as they are. You can bring the account back at any time."
            : "This account will be selectable on new invoices again, straight away. Nothing about their past invoices, balance or payments changes."
        }
        confirmLabel={isActive ? "Yes, stop using this customer" : "Yes, use this customer again"}
        cancelLabel={isActive ? "No, keep it active" : "No, leave it inactive"}
        variant={isActive ? "danger" : "primary"}
        isPending={isPending}
        onConfirm={handleToggle}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

