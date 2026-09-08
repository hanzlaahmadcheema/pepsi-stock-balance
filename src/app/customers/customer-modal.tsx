"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import Link from "next/link";
import { PriceTier } from "@prisma/client";
import { createCustomerAction, updateCustomerAction } from "./actions";
import { CustomerStatusButton } from "./customer-status-button";
import type { CustomerSummary } from "@/lib/customers/service";
import { formatCurrency } from "@/lib/formatters";
import { EmptyState } from "@/components/ui/empty-state";
import { IconUsers } from "@/components/ui/icons";
import { ScrollableTable } from "@/components/ui/scrollable-table";

export function CustomerModal({
  customerToEdit,
  onClose,
}: {
  customerToEdit?: CustomerSummary | null;
  isOwner?: boolean;
  onClose: () => void;
}) {
  const isEditing = Boolean(customerToEdit);
  const actionToUse = isEditing ? updateCustomerAction : createCustomerAction;
  const [state, formAction, isPending] = useActionState(actionToUse, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        onClose();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [state?.success, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPending, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
            {isEditing ? "Edit Customer" : "Register New Customer"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <form ref={formRef} action={formAction} className="p-6 space-y-4">
          {isEditing && (
            <input type="hidden" name="id" value={customerToEdit?.id} />
          )}

          {state?.error && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="p-3 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">
              Customer saved successfully!
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
              Customer Name *
            </label>
            <input
              type="text"
              name="name"
              defaultValue={customerToEdit?.name || ""}
              required
              placeholder="e.g. Al-Madina Store / John Doe"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              name="phone"
              defaultValue={customerToEdit?.phone || ""}
              placeholder="e.g. +92 300 1234567"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
              Address / Shop Location
            </label>
            <input
              type="text"
              name="address"
              defaultValue={customerToEdit?.address || ""}
              placeholder="e.g. Main Market, Shop #4"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
              Price Tier
            </label>
            <select
              name="priceTier"
              defaultValue={customerToEdit?.priceTier || PriceTier.RETAIL}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={PriceTier.RETAIL}>RETAIL</option>
              <option value={PriceTier.WHOLESALE}>WHOLESALE</option>
              <option value={PriceTier.KEY_ACCOUNT}>KEY ACCOUNT</option>
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="creditAllowed"
              name="creditAllowed"
              defaultChecked={customerToEdit?.creditAllowed ?? false}
              className="w-4 h-4 text-blue-600 rounded border-zinc-300 dark:border-zinc-700 focus:ring-blue-500"
            />
            <label
              htmlFor="creditAllowed"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100 cursor-pointer"
            >
              Allow Credit Purchases
            </label>
          </div>
          <p className="text-xs text-zinc-500">
            If checked, this customer can make sales on credit (unpaid or partially paid balance).
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors focus:outline-hidden focus:ring-2 focus:ring-zinc-400 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:active:scale-100 transition-all cursor-pointer"
            >
              {isPending && (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CustomerListWrapper({
  customers,
  isOwner,
}: {
  customers: CustomerSummary[];
  isOwner: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerSummary | null>(null);

  const handleCreate = () => {
    setEditingCustomer(null);
    setModalOpen(true);
  };

  const handleEdit = (customer: CustomerSummary) => {
    setEditingCustomer(customer);
    setModalOpen(true);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Customers & Credit
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage customer accounts, track credit balances, and process lump-sum payments.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors cursor-pointer"
        >
          + Add Customer
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <ScrollableTable>
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Phone & Address</th>
                <th className="px-6 py-3">Tier</th>
                <th className="px-6 py-3">Credit</th>
                <th className="px-6 py-3 text-right">Outstanding Balance</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <EmptyState
                      icon={<IconUsers className="w-8 h-8 text-zinc-400" />}
                      title="No customers registered"
                      description="Register commercial customers, shops, and restaurants to manage credit limits and returnable container balances."
                    />
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="px-6 py-4">
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      <div>{c.phone || "—"}</div>
                      <div className="text-zinc-400">{c.address || ""}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                        {c.priceTier}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
                          c.creditAllowed
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {c.creditAllowed ? "Allowed" : "No Credit"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums">
                      {c.outstandingBalance > 0 ? (
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {formatCurrency(c.outstandingBalance)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">{formatCurrency(0)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          c.isActive
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.isActive ? "bg-emerald-500" : "bg-zinc-400"
                          }`}
                        />
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <Link
                        href={`/customers/${c.id}`}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Ledger
                      </Link>
                      {c.outstandingBalance > 0 && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-700">|</span>
                          <Link
                            href={`/customers/${c.id}/payments`}
                            className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Pay
                          </Link>
                        </>
                      )}
                      {isOwner && (
                        <>
                          <span className="text-zinc-300 dark:text-zinc-700">|</span>
                          <button
                            type="button"
                            onClick={() => handleEdit(c)}
                            className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <span className="text-zinc-300 dark:text-zinc-700">|</span>
                          <CustomerStatusButton customerId={c.id} isActive={c.isActive} />
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollableTable>
      </div>

      {modalOpen && (
        <CustomerModal
          customerToEdit={editingCustomer}
          isOwner={isOwner}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
