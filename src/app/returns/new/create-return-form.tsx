"use client";

import { useState, useActionState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createReturnAction } from "../actions";
import { CrateStepper } from "@/components/ui/crate-stepper";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import type { SaleReturnEligibility } from "@/lib/returns/service";
import { IconShield, IconSearch, IconCheckCircle, IconRotateCcw, IconAlertTriangle } from "@/components/ui/icons";

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
    <form action={formAction} onSubmit={handleSubmit} className="w-full">
      {selectedSale && <input type="hidden" name="saleId" value={selectedSale.saleId} />}
      <input type="hidden" name="items" value={JSON.stringify(payloadItems)} />
      <input type="hidden" name="plasticCrates" value={plasticCrates.toString()} />
      <input type="hidden" name="glassBottles" value={glassBottles.toString()} />

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
        {/* Mandatory Quarantine Protocol Notice */}
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
          <IconShield className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider block mb-0.5">Quarantine Protocol Notice</span>
            Returned goods are placed into <b>INSPECTION QUARANTINE</b> upon recording. They do <b>NOT</b> immediately become saleable until reviewed and approved by an Owner in Approvals.
          </div>
        </div>

        {/* Invoice Lookup Row */}
        <div className="space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <IconRotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Find Original Sales Invoice</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Returns must reference the original sale invoice to calculate prices and container credits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="invoiceSearchInput"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Search Invoice #
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
                  className="flex-1 px-3 py-2 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleSearchInvoice(invoiceSearch)}
                  disabled={searchLoading || !invoiceSearch.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {searchLoading ? "Finding..." : "Find Invoice"}
                </button>
              </div>
              {searchError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-semibold flex items-center gap-1.5">
                  <IconAlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{searchError}</span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="recentInvoiceSelect"
                className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
              >
                Or Pick From Recent Sales
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
                className="w-full px-3 py-2.5 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choose a Recent Invoice --</option>
                {recentSales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.invoiceNumber} — {s.customerName} ({new Date(s.soldAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Selected Invoice Details & Product Return Lines */}
        {selectedSale && (
          <div className="space-y-6 pt-2">
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block">
                  Active Invoice
                </span>
                <span className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                  {selectedSale.invoiceNumber}
                </span>
                <span className="text-xs text-zinc-500 ml-2">
                  Customer: <strong>{selectedSale.customerName}</strong>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Sold On</span>
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {new Date(selectedSale.soldAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Products Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Select Return Items & Crates
              </h3>

              <div className="space-y-2.5">
                {selectedSale.items.map((item) => {
                  const sel = lineSelections[item.productId] || {
                    productId: item.productId,
                    selected: false,
                    quantity: 0,
                  };

                  return (
                    <div
                      key={item.productId}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm ${
                        sel.selected
                          ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-400 dark:border-blue-600"
                          : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 opacity-60"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          id={`item-check-${item.productId}`}
                          checked={sel.selected}
                          onChange={(e) => {
                            setLineSelections((prev) => ({
                              ...prev,
                              [item.productId]: {
                                ...sel,
                                selected: e.target.checked,
                                quantity: e.target.checked ? Math.max(1, sel.quantity) : 0,
                              },
                            }));
                          }}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`item-check-${item.productId}`} className="cursor-pointer">
                          <div className="font-bold text-zinc-900 dark:text-zinc-100">
                            {item.productName}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Sold: {item.soldQuantity} | Eligible: {item.eligibleQuantity} crates
                          </div>
                        </label>
                      </div>

                      {sel.selected && (
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                              Return Crates
                            </span>
                            <CrateStepper
                              defaultValue={sel.quantity}
                              min={1}
                              max={item.eligibleQuantity}
                              onChange={(val) => {
                                setLineSelections((prev) => ({
                                  ...prev,
                                  [item.productId]: {
                                    ...sel,
                                    quantity: val,
                                  },
                                }));
                              }}
                              ariaLabel={`Return crates for ${item.productName}`}
                            />
                          </div>

                          <div className="text-right w-24">
                            <span className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">
                              Return Crates
                            </span>
                            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                              {sel.quantity} crates
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Container and Reason Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Plastic Crates Returned
                </label>
                <input
                  type="number"
                  min="0"
                  value={plasticCrates}
                  onChange={(e) => setPlasticCrates(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
                  Glass Bottles Returned
                </label>
                <input
                  type="number"
                  min="0"
                  value={glassBottles}
                  onChange={(e) => setGlassBottles(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                />
              </div>

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
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Excess stock, Defective seal, Wrong SKU"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Submit Action Bar */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
              <Link
                href="/returns"
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
                    <span>Recording Return...</span>
                  </>
                ) : (
                  <>
                    <IconCheckCircle className="w-4 h-4" />
                    <span>Record Customer Return</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
