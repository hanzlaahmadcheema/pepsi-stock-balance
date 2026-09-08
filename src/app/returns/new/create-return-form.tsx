"use client";

import { useState, useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createReturnAction } from "../actions";
import { CrateStepper } from "@/components/ui/crate-stepper";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import type { SaleReturnEligibility } from "@/lib/returns/service";
import { IconShield } from "@/components/ui/icons";

type ReturnLineSelection = {
  productId: string;
  selected: boolean;
  quantity: number;
};

function buildLineSelections(sale: SaleReturnEligibility | null): Record<string, ReturnLineSelection> {
  if (!sale) return {};
  const map: Record<string, ReturnLineSelection> = {};
  for (const item of sale.items) {
    map[item.productId] = {
      productId: item.productId,
      selected: item.eligibleQuantity > 0,
      quantity: item.eligibleQuantity > 0 ? 1 : 0,
    };
  }
  return map;
}

export function CreateReturnForm({
  initialSale,
  recentSales,
}: {
  initialSale?: SaleReturnEligibility | null;
  recentSales: { id: string; invoiceNumber: string; customerName: string; soldAt: Date }[];
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createReturnAction, null);
  const [clientError, setClientError] = useState<string | null>(null);

  const [selectedSale, setSelectedSale] = useState<SaleReturnEligibility | null>(
    initialSale || null
  );
  const [invoiceSearch, setInvoiceSearch] = useState<string>(
    initialSale?.invoiceNumber || ""
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [plasticCrates, setPlasticCrates] = useState<number>(0);
  const [glassBottles, setGlassBottles] = useState<number>(0);

  const [lineSelections, setLineSelections] = useState<Record<string, ReturnLineSelection>>(() =>
    buildLineSelections(initialSale || null)
  );

  const handleSearchInvoice = async (invoiceQuery: string) => {
    if (!invoiceQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    setClientError(null);

    try {
      const res = await fetch(`/api/returns/sale-lookup?q=${encodeURIComponent(invoiceQuery.trim())}`);
      if (!res.ok) {
        throw new Error("Failed to look up invoice.");
      }
      const data = await res.json();
      if (!data.sale) {
        setSearchError("Invoice not found or contains no returnable items.");
        setSelectedSale(null);
        setLineSelections({});
      } else {
        setSelectedSale(data.sale);
        setLineSelections(buildLineSelections(data.sale));
      }
    } catch {
      setSearchError("Error searching for invoice. Please verify the invoice number.");
      setSelectedSale(null);
      setLineSelections({});
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (state?.success && state.returnId) {
      router.push(`/returns/${state.returnId}`);
    }
  }, [state?.success, state?.returnId, router]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (!selectedSale) {
      e.preventDefault();
      setClientError("Please search or select an original sales invoice first.");
      return;
    }

    if (!reason.trim() || reason.trim().length < 3) {
      e.preventDefault();
      setClientError("Please state a return reason (at least 3 characters).");
      return;
    }

    const activeLines = Object.values(lineSelections).filter(
      (l) => l.selected && l.quantity > 0
    );

    if (activeLines.length === 0) {
      e.preventDefault();
      setClientError("Please select at least one product line with quantity greater than 0.");
      return;
    }

    for (const line of activeLines) {
      const item = selectedSale.items.find((i) => i.productId === line.productId);
      if (item && line.quantity > item.eligibleQuantity) {
        e.preventDefault();
        setClientError(
          `Return quantity for ${item.productName} exceeds remaining eligible crates (${item.eligibleQuantity}).`
        );
        return;
      }
    }
    setClientError(null);
  };

  const payloadItems = Object.values(lineSelections)
    .filter((l) => l.selected && l.quantity > 0)
    .map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
    }));

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      {selectedSale && <input type="hidden" name="saleId" value={selectedSale.saleId} />}
      <input type="hidden" name="items" value={JSON.stringify(payloadItems)} />
      <input type="hidden" name="plasticCrates" value={plasticCrates.toString()} />
      <input type="hidden" name="glassBottles" value={glassBottles.toString()} />

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

      {/* Quarantine Information Banner */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
        <IconShield className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase tracking-wider block mb-0.5">Mandatory Quarantine Protocol</span>
          Returned crates do <b>NOT</b> immediately re-enter active saleable inventory. All returns are placed in <b>QUARANTINED</b> status until inspected and approved by an Owner in the Approvals module.
        </div>
      </div>

      {/* Step 1: Invoice Lookup Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
              1
            </span>
            Link to Original Sales Invoice
          </h2>
          <span className="text-xs text-zinc-500">Step 1 of 3</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="invoiceSearchInput"
              className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Search Invoice Number
            </label>
            <div className="flex gap-2">
              <input
                id="invoiceSearchInput"
                type="text"
                autoFocus
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchInvoice(invoiceSearch);
                  }
                }}
                placeholder="e.g. INV-20260907-1234"
                className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleSearchInvoice(invoiceSearch)}
                disabled={searchLoading || !invoiceSearch.trim()}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 active:scale-95 disabled:active:scale-100 disabled:opacity-50 transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
              >
                {searchLoading && (
                  <span className="inline-block w-3 h-3 border-2 border-zinc-400 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
                )}
                {searchLoading ? "Searching..." : "Find Invoice"}
              </button>
            </div>
            {searchError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-semibold">
                ⚠️ {searchError}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="recentInvoiceSelect"
              className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
            >
              Or Choose From Recent Invoices
            </label>
            <select
              id="recentInvoiceSelect"
              value={selectedSale?.saleId || ""}
              onChange={(e) => {
                const found = recentSales.find((s) => s.id === e.target.value);
                if (found) {
                  setInvoiceSearch(found.invoiceNumber);
                  handleSearchInvoice(found.invoiceNumber);
                }
              }}
              className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Recent Invoice --</option>
              {recentSales.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.invoiceNumber} — {s.customerName || "Anonymous"} ({new Date(s.soldAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedSale && (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750 text-xs flex flex-wrap items-center gap-6 text-zinc-600 dark:text-zinc-300">
            <div>
              Invoice: <b className="text-blue-600 dark:text-blue-400 font-bold">#{selectedSale.invoiceNumber}</b>
            </div>
            <div>
              Customer: <b className="text-zinc-900 dark:text-zinc-100 font-bold">{selectedSale.customerName || "Anonymous"}</b>
            </div>
            <div>
              Date Sold: <b>{new Date(selectedSale.soldAt).toLocaleDateString()}</b>
            </div>
            <div>
              Status:{" "}
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedSale.status}</span>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Line Items to Return */}
      {selectedSale && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
                2
              </span>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Select Products to Return (Full Crates)
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Select checkbox for items being returned and adjust crate counts.
                </p>
              </div>
            </div>
          </div>

          <ScrollableTable>
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-6 py-3 text-center w-16">Select</th>
                  <th className="px-6 py-3">Product Description</th>
                  <th className="px-6 py-3 text-center">Sold Crates</th>
                  <th className="px-6 py-3 text-center">Already Returned</th>
                  <th className="px-6 py-3 text-center">Eligible Crates</th>
                  <th className="px-6 py-3 text-center">Return Crates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {selectedSale.items.map((item) => {
                  const line = lineSelections[item.productId] || {
                    productId: item.productId,
                    selected: false,
                    quantity: 0,
                  };

                  const isEligible = item.eligibleQuantity > 0;

                  return (
                    <tr
                      key={item.productId}
                      className={`transition-colors ${
                        !isEligible
                          ? "opacity-40 bg-zinc-50/50 dark:bg-zinc-800/20"
                          : line.selected
                          ? "bg-blue-50/40 dark:bg-blue-950/20"
                          : "hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30"
                      }`}
                    >
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          disabled={!isEligible}
                          checked={line.selected}
                          onChange={(e) => {
                            setLineSelections((prev) => ({
                              ...prev,
                              [item.productId]: {
                                ...line,
                                selected: e.target.checked,
                                quantity:
                                  e.target.checked && line.quantity <= 0
                                    ? 1
                                    : line.quantity,
                              },
                            }));
                          }}
                          aria-label={`Select ${item.productName} for return`}
                          className="w-5 h-5 rounded text-blue-600 border-zinc-300 dark:border-zinc-700 cursor-pointer focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-zinc-900 dark:text-zinc-100">
                          {item.productName}
                        </div>
                        <div className="text-xs text-zinc-500">{item.productBrand}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                        {item.soldQuantity}
                      </td>
                      <td className="px-6 py-4 text-center tabular-nums text-zinc-500">
                        {item.alreadyReturned}
                      </td>
                      <td className="px-6 py-4 text-center font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {item.eligibleQuantity}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isEligible ? (
                          <div className="inline-block">
                            <CrateStepper
                              value={line.quantity}
                              min={1}
                              max={item.eligibleQuantity}
                              disabled={!line.selected}
                              onChange={(val) => {
                                setLineSelections((prev) => ({
                                  ...prev,
                                  [item.productId]: {
                                    ...line,
                                    quantity: val,
                                  },
                                }));
                              }}
                              ariaLabel={`Return quantity for ${item.productName}`}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400 italic">Fully returned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollableTable>
        </div>
      )}

      {/* Step 3: Return Details & Returnable Containers */}
      {selectedSale && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
                3
              </span>
              Reason & Returnable Containers
            </h2>
            <span className="text-xs text-zinc-500">Step 3 of 3</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="returnReason"
                  className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Return Reason *
                </label>
                <input
                  id="returnReason"
                  type="text"
                  name="reason"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Excess ordered crates, broken bottles on arrival, expired batch"
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="returnNotes"
                  className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Additional Remarks / Batch Info (Optional)
                </label>
                <textarea
                  id="returnNotes"
                  name="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Batch numbers, delivery driver statement, or inspection preparation notes..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Returnable Containers Returned (Optional)
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
                  Credits customer container balance upon Owner inspection approval.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Plastic Crates
                    </label>
                    <CrateStepper
                      value={plasticCrates}
                      min={0}
                      onChange={setPlasticCrates}
                      ariaLabel="Plastic Crates returned"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Glass Bottles
                    </label>
                    <CrateStepper
                      value={glassBottles}
                      min={0}
                      onChange={setGlassBottles}
                      ariaLabel="Glass Bottles returned"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <Link
                  href="/returns"
                  className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors focus:outline-hidden focus:ring-2 focus:ring-zinc-400"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isPending || payloadItems.length === 0}
                  className="px-6 py-2.5 text-sm font-bold rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 transition-all cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 inline-flex items-center gap-2"
                >
                  {isPending && (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {isPending ? "Submitting Return..." : "Submit Return"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
