"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PaymentMethod } from "@prisma/client";
import { recordAccountPaymentAction } from "../../actions";
import { formatCurrency } from "@/lib/formatters";

export function CustomerPaymentForm({
  customerId,
  customerName,
  outstandingBalance,
}: {
  customerId: string;
  customerName: string;
  outstandingBalance: number;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(recordAccountPaymentAction, null);
  const [amount, setAmount] = useState<string>("");

  if (state?.success) {
    // Redirect back to customer ledger
    setTimeout(() => {
      router.push(`/customers/${customerId}`);
    }, 1200);
  }

  const handlePayFull = () => {
    setAmount(outstandingBalance.toFixed(2));
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-xs max-w-lg mx-auto">
      <div className="mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          Record Account Payment
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Apply a lump-sum payment against {customerName}&apos;s outstanding balance.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl p-4 mb-6 flex items-center justify-between shadow-2xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
            Current Outstanding Balance
          </span>
          <div className="text-2xl font-black text-amber-950 dark:text-amber-100">
            {formatCurrency(outstandingBalance)}
          </div>
        </div>
        {outstandingBalance > 0 && (
          <button
            type="button"
            onClick={handlePayFull}
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-xs"
          >
            Pay Full Balance
          </button>
        )}
      </div>

      {state?.error && (
        <div
          role="alert"
          className="p-3 mb-4 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 font-semibold"
        >
          {state.error}
        </div>
      )}

      {state?.success && (
        <div
          role="status"
          className="p-3 mb-4 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 font-semibold"
        >
          Payment successfully recorded! Redirecting to customer ledger...
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="customerId" value={customerId} />

        <div>
          <label
            htmlFor="paymentAmount"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Payment Amount (Rs.) *
          </label>
          <input
            id="paymentAmount"
            type="number"
            name="amount"
            autoFocus
            step="0.01"
            min="0.01"
            max={outstandingBalance > 0 ? outstandingBalance : undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0.00"
            className="w-full px-3 py-2.5 text-lg font-black rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Cannot exceed current outstanding balance of {formatCurrency(outstandingBalance)}.
          </p>
        </div>

        <div>
          <label
            htmlFor="custPaymentMethod"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Payment Method *
          </label>
          <select
            id="custPaymentMethod"
            name="paymentMethod"
            defaultValue={PaymentMethod.CASH}
            required
            className="w-full px-3 py-2.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value={PaymentMethod.CASH}>CASH</option>
            <option value={PaymentMethod.EASYPAISA}>EASYPAISA</option>
            <option value={PaymentMethod.JAZZCASH}>JAZZCASH</option>
            <option value={PaymentMethod.MPESA}>MPESA</option>
            <option value={PaymentMethod.QR}>QR CODE</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="custReferenceNumber"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Reference / Transaction Number (Optional)
          </label>
          <input
            id="custReferenceNumber"
            type="text"
            name="referenceNumber"
            placeholder="e.g. Bank slip, TRX ID, Cheque #"
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <Link
            href={`/customers/${customerId}`}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending || outstandingBalance <= 0}
            className="px-6 py-2.5 text-sm font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
          >
            {isPending ? "Recording Payment..." : "Record Payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
