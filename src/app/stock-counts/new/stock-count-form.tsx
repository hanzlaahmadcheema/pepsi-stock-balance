"use client";

import { useState, useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitStockCountAction } from "../actions";
import { CrateStepper } from "@/components/ui/crate-stepper";
import { IconClipboardList } from "@/components/ui/icons";

export type ProductStockItem = {
  id: string;
  name: string;
  brand: string;
  systemStock: number;
};

type RowCountState = {
  counted: boolean;
  physicalQuantity: number;
  reason: string;
};

export function StockCountForm({
  products,
  defaultDate,
}: {
  products: ProductStockItem[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(submitStockCountAction, null);
  const [clientError, setClientError] = useState<string | null>(null);

  const [businessDate, setBusinessDate] = useState(defaultDate);
  const [notes, setNotes] = useState("");

  const [countStates, setCountStates] = useState<Record<string, RowCountState>>(() => {
    const init: Record<string, RowCountState> = {};
    for (const p of products) {
      init[p.id] = {
        counted: true,
        physicalQuantity: p.systemStock, // Pre-fill with system stock for convenience
        reason: "",
      };
    }
    return init;
  });

  useEffect(() => {
    if (state?.success && state.closingId) {
      router.push(`/stock-counts/${state.closingId}`);
    }
  }, [state?.success, state?.closingId, router]);

  // Calculations
  let totalCounted = 0;
  let totalMatched = 0;
  let totalDiscrepancies = 0;

  for (const p of products) {
    const c = countStates[p.id];
    if (c?.counted) {
      totalCounted++;
      const diff = c.physicalQuantity - p.systemStock;
      if (diff === 0) totalMatched++;
      else totalDiscrepancies++;
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const activeCounts = products
      .filter((p) => countStates[p.id]?.counted)
      .map((p) => {
        const c = countStates[p.id]!;
        const diff = c.physicalQuantity - p.systemStock;
        return {
          productId: p.id,
          physicalQuantity: c.physicalQuantity,
          difference: diff,
          reason: c.reason,
        };
      });

    if (activeCounts.length === 0) {
      e.preventDefault();
      setClientError("Please count at least one product.");
      return;
    }

    for (const c of activeCounts) {
      if (c.difference !== 0 && (!c.reason?.trim() || c.reason.trim().length < 3)) {
        e.preventDefault();
        const p = products.find((prod) => prod.id === c.productId);
        setClientError(`Please provide an explanation reason (min 3 chars) for the discrepancy on "${p?.name}".`);
        return;
      }
    }
    setClientError(null);
  };

  const payloadCounts = products
    .filter((p) => countStates[p.id]?.counted)
    .map((p) => {
      const c = countStates[p.id]!;
      return {
        productId: p.id,
        physicalQuantity: c.physicalQuantity,
        reason: c.reason?.trim() || undefined,
      };
    });

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="businessDate" value={businessDate} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="counts" value={JSON.stringify(payloadCounts)} />

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

      {/* Approval Notice Banner */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200 shadow-xs">
        <IconClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider block mb-0.5">Physical Stock Audit & Approval Workflow</span>
          Submitting this count records physical inventory for this business date. If any discrepancy exists, warehouse stock balances will only update once an Owner reviews and approves the count.
        </div>
      </div>

      {/* Header config: Date & Summary */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <label
            htmlFor="countBusinessDate"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Count Business Date *
          </label>
          <input
            id="countBusinessDate"
            type="date"
            required
            autoFocus
            value={businessDate}
            onChange={(e) => setBusinessDate(e.target.value)}
            className="px-3 py-2 text-sm font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Date to which this physical inventory verification belongs.
          </p>
        </div>

        {/* Live Metrics Counters */}
        <div className="flex items-center gap-3 text-xs">
          <div className="p-3 px-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750 text-center">
            <span className="text-zinc-500 dark:text-zinc-400 font-medium">Products Counted</span>
            <div className="text-lg font-black text-zinc-900 dark:text-zinc-100">
              {totalCounted} / {products.length}
            </div>
          </div>

          <div className="p-3 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-center">
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">Exact Matches</span>
            <div className="text-lg font-black text-emerald-800 dark:text-emerald-300">
              {totalMatched}
            </div>
          </div>

          <div className="p-3 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-center">
            <span className="text-amber-700 dark:text-amber-400 font-bold">Discrepancies</span>
            <div className="text-lg font-black text-amber-800 dark:text-amber-300">
              {totalDiscrepancies}
            </div>
          </div>
        </div>
      </div>

      {/* Physical Count Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Crate Inventory Verification
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Compare system recorded crates with actual warehouse crates on floor.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3">Product Description</th>
                <th className="px-6 py-3 text-center">System Stock</th>
                <th className="px-6 py-3 text-center">Physical Count</th>
                <th className="px-6 py-3 text-center">Variance</th>
                <th className="px-6 py-3">Discrepancy Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {products.map((p) => {
                const c = countStates[p.id] || {
                  counted: true,
                  physicalQuantity: p.systemStock,
                  reason: "",
                };

                const diff = c.physicalQuantity - p.systemStock;
                const hasDiscrepancy = diff !== 0;

                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${
                      hasDiscrepancy
                        ? "bg-amber-50/30 dark:bg-amber-950/20"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">{p.name}</div>
                      <div className="text-xs text-zinc-500">{p.brand}</div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-3 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-black text-sm">
                        {p.systemStock} crates
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="inline-block">
                        <CrateStepper
                          value={c.physicalQuantity}
                          min={0}
                          onChange={(val) => {
                            setCountStates((prev) => ({
                              ...prev,
                              [p.id]: {
                                ...c,
                                physicalQuantity: val,
                              },
                            }));
                          }}
                          isError={hasDiscrepancy}
                          ariaLabel={`Physical count for ${p.name}`}
                        />
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      {diff === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full">
                          ✓ Matched (0)
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full border ${
                            diff > 0
                              ? "text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800"
                              : "text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800"
                          }`}
                        >
                          {diff > 0 ? `+${diff}` : diff} crates ({diff > 0 ? "Surplus" : "Shortage"})
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {hasDiscrepancy ? (
                        <input
                          type="text"
                          required
                          minLength={3}
                          value={c.reason}
                          onChange={(e) => {
                            const r = e.target.value;
                            setCountStates((prev) => ({
                              ...prev,
                              [p.id]: {
                                ...c,
                                reason: r,
                              },
                            }));
                          }}
                          placeholder="Mandatory explanation for discrepancy..."
                          className="w-full px-3 py-2 text-xs font-medium rounded-lg border-2 border-amber-400 dark:border-amber-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                        />
                      ) : (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                          No discrepancy — verified
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Remarks and submit footer */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="w-full md:w-1/2">
          <label
            htmlFor="countNotes"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
          >
            General Count Session Notes (Optional)
          </label>
          <input
            id="countNotes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. End of shift count, Sunday warehouse audit..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <Link
            href="/stock-counts"
            className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 text-sm font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
          >
            {isPending ? "Submitting Count..." : "Submit Count"}
          </button>
        </div>
      </div>
    </form>
  );
}
