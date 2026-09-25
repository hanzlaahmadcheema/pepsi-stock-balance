"use client";

import { useState, useTransition } from "react";
import {
  SerializedQuarantineRecord,
  getBusinessErrorExplanation,
} from "./types";
import {
  retryQuarantineAction,
  discardQuarantineAction,
  getQuarantineRecordsAction,
} from "./actions";
import { QuarantineStatus } from "@prisma/client";
import {
  IconAlertOctagon,
  IconCheck,
  IconClose,
  IconSearch,
  IconAlertTriangle,
  IconShield,
  IconHistory,
  IconChevronDown,
  IconInfo,
} from "@/components/ui/icons";

interface QuarantineManagerProps {
  initialRecords: SerializedQuarantineRecord[];
}

export function QuarantineManager({ initialRecords }: QuarantineManagerProps) {
  const [records, setRecords] = useState<SerializedQuarantineRecord[]>(initialRecords);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "QUARANTINED" | "RESOLVED">("ALL");
  const [opTypeFilter, setOpTypeFilter] = useState("");
  const [errorCodeFilter, setErrorCodeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [expandedPayloadId, setExpandedPayloadId] = useState<string | null>(null);
  const [retryTarget, setRetryTarget] = useState<SerializedQuarantineRecord | null>(null);
  const [discardTarget, setDiscardTarget] = useState<SerializedQuarantineRecord | null>(null);

  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Summary counts
  const activeCount = records.filter((r) => r.status === QuarantineStatus.QUARANTINED).length;
  const resolvedCount = records.filter((r) => r.status === QuarantineStatus.RESOLVED).length;
  const earliestActive = records.find((r) => r.status === QuarantineStatus.QUARANTINED);

  // Available unique operation types and error codes for dropdown quick filtering
  const allOpTypes = Array.from(new Set(records.map((r) => r.operationType))).filter(Boolean);
  const allErrors = Array.from(new Set(records.map((r) => r.errorCode))).filter(Boolean);

  const filteredRecords = records.filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (opTypeFilter && r.operationType !== opTypeFilter) return false;
    if (errorCodeFilter && r.errorCode !== errorCodeFilter) return false;
    if (dateFrom) {
      const created = new Date(r.createdAt);
      if (created < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const created = new Date(r.createdAt);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (created > toDate) return false;
    }
    return true;
  });

  const refreshRecords = async () => {
    const res = await getQuarantineRecordsAction({
      status: statusFilter,
      operationType: opTypeFilter,
      errorCode: errorCodeFilter,
      dateFrom,
      dateTo,
    });
    if (res.success && res.records) {
      setRecords(res.records);
    }
  };

  const handleRetrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!retryTarget) return;
    if (!reason.trim()) {
      setActionError("A resolution reason is mandatory to retry a quarantined change.");
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await retryQuarantineAction({
        quarantineId: retryTarget.id,
        reason: reason.trim(),
      });

      if (res.success) {
        setActionSuccess(`Sequence #${retryTarget.changeSequence} was successfully applied and resolved!`);
        setRetryTarget(null);
        setReason("");
        await refreshRecords();
      } else {
        if (res.result?.action === "RETRY_FAILED") {
          setActionError(
            `Retry failed deterministically: [${res.errorCode || "ERROR"}] ${res.error || "Execution failed"}. The change remains safely quarantined with updated error details.`
          );
          await refreshRecords();
        } else {
          setActionError(res.error || "Failed to retry quarantined change.");
        }
      }
    });
  };

  const handleDiscardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discardTarget) return;
    if (!reason.trim()) {
      setActionError("An auditable reason is required to discard a quarantined change.");
      return;
    }

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await discardQuarantineAction({
        quarantineId: discardTarget.id,
        reason: reason.trim(),
      });

      if (res.success) {
        setActionSuccess(`Sequence #${discardTarget.changeSequence} was discarded and cursor advanced.`);
        setDiscardTarget(null);
        setReason("");
        await refreshRecords();
      } else {
        setActionError(res.error || "Failed to discard quarantined change.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium text-sm">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 dark:text-emerald-400 hover:opacity-75 p-1 rounded cursor-pointer"
            aria-label="Dismiss alert"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && !retryTarget && !discardTarget && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconAlertOctagon className="w-5 h-5 text-red-600 dark:text-red-400" />
            <span className="font-medium text-sm">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-red-600 dark:text-red-400 hover:opacity-75 p-1 rounded cursor-pointer"
            aria-label="Dismiss alert"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sync Status Banner */}
      {activeCount > 0 ? (
        <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-500/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500 text-white rounded-xl shadow-md">
              <IconAlertOctagon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
                  <span>Sync Blocked by Quarantined Changes</span>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-red-200 dark:bg-red-900/60 text-red-800 dark:text-red-300">
                    {activeCount} Active
                  </span>
                </h2>
                <div className="text-xs font-mono px-2 py-1 bg-red-100 dark:bg-red-900/40 rounded text-red-800 dark:text-red-300">
                  Cursor Blocked At: #{earliestActive?.changeSequence}
                </div>
              </div>
              <p className="text-sm text-red-800 dark:text-red-300 mt-2 leading-relaxed">
                Deterministic synchronization errors have halted cloud pull operations. The sync cursor will{" "}
                <span className="font-semibold underline">not advance</span> past sequence #{earliestActive?.changeSequence} until
                the active item is reviewed and resolved by an Owner via Retry or Discard.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
              <IconCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 text-base">
                Sync Stream Clean & Unblocked
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                No active deterministic blocks exist. The local depot sync pull stream is running normally.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics & Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          {/* Status Tabs */}
          <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === "ALL"
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              All Records ({records.length})
            </button>
            <button
              onClick={() => setStatusFilter("QUARANTINED")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === "QUARANTINED"
                  ? "bg-white dark:bg-zinc-700 text-red-600 dark:text-red-400 shadow-sm"
                  : "text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
              }`}
            >
              <span>Active Blocking</span>
              <span className="px-1.5 py-0.2 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 rounded-full text-xs">
                {activeCount}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter("RESOLVED")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === "RESOLVED"
                  ? "bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              <span>Resolved</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-full text-xs">
                {resolvedCount}
              </span>
            </button>
          </div>

          <button
            onClick={refreshRecords}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>

        {/* Secondary Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-zinc-500 dark:text-zinc-400 font-medium mb-1">
              Operation Type
            </label>
            <select
              value={opTypeFilter}
              onChange={(e) => setOpTypeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Operations</option>
              {allOpTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-500 dark:text-zinc-400 font-medium mb-1">
              Error Code
            </label>
            <select
              value={errorCodeFilter}
              onChange={(e) => setErrorCodeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Error Codes</option>
              {allErrors.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-500 dark:text-zinc-400 font-medium mb-1">
              Created From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-zinc-500 dark:text-zinc-400 font-medium mb-1">
              Created To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Quarantine Records List */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-12 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <IconShield className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-200">
            No quarantine records match your criteria
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            {records.length === 0
              ? "The local quarantine table is currently empty."
              : "Try clearing or adjusting the status and date filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((item, idx) => {
            const isFirstActive = item.id === earliestActive?.id;
            const isResolved = item.status === QuarantineStatus.RESOLVED;
            const errorInfo = getBusinessErrorExplanation(item.errorCode);
            const isExpanded = expandedPayloadId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-zinc-900 rounded-2xl border transition-all shadow-sm overflow-hidden ${
                  isFirstActive
                    ? "border-red-500 dark:border-red-600 ring-2 ring-red-500/20"
                    : isResolved
                    ? "border-zinc-200 dark:border-zinc-800 opacity-90"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {/* Header Strip */}
                <div
                  className={`px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b ${
                    isResolved
                      ? "bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-100 dark:border-zinc-800"
                      : isFirstActive
                      ? "bg-red-50/60 dark:bg-red-950/20 border-red-100 dark:border-red-900/30"
                      : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100 bg-zinc-200/80 dark:bg-zinc-700/80 px-2 py-0.5 rounded">
                      Seq #{item.changeSequence}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                      {item.operationType}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono">
                      Action: {item.action}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isResolved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <IconCheck className="w-3.5 h-3.5" />
                        RESOLVED — NO LONGER BLOCKING
                      </span>
                    ) : isFirstActive ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse">
                        <IconAlertOctagon className="w-3.5 h-3.5" />
                        ACTIVE — HEAD OF BLOCKED QUEUE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <IconAlertTriangle className="w-3.5 h-3.5" />
                        ACTIVE — WAITING ON PRECEDING SEQUENCE
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-5 space-y-4">
                  {/* Business Error Banner */}
                  <div
                    className={`p-4 rounded-xl border ${
                      isResolved
                        ? "bg-zinc-50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                        : "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-900 dark:text-red-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 font-mono text-xs font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 uppercase shrink-0">
                        {item.errorCode}
                      </div>
                      <div className="space-y-1">
                        <div className="font-semibold text-sm">{errorInfo.title}</div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                          {errorInfo.explanation}
                        </div>
                        <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-1 break-all bg-white dark:bg-zinc-950/50 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                          {item.errorMessage}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl">
                    <div>
                      <span className="text-zinc-400 block font-medium">Entity ID</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate block" title={item.entityId}>
                        {item.entityId.slice(0, 8)}...{item.entityId.slice(-4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block font-medium">Operation ID</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate block" title={item.operationId}>
                        {item.operationId.slice(0, 8)}...{item.operationId.slice(-4)}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block font-medium">Source Device</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">
                        {item.sourceDeviceId || "cloud"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block font-medium">Quarantined At</span>
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {new Date(item.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Resolution Information (if resolved) */}
                  {isResolved && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
                          <IconCheck className="w-4 h-4" />
                          Resolution: {item.resolutionAction || "RESOLVED"}
                        </span>
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 font-medium">Auditable Reason: </span>
                        <span className="text-zinc-800 dark:text-zinc-200 italic font-medium">
                          &ldquo;{item.resolutionReason}&rdquo;
                        </span>
                      </div>
                      {item.resolvedByUser && (
                        <div className="text-xs text-zinc-500">
                          Resolved By: {item.resolvedByUser.name} ({item.resolvedByUser.role})
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expandable JSON Payload */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedPayloadId(isExpanded ? null : item.id)}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
                    >
                      <IconChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`} />
                      <span>{isExpanded ? "Hide Cloud Payload" : "View Cloud Payload"}</span>
                    </button>
                    {isExpanded && (
                      <pre className="mt-2 text-xs font-mono bg-zinc-900 text-zinc-100 p-3 rounded-xl overflow-x-auto max-h-60 border border-zinc-800">
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    )}
                  </div>

                  {/* Actions (Only if active) */}
                  {!isResolved && (
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="text-xs text-zinc-500">
                        {!isFirstActive ? (
                          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                            <IconAlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>You must resolve earlier sequence #{earliestActive?.changeSequence} first.</span>
                          </span>
                        ) : (
                          <span>Ready for Owner resolution.</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!isFirstActive}
                          onClick={() => {
                            setActionError(null);
                            setReason("");
                            setRetryTarget(item);
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            isFirstActive
                              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                          }`}
                        >
                          Retry Change
                        </button>

                        <button
                          type="button"
                          disabled={!isFirstActive}
                          onClick={() => {
                            setActionError(null);
                            setReason("");
                            setDiscardTarget(item);
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                            isFirstActive
                              ? "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                          }`}
                        >
                          Discard Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Retry Modal */}
      {retryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-lg w-full border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <IconShield className="w-5 h-5 text-blue-600" />
                Retry Quarantined Change #{retryTarget.changeSequence}
              </h3>
              <button
                type="button"
                onClick={() => setRetryTarget(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRetrySubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-200">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <IconInfo className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Retry Semantics:</span>
                </p>
                <p>
                  Retrying re-executes this change against the local database within the pull advisory lock.
                  If successful, the mutation is applied, recorded in local processed changes, and the sync cursor advances.
                  If the deterministic error persists, the change remains safely quarantined with updated error details.
                </p>
              </div>

              {actionError && (
                <div className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Auditable Resolution Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Created missing parent category locally, retrying product import..."
                  className="w-full text-xs p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRetryTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !reason.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm"
                >
                  {isPending ? "Retrying..." : "Confirm & Retry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discard Modal */}
      {discardTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-lg w-full border border-red-300 dark:border-red-900 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
              <h3 className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <IconAlertOctagon className="w-5 h-5 text-red-600" />
                Discard Quarantined Change #{discardTarget.changeSequence}
              </h3>
              <button
                type="button"
                onClick={() => setDiscardTarget(null)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <IconClose className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDiscardSubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-800 dark:text-red-200">
                <p className="font-bold mb-1 flex items-center gap-1.5">
                  <IconAlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span>Warning: Discard Is Permanent</span>
                </p>
                <p>
                  Discarding will record this change sequence as discarded in local processed records and advance
                  the sync cursor past it. The Cloud mutation will <span className="font-bold underline">NOT</span> be
                  applied to local depot records. This action cannot be undone.
                </p>
              </div>

              {actionError && (
                <div className="p-3 text-xs rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Mandatory Auditable Discard Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Authority violation: Cloud attempted unauthorized sale overwrite. Discarding per depot authority policy."
                  className="w-full text-xs p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDiscardTarget(null)}
                  className="px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !reason.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-sm"
                >
                  {isPending ? "Discarding..." : "Confirm & Discard"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
