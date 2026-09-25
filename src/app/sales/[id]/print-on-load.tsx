"use client";

/**
 * SaleConfirmationBanner — Rendered at the top of the Sale Details page
 * when arrived after completing a sale (e.g. ?new=1 or ?print=1).
 *
 * Implements the 4-step workflow requested:
 *   Complete Sale -> Sale Confirmation / Receipt -> Print Receipt -> Return to Sale Page
 *
 * Safety: Does NOT automatically invoke window.print() on mount, protecting
 * the single thermal roll from accidental physical printing during development.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { IconCheck, IconPrinter, IconPlus } from "@/components/ui/icons";

interface SaleConfirmationBannerProps {
  invoiceNumber: string;
}

export function PrintOnLoad({ invoiceNumber }: SaleConfirmationBannerProps) {
  const [printed, setPrinted] = useState(false);

  // Listen for afterprint event to give clear visual feedback
  useEffect(() => {
    const handleAfterPrint = () => setPrinted(true);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const handlePrintClick = () => {
    window.print();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="print:hidden mb-4 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
          <IconCheck className="w-5 h-5 stroke-[2.5]" />
        </div>
        <div>
          <h2 className="font-extrabold text-sm text-emerald-950 dark:text-emerald-100 flex items-center gap-2">
            <span>Sale Completed Successfully</span>
            <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
              {invoiceNumber}
            </span>
          </h2>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
            {printed
              ? "Receipt printed. Ready to ring up next sale."
              : "Review 80mm thermal receipt below or print receipt for customer."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
        <button
          type="button"
          onClick={handlePrintClick}
          className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
          title="Print on SpeedX 80mm thermal roll (Ctrl+P)"
        >
          <IconPrinter className="w-4 h-4" />
          <span>{printed ? "Re-print Receipt" : "Print Receipt"}</span>
        </button>

        <Link
          href="/sales/new"
          className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-zinc-700 text-emerald-800 dark:text-emerald-200 shadow-2xs transition-colors flex items-center justify-center gap-1.5"
        >
          <IconPlus className="w-4 h-4" />
          <span>Return to Sale Page</span>
        </Link>
      </div>
    </div>
  );
}
