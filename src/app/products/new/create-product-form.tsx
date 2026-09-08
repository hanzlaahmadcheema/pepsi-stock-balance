"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createProductAction } from "../actions";

export function CreateProductForm() {
  const [state, formAction, isPending] = useActionState(createProductAction, null);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 text-sm rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
          {state.error}
        </div>
      )}

      {/* Section 1: Basic Info */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Product Details
        </h2>

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
              placeholder="e.g. Pepsi 1.5L (1x6)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
              placeholder="e.g. Pepsi, 7Up, Mirinda, Sting"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="sku"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              SKU / Code (Optional)
            </label>
            <input
              id="sku"
              name="sku"
              type="text"
              placeholder="e.g. PEP-1500-6"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
              defaultValue="20"
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Triggers a low-stock indicator on the dashboard when stock is at or below this amount.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Cost & Initial Selling Prices */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Cost & Selling Prices
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Prices are per full crate/case. Purchase cost is kept confidential from staff.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5 block">
              Owner only (Hidden from staff)
            </span>
          </div>

          <div>
            <label
              htmlFor="retailPrice"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Retail Price (Rs.)
            </label>
            <input
              id="retailPrice"
              name="retailPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="wholesalePrice"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Wholesale Price (Rs.)
            </label>
            <input
              id="wholesalePrice"
              name="wholesalePrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="keyAccountPrice"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Key Account Price (Rs.)
            </label>
            <input
              id="keyAccountPrice"
              name="keyAccountPrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Form buttons */}
      <div className="flex items-center justify-end gap-4">
        <Link
          href="/products"
          className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isPending ? "Creating Product..." : "Save Product"}
        </button>
      </div>
    </form>
  );
}
