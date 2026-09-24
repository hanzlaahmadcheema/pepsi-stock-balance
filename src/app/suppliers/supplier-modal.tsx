"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createSupplierAction, updateSupplierAction } from "./actions";
import { SupplierStatusButton } from "./supplier-status-button";
import type { SupplierData } from "@/lib/suppliers/service";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTruck, IconClose } from "@/components/ui/icons";

export function SupplierModal({
  supplierToEdit,
  onClose,
}: {
  supplierToEdit?: SupplierData | null;
  onClose: () => void;
}) {
  const isEditing = Boolean(supplierToEdit);
  const actionToUse = isEditing ? updateSupplierAction : createSupplierAction;
  const [state, formAction, isPending] = useActionState(actionToUse, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(() => {
        onClose();
      }, 1200);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {isEditing ? "Edit Supplier" : "Add New Supplier"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        <form ref={formRef} action={formAction} className="space-y-4">
          {supplierToEdit && <input type="hidden" name="id" value={supplierToEdit.id} />}

          {state?.error && (
            <div className="p-3 text-sm rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
              {state.error}
            </div>
          )}

          {state?.success && (
            <div className="p-3 text-sm rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">
              {state.message}
            </div>
          )}

          <div>
            <label
              htmlFor="supplier-name"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Supplier / Company Name *
            </label>
            <input
              id="supplier-name"
              name="name"
              type="text"
              required
              defaultValue={supplierToEdit?.name || ""}
              placeholder="e.g. PepsiCo Bottling Co."
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="supplier-contact"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Contact Person
            </label>
            <input
              id="supplier-contact"
              name="contactPerson"
              type="text"
              defaultValue={supplierToEdit?.contactPerson || ""}
              placeholder="e.g. Faisal Malik"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="supplier-phone"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Phone Number
            </label>
            <input
              id="supplier-phone"
              name="phone"
              type="text"
              defaultValue={supplierToEdit?.phone || ""}
              placeholder="e.g. 0300-1234567"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="supplier-address"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Address / Depot
            </label>
            <textarea
              id="supplier-address"
              name="address"
              rows={2}
              defaultValue={supplierToEdit?.address || ""}
              placeholder="e.g. Industrial Estate Plant 2"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {isPending ? "Saving..." : isEditing ? "Update Supplier" : "Create Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SupplierListWrapper({ suppliers }: { suppliers: SupplierData[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierData | null>(null);

  const handleCreate = () => {
    setEditingSupplier(null);
    setModalOpen(true);
  };

  const handleEdit = (supplier: SupplierData) => {
    setEditingSupplier(supplier);
    setModalOpen(true);
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Beverage bottling plants, distributors, and authorized product sources.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Supplier
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th scope="col" className="px-6 py-3">Supplier Name</th>
                <th scope="col" className="px-6 py-3">Contact Person</th>
                <th scope="col" className="px-6 py-3">Phone</th>
                <th scope="col" className="px-6 py-3">Address</th>
                <th scope="col" className="px-6 py-3">Deliveries</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12">
                    <EmptyState
                      icon={<IconTruck className="w-8 h-8 text-zinc-400" />}
                      title="No beverage suppliers registered"
                      description="Register beverage suppliers and bottling plants to receive inventory deliveries."
                    />
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-zinc-900 dark:text-zinc-100">
                      {s.name}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                      {s.contactPerson || "—"}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                      {s.phone || "—"}
                    </td>
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 text-xs max-w-xs truncate">
                      {s.address || "—"}
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-700 dark:text-zinc-300">
                      {s.receivingsCount}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          s.isActive
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            s.isActive ? "bg-emerald-500" : "bg-zinc-400"
                          }`}
                        />
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleEdit(s)}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                      <SupplierStatusButton supplierId={s.id} isActive={s.isActive} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <SupplierModal
          supplierToEdit={editingSupplier}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
