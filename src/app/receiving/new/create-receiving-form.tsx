"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { createReceivingAction } from "../actions";
import { formatCurrency, formatCrates } from "@/lib/formatters";
import { CrateStepper } from "@/components/ui/crate-stepper";
import { IconPlus, IconTrash, IconTruck, IconCheckCircle } from "@/components/ui/icons";

type ProductOption = {
  id: string;
  name: string;
  brand: string;
  latestPurchasePrice: string;
};

type SupplierOption = {
  id: string;
  name: string;
};

type ItemRow = {
  key: string;
  productId: string;
  quantity: number;
  purchasePrice: string;
};

export function CreateReceivingForm({
  suppliers,
  products,
}: {
  suppliers: SupplierOption[];
  products: ProductOption[];
}) {
  const [items, setItems] = useState<ItemRow[]>([
    {
      key: "initial-1",
      productId: products[0]?.id || "",
      quantity: 10,
      purchasePrice: products[0]?.latestPurchasePrice || "0.00",
    },
  ]);
  const [state, formAction, isPending] = useActionState(createReceivingAction, null);
  const [clientError, setClientError] = useState<string | null>(null);
  // Posting straight to the ledger is the normal case; drafting is the exception.
  const [postImmediately, setPostImmediately] = useState(true);

  const newRowSelectRef = useRef<HTMLSelectElement>(null);
  const focusNewRowRef = useRef(false);

  const addItemRow = (focusIt = false) => {
    setClientError(null);
    const unselected = products.find((p) => !items.some((i) => i.productId === p.id));
    const prodToUse = unselected || products[0];

    setItems((prev) => [
      ...prev,
      {
        key: `item-${Date.now()}-${Math.random()}`,
        productId: prodToUse?.id || "",
        quantity: 10,
        purchasePrice: prodToUse?.latestPurchasePrice || "0.00",
      },
    ]);
    if (focusIt) focusNewRowRef.current = true;
  };

  // Enter in a cost box drops straight into the next line, like a spreadsheet.
  useEffect(() => {
    if (!focusNewRowRef.current) return;
    focusNewRowRef.current = false;
    newRowSelectRef.current?.focus();
  }, [items]);

  const removeItemRow = (index: number) => {
    if (items.length <= 1) {
      setClientError("Receiving must include at least one product line item.");
      return;
    }
    setClientError(null);
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateItemRow = (index: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };

      if (field === "productId") {
        const selectedProd = products.find((p) => p.id === value);
        if (selectedProd) {
          copy[index].purchasePrice = selectedProd.latestPurchasePrice || "0.00";
        }
      }
      return copy;
    });
  };

  // Calculated totals
  const totalCrates = items.reduce((acc, it) => acc + (it.quantity || 0), 0);
  const totalCost = items.reduce((acc, it) => {
    const q = it.quantity || 0;
    const p = parseFloat(it.purchasePrice) || 0;
    return acc + q * p;
  }, 0);

  const itemsJson = JSON.stringify(
    items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity || 0,
      purchasePrice: parseFloat(it.purchasePrice) || 0,
    }))
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (items.length === 0) {
      e.preventDefault();
      setClientError("Please add at least one product to receive.");
      return;
    }
    for (const it of items) {
      if (!it.productId) {
        e.preventDefault();
        setClientError("Please choose a valid product for all rows.");
        return;
      }
      if (it.quantity <= 0) {
        e.preventDefault();
        setClientError("All crate quantities must be at least 1.");
        return;
      }
    }
    setClientError(null);
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} className="w-full">
      <input type="hidden" name="items" value={itemsJson} />
      <input type="hidden" name="postImmediately" value={postImmediately ? "true" : "false"} />

      {/* Accessible Inline Error Banner */}
      {(clientError || state?.error) && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm font-medium flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">Error:</span>
            <span>{clientError || state?.error}</span>
          </div>
          <button
            type="button"
            onClick={() => setClientError(null)}
            className="text-xs font-semibold px-2.5 py-1 rounded bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800 text-red-800 dark:text-red-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SINGLE UNIFIED FORM CARD */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-8">
        {/* Delivery Details Fields Grid */}
        <div className="space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <IconTruck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Delivery & Supplier Information</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Enter the supplier and reference details from the delivery challan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="supplierId"
                className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                Supplier *
              </label>
              <select
                id="supplierId"
                name="supplierId"
                autoFocus
                required
                className="w-full px-3 py-2.5 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="receivedAt"
                className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                Received Date *
              </label>
              <input
                id="receivedAt"
                name="receivedAt"
                type="date"
                required
                defaultValue={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="referenceNumber"
                className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                Challan / Invoice #
              </label>
              <input
                id="referenceNumber"
                name="referenceNumber"
                type="text"
                placeholder="e.g. DC-98421"
                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                Truck / Driver Info (Optional)
              </label>
              <input
                id="notes"
                name="notes"
                type="text"
                placeholder="e.g. Truck # LHR-4501, Driver: Naveed"
                className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Received Products Line Items Table */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Received Full Crates
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Add each product delivered and the purchase cost per crate.
              </p>
            </div>

            <button
              type="button"
              onClick={() => addItemRow()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900/80 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <IconPlus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Add Another Product</span>
              <kbd className="px-1.5 py-0.5 font-mono text-[11px] font-bold bg-white dark:bg-zinc-800 border border-blue-200 dark:border-blue-900 rounded">
                Enter
              </kbd>
            </button>
          </div>

          <div className="space-y-3">
            {items.map((row, idx) => {
              const lineTotal = (row.quantity || 0) * (parseFloat(row.purchasePrice) || 0);

              return (
                <div
                  key={row.key}
                  className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center gap-4 text-sm"
                >
                  {/* Row Index */}
                  <span className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* Product Dropdown */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs uppercase font-bold text-zinc-400 mb-1">
                      Product
                    </label>
                    <select
                      ref={idx === items.length - 1 ? newRowSelectRef : undefined}
                      value={row.productId}
                      onChange={(e) => updateItemRow(idx, "productId", e.target.value)}
                      className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.brand})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="w-44">
                    <label className="block text-xs uppercase font-bold text-zinc-400 mb-1">
                      Quantity (Crates)
                    </label>
                    <CrateStepper
                      defaultValue={row.quantity}
                      min={1}
                      onChange={(val) => updateItemRow(idx, "quantity", val)}
                      ariaLabel={`Crates for row ${idx + 1}`}
                    />
                  </div>

                  {/* Purchase Cost */}
                  <div className="w-36">
                    <label className="block text-xs uppercase font-bold text-zinc-400 mb-1">
                      Cost / Crate (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.purchasePrice}
                      onChange={(e) => updateItemRow(idx, "purchasePrice", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        // On the final line Enter finishes the delivery instead.
                        if (idx === items.length - 1) {
                          e.currentTarget.form?.requestSubmit();
                        } else {
                          addItemRow(true);
                        }
                      }}
                      title={
                        idx === items.length - 1
                          ? "Enter to post this delivery"
                          : "Enter to add another product line"
                      }
                      className="w-full px-3 py-2 text-sm font-bold text-right rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 tabular-nums focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Line Total */}
                  <div className="w-36 text-right">
                    <span className="block text-xs uppercase font-bold text-zinc-400 mb-1">
                      Line Total
                    </span>
                    <span className="text-base font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {formatCurrency(lineTotal)}
                    </span>
                  </div>

                  {/* Remove Row */}
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="p-2 text-zinc-400 hover:text-red-600 dark:hover:text-red-400 self-end lg:self-center transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Summary Bar & Submit Button */}
        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="p-3 px-5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750">
              <span className="text-xs uppercase tracking-wider font-bold text-zinc-400 block">
                Total Crates
              </span>
              <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
                {formatCrates(totalCrates)}
              </span>
            </div>

            <div className="p-3 px-5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50">
              <span className="text-xs uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 block">
                Total Purchase Cost
              </span>
              <span className="text-xl font-black text-blue-800 dark:text-blue-300 tabular-nums">
                {formatCurrency(totalCost)}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-3">
            <fieldset className="flex items-center gap-1 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60">
              <legend className="sr-only">How should this delivery be recorded?</legend>
              <button
                type="button"
                onClick={() => setPostImmediately(true)}
                aria-pressed={postImmediately}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  postImmediately
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700"
                }`}
              >
                Post to Stock Now
              </button>
              <button
                type="button"
                onClick={() => setPostImmediately(false)}
                aria-pressed={!postImmediately}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  postImmediately
                    ? "text-zinc-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-zinc-700"
                    : "bg-zinc-700 text-white shadow-sm"
                }`}
              >
                Save as Draft
              </button>
            </fieldset>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 sm:text-right max-w-xs">
              {postImmediately
                ? "Adds crates to the stock ledger straight away."
                : "Held as a draft — you review it and post to the ledger afterwards."}
            </p>

            <div className="flex items-center gap-3">
              <Link
                href="/receiving"
                className="px-5 py-3 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                Cancel
              </Link>

            <button
              type="submit"
              disabled={isPending}
              title={postImmediately
                ? "Post this delivery straight to the stock ledger (Enter)"
                : "Save as a draft to review and post later (Enter)"}
              className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:active:scale-100 disabled:opacity-50 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Posting to Stock Ledger...</span>
                </>
              ) : postImmediately ? (
                <>
                  <IconCheckCircle className="w-4 h-4" />
                  <span>Receive &amp; Post to Stock</span>
                  <kbd className="px-1.5 py-0.5 font-mono text-[11px] font-bold bg-white/20 border border-white/40 rounded">
                    Enter
                  </kbd>
                </>
              ) : (
                <>
                  <IconCheckCircle className="w-4 h-4" />
                  <span>Save as Draft</span>
                  <kbd className="px-1.5 py-0.5 font-mono text-[11px] font-bold bg-white/20 border border-white/40 rounded">
                    Enter
                  </kbd>
                </>
              )}
            </button>
          </div>
          </div>
        </div>
      </div>
    </form>
  );
}
