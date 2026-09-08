"use client";

import { useActionState } from "react";
import { updateProductDetailsAction } from "../actions";

export function EditProductForm({
  productId,
  initialData,
}: {
  productId: string;
  initialData: {
    name: string;
    brand: string;
    sku: string | null;
    minimumStockLevel: number;
    latestPurchasePrice?: string;
  };
}) {
  const [state, formAction, isPending] = useActionState(updateProductDetailsAction, null);

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
      <div>
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Edit Product Information
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Modify core product attributes and low-stock warning threshold.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="productId" value={productId} />

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="name"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Product Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={initialData.name}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="brand"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Brand *
            </label>
            <input
              id="brand"
              name="brand"
              type="text"
              required
              defaultValue={initialData.brand}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="sku"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              SKU / Code
            </label>
            <input
              id="sku"
              name="sku"
              type="text"
              defaultValue={initialData.sku || ""}
              placeholder="e.g. PEP-1500-6"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="minimumStockLevel"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Low-Stock Alert Level (Crates) *
            </label>
            <input
              id="minimumStockLevel"
              name="minimumStockLevel"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={initialData.minimumStockLevel}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="latestPurchasePrice"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Purchase Cost (Rs.)
            </label>
            <input
              id="latestPurchasePrice"
              name="latestPurchasePrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={initialData.latestPurchasePrice || "0.00"}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5 block">
              Confidential (Hidden from staff)
            </span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-xs focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
