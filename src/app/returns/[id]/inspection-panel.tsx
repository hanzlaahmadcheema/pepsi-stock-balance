"use client";

import { useState, useActionState } from "react";
import { InspectionResult } from "@prisma/client";
import { inspectReturnAction } from "../actions";
import type { ReturnDetails } from "@/lib/returns/service";
import { IconShield, IconCheck } from "@/components/ui/icons";
import { isCloudPortal } from "@/lib/config/portal-mode";

export function InspectionPanel({
  returnRecord,
  isOwner,
}: {
  returnRecord: ReturnDetails;
  isOwner: boolean;
}) {
  const [state, formAction, isPending] = useActionState(inspectReturnAction, null);
  const isCloud = isCloudPortal();

  const [decisions, setDecisions] = useState<
    Record<
      string,
      {
        result: InspectionResult;
        notes: string;
      }
    >
  >(() => {
    const init: Record<string, { result: InspectionResult; notes: string }> = {};
    for (const item of returnRecord.items) {
      init[item.id] = {
        result:
          item.inspectionResult !== InspectionResult.PENDING
            ? item.inspectionResult
            : InspectionResult.APPROVED_FOR_STOCK,
        notes: item.notes || "",
      };
    }
    return init;
  });

  const [generalNotes, setGeneralNotes] = useState("");

  const isQuarantined = returnRecord.status === "QUARANTINED";

  if (!isQuarantined) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          <IconCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span>Quarantine Inspection Completed</span>
        </h3>
        <p className="text-xs text-zinc-500">
          This return has been fully inspected by{" "}
          <b className="text-zinc-800 dark:text-zinc-200">
            {returnRecord.inspectedByName || "Owner"}
          </b>{" "}
          on{" "}
          {returnRecord.inspectedAt
            ? new Date(returnRecord.inspectedAt).toLocaleString()
            : "—"}
          . Decisions are finalized and locked.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {returnRecord.items.map((item) => {
            const isApproved = item.inspectionResult === InspectionResult.APPROVED_FOR_STOCK;
            const isDamaged = item.inspectionResult === InspectionResult.REJECTED_DAMAGED;

            return (
              <div
                key={item.id}
                className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-xs space-y-1"
              >
                <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {item.productName}
                </div>
                <div>Quantity: {item.quantity} crates</div>
                <div className="font-bold">
                  Verdict:{" "}
                  <span
                    className={
                      isApproved
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isDamaged
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-500"
                    }
                  >
                    {item.inspectionResult.replace(/_/g, " ")}
                  </span>
                </div>
                {item.notes && <div className="text-zinc-400">Notes: {item.notes}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // If still quarantined, show role-appropriate interface:
  if (isCloud) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-6 text-sm text-amber-900 dark:text-amber-200 space-y-2">
        <h3 className="font-bold flex items-center gap-2">
          <IconShield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <span>Awaiting Depot Inspection (Read-Only)</span>
        </h3>
        <p className="text-xs text-amber-800 dark:text-amber-300">
          This return is currently placed in <b>QUARANTINE</b>. Returned crates have not been
          restocked to saleable inventory. Physical quality inspection and restocking authorizations are performed on the Windows Depot terminal.
        </p>
      </div>
    );
  }

  // Inspection form
  const payloadDecisions = returnRecord.items.map((item) => ({
    returnItemId: item.id,
    result: decisions[item.id]?.result || InspectionResult.APPROVED_FOR_STOCK,
    notes: decisions[item.id]?.notes || undefined,
  }));

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <IconShield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span>Quarantine Quality Inspection</span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Evaluate physical crate condition. Approving an item will immediately create a RETURN_RESTOCK stock movement to return crates to saleable inventory.
          </p>
        </div>
      </div>

      {state?.error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          Inspection recorded successfully! Stock has been updated accordingly.
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="returnId" value={returnRecord.id} />
        <input type="hidden" name="decisions" value={JSON.stringify(payloadDecisions)} />

        <div className="space-y-4">
          {returnRecord.items.map((item) => {
            const currentDec = decisions[item.id] || {
              result: InspectionResult.APPROVED_FOR_STOCK,
              notes: "",
            };

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex flex-col md:flex-row md:items-center gap-4 justify-between"
              >
                <div className="flex-1">
                  <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {item.productName} ({item.productBrand})
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Returned Quantity: <b>{item.quantity} crates</b>
                  </div>
                </div>

                <div className="w-full md:w-64">
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Inspection Verdict *
                  </label>
                  <select
                    value={currentDec.result}
                    onChange={(e) => {
                      const val = e.target.value as InspectionResult;
                      setDecisions((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...currentDec,
                          result: val,
                        },
                      }));
                    }}
                    className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value={InspectionResult.APPROVED_FOR_STOCK}>
                      APPROVED (Restock to Saleable Inventory)
                    </option>
                    <option value={InspectionResult.REJECTED_DAMAGED}>
                      REJECTED (Damaged / Unusable - No Restock)
                    </option>
                    <option value={InspectionResult.DISPOSED}>
                      DISPOSED (Expired / Disposed - No Restock)
                    </option>
                  </select>
                </div>

                <div className="w-full md:w-64">
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Item Inspection Notes
                  </label>
                  <input
                    type="text"
                    value={currentDec.notes}
                    onChange={(e) => {
                      const notesVal = e.target.value;
                      setDecisions((prev) => ({
                        ...prev,
                        [item.id]: {
                          ...currentDec,
                          notes: notesVal,
                        },
                      }));
                    }}
                    placeholder="e.g. Good seals, undamaged cartons"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1">
            General Inspection Remarks (Optional)
          </label>
          <textarea
            name="generalNotes"
            rows={2}
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Summarize the inspection findings, quarantine clearance, or disposal reasoning..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2.5 text-sm font-bold rounded-lg bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isPending ? "Recording Inspection..." : "Finalize & Record Inspection"}
          </button>
        </div>
      </form>
    </div>
  );
}
