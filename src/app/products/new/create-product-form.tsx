"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createProductAction } from "../actions";
import { IconPackage, IconCheckCircle } from "@/components/ui/icons";

interface CreateProductFormProps {
  isOwner?: boolean;
  enabledRates?: {
    retail: boolean;
    wholesale: boolean;
    key: boolean;
  };
  defaultBottles?: number;
}

export function CreateProductForm({
  isOwner = false,
  enabledRates = { retail: true, wholesale: true, key: true },
  defaultBottles = 24,
}: CreateProductFormProps) {
  const [state, formAction, isPending] = useActionState(createProductAction, null);
  const [isReturnable, setIsReturnable] = useState(false);

  return (
    <form action={formAction} className="w-full">
      {state?.error && (
        <div className="mb-6 p-4 text-sm rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 font-semibold shadow-xs">
          {state.error}
        </div>
      )}

      {/* SINGLE UNIFIED FORM CARD */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 sm:p-8 space-y-8">
        {/* Product Details Header */}
        <div className="space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <IconPackage className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Product Identification & Details</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Define the brand, beverage name, packaging SKU, and warehouse alert thresholds.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                Product Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                autoFocus
                placeholder="e.g. Pepsi 1.5L (1x6)"
                className="w-full px-3 py-2.5 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="brand"
                className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                Brand *
              </label>
              <input
                id="brand"
                name="brand"
                type="text"
                required
                placeholder="e.g. Pepsi, 7Up, Mirinda, Sting"
                className="w-full px-3 py-2.5 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="sku"
                className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
              >
                SKU / Code (Optional)
              </label>
              <input
                id="sku"
                name="sku"
                type="text"
                placeholder="e.g. PEP-1500-6"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="minimumStockLevel"
                className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
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
                className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Returnable Crate Tracking */}
        <div className="space-y-3 pt-2">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Crate Returnability
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Specify if this product uses returnable crates. Standard bottle capacity ({defaultBottles} bottles per crate) is configured in Settings.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
            <input type="hidden" name="crateConfigSubmitted" value="1" />
            <input type="hidden" name="isReturnable" value={isReturnable ? "true" : "false"} />
            <label htmlFor="isReturnable" className="flex items-start gap-3 cursor-pointer">
              <input
                id="isReturnable"
                type="checkbox"
                checked={isReturnable}
                onChange={(e) => setIsReturnable(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 block">
                  Returnable Crate
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 block mt-0.5">
                  Check if customers owe empty glass crates and bottles for this item. Bottle capacity ({defaultBottles} bottles/crate) is managed in Settings.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Pricing Tiers & Cost */}
        <div className="space-y-4 pt-2">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Pricing &amp; Cost per Crate
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Set unit selling prices for active customer tiers and initial purchase cost per crate.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="latestPurchasePrice"
                className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
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
                className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500 tabular-nums"
              />
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-1 block">
                Default acquisition cost
              </span>
            </div>

            {enabledRates.retail && (
              <div>
                <label
                  htmlFor="retailPrice"
                  className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
                >
                  Retail Price (Rs.) *
                </label>
                <input
                  id="retailPrice"
                  name="retailPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500 tabular-nums"
                />
              </div>
            )}

            {enabledRates.wholesale && (
              <div>
                <label
                  htmlFor="wholesalePrice"
                  className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
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
                  className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500 tabular-nums"
                />
              </div>
            )}

            {enabledRates.key && (
              <div>
                <label
                  htmlFor="keyAccountPrice"
                  className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
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
                  className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500 tabular-nums"
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
          <Link
            href="/products"
            className="px-5 py-2.5 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:active:scale-100 disabled:opacity-50 text-white font-bold text-sm shadow-sm transition-all cursor-pointer flex items-center gap-2"
          >
            {isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Creating Product...</span>
              </>
            ) : (
              <>
                <IconCheckCircle className="w-4 h-4" />
                <span>Save New Product</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
