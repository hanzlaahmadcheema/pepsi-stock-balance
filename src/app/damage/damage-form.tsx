"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { DamageType } from "@prisma/client";
import { recordDamageAction, type DamageActionState } from "./actions";
import { CrateStepper } from "@/components/ui/crate-stepper";

const DAMAGE_TYPE_LABELS: Record<DamageType, string> = {
  DAMAGED_TRANSIT: "Damaged in Transit",
  DAMAGED_WAREHOUSE: "Damaged in Warehouse",
  EXPIRED: "Expired",
  LEAKAGE: "Leakage",
  OTHER: "Other",
};

interface Product {
  id: string;
  name: string;
  brand: string;
}

export function DamageForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<DamageActionState, FormData>(
    recordDamageAction,
    null
  );

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state?.success, router]);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs p-6 space-y-4">
      <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Record Damage / Expiry</h2>

      {state?.error && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm font-medium"
        >
          {state.error}
        </div>
      )}

      {state?.success && (
        <div
          role="status"
          className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm font-semibold"
        >
          ✓ Damage record saved. Stock reduced.
        </div>
      )}

      <form ref={formRef} action={formAction} className="space-y-4">
        <div>
          <label
            htmlFor="damageProductId"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Product *
          </label>
          <select
            id="damageProductId"
            name="productId"
            autoFocus
            required
            defaultValue=""
            className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-red-500"
          >
            <option value="">— Select product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.brand})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1">
            Damaged Crates (Quantity) *
          </label>
          <CrateStepper
            name="quantity"
            defaultValue={1}
            min={1}
            ariaLabel="Damaged crates quantity"
          />
        </div>

        <div>
          <label
            htmlFor="damageTypeSelect"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Damage Type *
          </label>
          <select
            id="damageTypeSelect"
            name="damageType"
            defaultValue={DamageType.DAMAGED_WAREHOUSE}
            className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-red-500"
          >
            {Object.values(DamageType).map((dt) => (
              <option key={dt} value={dt}>
                {DAMAGE_TYPE_LABELS[dt]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="damageReason"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Reason (Optional)
          </label>
          <input
            id="damageReason"
            type="text"
            name="reason"
            placeholder="Brief description of damage cause"
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div>
          <label
            htmlFor="damageNotes"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1"
          >
            Notes (Optional)
          </label>
          <textarea
            id="damageNotes"
            name="notes"
            rows={2}
            placeholder="Additional details..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 text-sm font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
        >
          {isPending ? "Saving..." : "Record Damaged Stock"}
        </button>
      </form>
    </div>
  );
}
