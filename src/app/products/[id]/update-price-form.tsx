"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { updateProductPriceAction } from "../actions";
import { PriceTier } from "@prisma/client";

export function UpdatePriceForm({
  productId,
  activePrices,
}: {
  productId: string;
  activePrices: { tier: PriceTier; amount: string }[];
}) {
  const [selectedTier, setSelectedTier] = useState<PriceTier>(PriceTier.RETAIL);
  const [state, formAction, isPending] = useActionState(updateProductPriceAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state?.success]);

  const currentPriceForTier = activePrices.find((p) => p.tier === selectedTier)?.amount;

  return (
    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
      <div>
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          Update Selling Price
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Atomic update: closes the current active price and creates the new price record in the ledger.
        </p>
      </div>

      <form ref={formRef} action={formAction} className="space-y-4">
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
              htmlFor="tier"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Price Tier
            </label>
            <select
              id="tier"
              name="tier"
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value as PriceTier)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
            >
              <option value={PriceTier.RETAIL}>RETAIL</option>
              <option value={PriceTier.WHOLESALE}>WHOLESALE</option>
              <option value={PriceTier.KEY_ACCOUNT}>KEY_ACCOUNT</option>
            </select>
            {currentPriceForTier && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
                Current active rate: <strong className="text-zinc-800 dark:text-zinc-200">Rs. {currentPriceForTier}</strong>
              </span>
            )}
          </div>

          <div>
            <label
              htmlFor="amount"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              New Price Amount (Rs.)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 tabular-nums"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 disabled:opacity-50 disabled:active:scale-100 transition-all cursor-pointer"
          >
            {isPending && (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isPending ? "Updating Price..." : "Apply New Price"}
          </button>
        </div>
      </form>
    </div>
  );
}
