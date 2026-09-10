"use client";

import { useState } from "react";
import Link from "next/link";
import type { CustomerDetailData } from "@/lib/customers/service";
import { CustomerModal } from "../customer-modal";
import { CustomerStatusButton } from "../customer-status-button";

export function CustomerDetailActions({
  customer,
  isOwner,
}: {
  customer: CustomerDetailData;
  isOwner: boolean;
}) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        {customer.isActive && (
          <Link
            href={`/sales/new?customerId=${customer.id}`}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            + Create Sale
          </Link>
        )}

        {customer.outstandingBalance > 0 && (
          <Link
            href={`/customers/${customer.id}/payments`}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Record Payment
          </Link>
        )}

        {isOwner && (
          <>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              Edit Details
            </button>

            <CustomerStatusButton
              customerId={customer.id}
              isActive={customer.isActive}
            />
          </>
        )}
      </div>

      {isEditModalOpen && (
        <CustomerModal
          customerToEdit={customer}
          isOwner={isOwner}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </>
  );
}
