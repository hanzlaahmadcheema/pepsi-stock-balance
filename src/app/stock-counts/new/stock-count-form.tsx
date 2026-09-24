"use client";

import { useState, useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitStockCountAction } from "../actions";
import { CrateStepper } from "@/components/ui/crate-stepper";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { IconClipboardList, IconCheckCircle } from "@/components/ui/icons";

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
    <form action={formAction} onSubmit={handleSubmit} className="w-full">
      <input type="hidden" name="businessDate" value={businessDate} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="counts" value={JSON.stringify(payloadCounts)} />

      {/* Accessible Inline Error Banner */}
      {(clientError || state?.error) && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm font-medium flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">Notice:</span>
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
        {/* Physical Stock Audit Banner */}
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200 shadow-xs">
          <IconClipboardList className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider block mb-0.5">Physical Stock Audit & Approval Protocol</span>
            Entering physical crate counts compares on-hand warehouse crates against system stock. If discrepancies exist, balances change only after Owner review & approval in Approvals.
          </div>
        </div>

        {/* Date, Live Counters, & Audit Notes */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center border-b border-zinc-100 dark:border-zinc-800 pb-6">
            <div className="md:col-span-4">
              <label
                htmlFor="countBusinessDate"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Audit Business Date *
              </label>
              <input
                id="countBusinessDate"
                type="date"
                required
                autoFocus
                value={businessDate}
                onChange={(e) => setBusinessDate(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-8 flex flex-wrap items-center justify-start md:justify-end gap-3 text-xs">
              <div className="p-3 px-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750 text-center min-w-[120px]">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium block text-[11px]">Counted</span>
                <div className="text-base font-black tabular-nums text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {totalCounted} / {products.length}
                </div>
              </div>

              <div className="p-3 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-center min-w-[120px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-bold block text-[11px]">Exact Matches</span>
                <div className="text-base font-black tabular-nums text-emerald-800 dark:text-emerald-300 mt-0.5">
                  {totalMatched}
                </div>
              </div>

              <div className="p-3 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-center min-w-[120px]">
                <span className="text-amber-700 dark:text-amber-400 font-bold block text-[11px]">Discrepancies</span>
                <div className="text-base font-black tabular-nums text-amber-800 dark:text-amber-300 mt-0.5">
                  {totalDiscrepancies}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
            >
              General Audit Notes (Optional)
            </label>
            <input
              id="notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. End of month physical verification, Warehouse A"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Physical Count Audit Table */}
        <div className="space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Product Stock Audit
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Verify physical warehouse crates against recorded system inventory. If physical crates differ, specify an explanation.
            </p>
          </div>

          <div className="space-y-3">
            {products.map((p) => {
              const c = countStates[p.id] || {
                counted: false,
                physicalQuantity: p.systemStock,
                reason: "",
              };
              const diff = c.physicalQuantity - p.systemStock;

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-sm ${
                    !c.counted
                      ? "opacity-50 bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800"
                      : diff === 0
                      ? "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800"
                      : "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 shadow-2xs"
                  }`}
                >
                  {/* Left: Checkbox & Product Name */}
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <input
                      type="checkbox"
                      id={`chk-${p.id}`}
                      checked={c.counted}
                      onChange={(e) => {
                        setCountStates((prev) => ({
                          ...prev,
                          [p.id]: { ...c, counted: e.target.checked },
                        }));
                      }}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`chk-${p.id}`} className="cursor-pointer">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">
                        {p.name}
                      </div>
                      <div className="text-xs text-zinc-400">{p.brand}</div>
                    </label>
                  </div>

                  {/* System Stock */}
                  <div className="w-28">
                    <span className="block text-[10px] uppercase font-bold text-zinc-400 mb-0.5">
                      System Stock
                    </span>
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                      {p.systemStock} crates
                    </span>
                  </div>

                  {/* Physical Quantity Stepper */}
                  <div className="w-48">
                    <span className="block text-[10px] uppercase font-bold text-zinc-400 mb-0.5">
                      Physical Count
                    </span>
                    <CrateStepper
                      defaultValue={c.physicalQuantity}
                      min={0}
                      onChange={(val) => {
                        setCountStates((prev) => ({
                          ...prev,
                          [p.id]: { ...c, physicalQuantity: val, counted: true },
                        }));
                      }}
                      ariaLabel={`Physical count for ${p.name}`}
                    />
                  </div>

                  {/* Difference Badge */}
                  <div className="w-28">
                    <span className="block text-[10px] uppercase font-bold text-zinc-400 mb-0.5">
                      Difference
                    </span>
                    {diff === 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Match (0)
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-black ${
                          diff > 0
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {diff > 0 ? `+${diff}` : diff} crates
                      </span>
                    )}
                  </div>

                  {/* Reason for discrepancy (only if diff !== 0) */}
                  <div className="flex-1 min-w-[200px]">
                    {diff !== 0 && c.counted ? (
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 mb-0.5">
                          Discrepancy Reason *
                        </label>
                        <input
                          type="text"
                          required
                          value={c.reason}
                          onChange={(e) => {
                            setCountStates((prev) => ({
                              ...prev,
                              [p.id]: { ...c, reason: e.target.value },
                            }));
                          }}
                          placeholder="e.g. Unrecorded breakage, Miscount"
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400 italic">No discrepancy</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Actions */}
        <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
          <Link
            href="/stock-counts"
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
                <span>Submitting Audit...</span>
              </>
            ) : (
              <>
                <IconCheckCircle className="w-4 h-4" />
                <span>Submit Stock Count for Approval</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
