"use client";

import { useActionState } from "react";
import { updateProductDetailsAction } from "../actions";

export function EditProductForm({
  productId,
  isOwner = false,
  initialData,
}: {
  productId: string;
  isOwner?: boolean;
  initialData: {
    name: string;
    brand: string;
    sku: string | null;
    minimumStockLevel: number;
    latestPurchasePrice?: string;
    hasGlassCrate?: boolean;
    bottlesPerCrate?: number;
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

          {isOwner && (
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
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 tabular-nums"
              />
              <span className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5 block">
                Confidential (Owner Only)
              </span>
            </div>
          )}

          <div className="sm:col-span-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
            <label htmlFor="isReturnable" className="flex items-start gap-3 cursor-pointer">
              <input
                id="isReturnable"
                name="isReturnable"
                type="checkbox"
                defaultChecked={initialData.hasGlassCrate}
                className="mt-0.5 w-5 h-5 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 block">
                  Returnable Crate
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 block mt-0.5">
                  Check if customers must return empty crates &amp; bottles for this product. Quantity of bottles per crate is managed globally in Settings.
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:active:scale-100 transition-all cursor-pointer"
          >
            {isPending && (
              <span className="inline-block w-4 h-4 border-2 border-zinc-400 border-t-zinc-900 dark:border-t-zinc-100 rounded-full animate-spin" />
            )}
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
