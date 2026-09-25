"use client";

/**
 * PrintOnLoad — Client component that auto-triggers window.print() on mount.
 *
 * Rendered only when the sale details page is visited with ?print=1
 * (i.e. immediately after completing a sale from the POS).
 *
 * After the print dialog is dismissed (or if user cancels), shows a
 * "Return to New Sale" banner with a 1-click shortcut back to the POS.
 *
 * Does NOT affect the receipt layout; isolated from ThermalReceipt.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { IconPlus, IconPrinter } from "@/components/ui/icons";

interface PrintOnLoadProps {
  invoiceNumber: string;
}

export function PrintOnLoad({ invoiceNumber }: PrintOnLoadProps) {
  const [printDone, setPrintDone] = useState(false);

  useEffect(() => {
    // Small delay to let the page render before opening print dialog
    const timer = setTimeout(() => {
      window.print();
      // After print dialog closes (user prints or cancels), show the return banner
      setPrintDone(true);
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  // Listen for afterprint event to reliably detect print dialog close
  useEffect(() => {
    const handleAfterPrint = () => setPrintDone(true);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  if (!printDone) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="print:hidden mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3
                 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40
                 border border-emerald-200 dark:border-emerald-900 shadow-xs"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
          <IconPrinter className="w-4 h-4" />
        </div>
        <div>
          <div className="font-extrabold text-emerald-900 dark:text-emerald-100 text-sm">
            Sale recorded — {invoiceNumber}
          </div>
          <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
            Receipt printed. Ready for next sale.
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3 py-2 text-xs font-bold rounded-lg border border-emerald-300 dark:border-emerald-700
                     text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60
                     transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <IconPrinter className="w-3.5 h-3.5" />
          Re-print
        </button>

        <Link
          href="/sales/new"
          className="px-4 py-2 text-sm font-extrabold rounded-lg bg-emerald-600 hover:bg-emerald-700
                     text-white shadow-sm hover:shadow-md transition-all flex items-center gap-2"
        >
          <IconPlus className="w-4 h-4" />
          New Sale
        </Link>
      </div>
    </div>
  );
}
