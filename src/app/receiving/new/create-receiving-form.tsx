"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { createReceivingAction } from "../actions";
import { formatCurrency, formatCrates } from "@/lib/formatters";
import { CrateStepper } from "@/components/ui/crate-stepper";

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

  const addItemRow = () => {
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
  };

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

      // If user changed product, automatically suggest the product's latest purchase price
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
    const validItems = items.filter((i) => Boolean(i.productId));
    if (validItems.length === 0) {
      e.preventDefault();
      setClientError("Please select at least one product.");
      return;
    }

    const seenProds = new Set<string>();
    for (const it of validItems) {
      if (seenProds.has(it.productId)) {
        e.preventDefault();
        setClientError("Duplicate products detected in line items. Please combine them into a single line.");
        return;
      }
      seenProds.add(it.productId);

      if (it.quantity <= 0) {
        e.preventDefault();
        setClientError("All crate quantities must be at least 1.");
        return;
      }
    }
    setClientError(null);
  };

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="items" value={itemsJson} />

      {/* Accessible Inline Error Banner */}
      {(clientError || state?.error) && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm font-medium flex items-center justify-between shadow-xs"
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

      {/* Delivery Header Information */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
              1
            </span>
            Delivery & Supplier Details
          </h2>
          <span className="text-xs text-zinc-500">Step 1 of 2</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="referenceNumber"
              className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Delivery Challan / Invoice #
            </label>
            <input
              id="referenceNumber"
              name="referenceNumber"
              type="text"
              placeholder="e.g. DC-98421"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="notes"
            className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
          >
            Notes / Truck Info (Optional)
          </label>
          <input
            id="notes"
            name="notes"
            type="text"
            placeholder="e.g. Truck # LHR-4501, Driver: Naveed"
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Received Items Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
              2
            </span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Received Product Items (Full Crates)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Stock is recorded strictly in integer crates. Enter purchase cost per crate.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={addItemRow}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900/80 transition-colors cursor-pointer"
          >
            + Add Product Line
          </button>
        </div>

        <div className="p-6 space-y-4">
          {items.map((row, idx) => {
            const q = row.quantity || 0;
            const p = parseFloat(row.purchasePrice) || 0;
            const lineTotal = (q * p).toFixed(2);

            return (
              <div
                key={row.key}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1">
                    <label
                      htmlFor={`recv-product-${idx}`}
                      className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1"
                    >
                      Product #{idx + 1} *
                    </label>
                    <select
                      id={`recv-product-${idx}`}
                      value={row.productId}
                      onChange={(e) => updateItemRow(idx, "productId", e.target.value)}
                      className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} ({prod.brand})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="w-full sm:w-auto">
                    <label
                      htmlFor={`recv-stepper-${idx}`}
                      className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1"
                    >
                      Crates Received *
                    </label>
                    <CrateStepper
                      id={`recv-stepper-${idx}`}
                      value={row.quantity}
                      min={1}
                      onChange={(val) => updateItemRow(idx, "quantity", val)}
                      ariaLabel={`Crates received for line ${idx + 1}`}
                    />
                  </div>

                  {/* Purchase Cost */}
                  <div className="w-full sm:w-36">
                    <label
                      htmlFor={`recv-cost-${idx}`}
                      className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1"
                    >
                      Cost / Crate (Rs.) *
                    </label>
                    <input
                      id={`recv-cost-${idx}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.purchasePrice}
                      onChange={(e) => updateItemRow(idx, "purchasePrice", e.target.value)}
                      placeholder="0.00"
                      className="w-full h-10 px-3 py-2 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 tabular-nums"
                    />
                  </div>

                  {/* Line Total */}
                  <div className="w-full sm:w-36 text-left lg:text-right">
                    <div className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
                      Line Total
                    </div>
                    <div className="text-base font-black text-zinc-900 dark:text-zinc-100 py-1.5 tabular-nums">
                      {formatCurrency(parseFloat(lineTotal))}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <div className="pt-1 lg:pt-5">
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      disabled={items.length <= 1}
                      title="Remove product"
                      aria-label={`Remove product line ${idx + 1}`}
                      className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] sm:min-h-0 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all active:scale-95 disabled:active:scale-100"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addItemRow}
            className="w-full py-3 min-h-[44px] rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            + Add Another Product Line
          </button>

          {/* Summary Banner */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              * Posting receiving creates immutable <strong>RECEIVING</strong> movements and updates latest purchase costs.
            </div>

            <div className="flex items-center gap-6 bg-zinc-50 dark:bg-zinc-800/50 px-5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700/60">
              <div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                  Total Crates
                </span>
                <p className="text-lg font-black tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatCrates(totalCrates)}
                </p>
              </div>
              <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />
              <div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                  Total Delivery Cost
                </span>
                <p className="text-lg font-black tabular-nums text-blue-600 dark:text-blue-400">
                  {formatCurrency(totalCost)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Guidance & Submission Box */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
          <p>
            <strong className="text-zinc-800 dark:text-zinc-200">Save Draft:</strong> Saves this receiving record without adding stock to the warehouse.
          </p>
          <p>
            <strong className="text-zinc-800 dark:text-zinc-200">Post Receiving:</strong> Immediately adds crates into saleable inventory and updates purchase prices.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/receiving"
            className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors focus:outline-hidden focus:ring-2 focus:ring-zinc-400"
          >
            Cancel
          </Link>

          <button
            type="submit"
            name="postImmediately"
            value="false"
            disabled={isPending}
            className="px-5 py-2.5 text-sm font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:active:scale-100 disabled:opacity-50 cursor-pointer shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-zinc-400 inline-flex items-center gap-2"
          >
            {isPending && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-zinc-500/30 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
            )}
            {isPending ? "Saving..." : "Save Draft"}
          </button>

          <button
            type="submit"
            name="postImmediately"
            value="true"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:active:scale-100 text-white shadow-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isPending && (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isPending ? "Posting Stock..." : "Post Receiving"}
          </button>
        </div>
      </div>
    </form>
  );
}
