"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/formatters";
import {
  IconServer,
  IconWifi,
  IconWifiOff,
  IconShield,
  IconAlertTriangle,
  IconCheckCircle,
  IconHistory,
  IconZap,
  IconClock,
  IconRefresh,
  IconClose,
  IconSearch,
  IconBox,
} from "@/components/ui/icons";
import {
  triggerManualSyncAction,
  retryOutboxOperationAction,
  retryAllFailedOperationsAction,
  ManualSyncResult,
} from "./actions";

export interface OutboxOperationItem {
  id: string;
  operationId: string;
  clientSequence: string;
  operationType: string;
  entityId: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "IN_FLIGHT" | "SYNCED" | "FAILED";
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  syncedAt: string | null;
}

export interface SyncStatusClientProps {
  outboxOperations: OutboxOperationItem[];
  outboxCounts: {
    total: number;
    unsynced: number;
    synced: number;
    failed: number;
    pending: number;
  };
  terminalInfo: {
    deviceId: string;
    cloudBaseUrl: string;
    isConfigured: boolean;
    appEnv: string;
  };
  devices: Array<{
    deviceId: string;
    name: string;
    isRevoked: boolean;
    lastSeenAt: string;
    lastSequence: string;
    createdAt: string;
  }>;
  cursor: {
    id: string;
    lastSequence: string;
    lastSyncedAt: string;
  } | null;
  quarantineCount: number;
  recentQuarantines: Array<{
    id: string;
    changeSequence: string;
    operationId: string;
    operationType: string;
    errorCode: string;
    errorMessage: string;
    createdAt: string;
    sourceDeviceId: string | null;
  }>;
  totalChanges: number;
  recentOperations: Array<{
    id: string;
    operationId: string;
    deviceId: string;
    clientSequence: string;
    operationType: string;
    entityId: string;
    status: string;
    errorMessage: string | null;
    processedAt: string;
  }>;
  health: {
    overallHealth: "HEALTHY" | "ATTENTION" | "DEGRADED";
    onlineDevicesCount: number;
    totalDevicesCount: number;
    activeWithin24hCount: number;
  };
}

export function SyncStatusClient({
  outboxOperations,
  outboxCounts,
  terminalInfo,
  devices,
  cursor,
  quarantineCount,
  recentQuarantines,
  totalChanges,
  recentOperations,
  health,
}: SyncStatusClientProps) {
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Retry state
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  // Filtering state
  const [activeTab, setActiveTab] = useState<"ALL" | "UNSYNCED" | "SYNCED" | "FAILED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Inspect Modal state
  const [inspectingOp, setInspectingOp] = useState<OutboxOperationItem | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Trigger Manual Push & Pull Sync
  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res: ManualSyncResult = await triggerManualSyncAction();
      if (res.success) {
        setSyncFeedback({
          type: "success",
          message: res.message,
        });
      } else if (res.isOffline) {
        setSyncFeedback({
          type: "warning",
          message: res.message,
        });
      } else {
        setSyncFeedback({
          type: "error",
          message: res.message,
        });
      }
    } catch (err: unknown) {
      setSyncFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Sync failed unexpectedly.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Retry single failed outbox operation
  const handleRetryOperation = async (opId: string) => {
    setRetryingId(opId);
    try {
      const res = await retryOutboxOperationAction(opId);
      if (res.success) {
        setSyncFeedback({
          type: "success",
          message:
            res.message ||
            `Operation #${opId.slice(0, 8)} reset to PENDING. Click 'Sync Now' to push it to Cloud.`,
        });
        if (inspectingOp?.operationId === opId) {
          setInspectingOp((prev) => (prev ? { ...prev, status: "PENDING", lastError: null } : null));
        }
      } else {
        setSyncFeedback({
          type: "error",
          message: res.error || "Failed to retry operation.",
        });
      }
    } catch (err: unknown) {
      setSyncFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Retry failed unexpectedly.",
      });
    } finally {
      setRetryingId(null);
    }
  };

  // Retry all failed outbox operations
  const handleRetryAllFailed = async () => {
    setIsRetryingAll(true);
    try {
      const res = await retryAllFailedOperationsAction();
      if (res.success) {
        setSyncFeedback({
          type: "success",
          message: res.message || "All failed operations have been reset to PENDING.",
        });
      } else {
        setSyncFeedback({
          type: "error",
          message: res.error || "Failed to reset operations.",
        });
      }
    } catch (err: unknown) {
      setSyncFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Reset failed unexpectedly.",
      });
    } finally {
      setIsRetryingAll(false);
    }
  };

  // Copy JSON payload
  const handleCopyPayload = (payload: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  // Helper for human-readable operation summary
  const getOperationSummary = (op: OutboxOperationItem): string => {
    const p = op.payload || {};
    switch (op.operationType) {
      case "POST_RECEIVING": {
        const items = Array.isArray(p.items) ? p.items : [];
        const totalCrates = items.reduce(
          (sum: number, it: any) => sum + (typeof it.quantity === "number" ? it.quantity : 0),
          0
        );
        const ref = p.referenceNumber ? ` Ref: ${p.referenceNumber}` : "";
        return totalCrates > 0 ? `Stock intake of ${totalCrates} crates${ref}` : `Receiving shipment${ref}`;
      }
      case "CREATE_SALE": {
        const inv = p.invoiceNumber ? `Inv #${p.invoiceNumber}` : "Sale";
        const amt = typeof p.totalAmount === "number" ? `Rs ${p.totalAmount.toLocaleString()}` : "";
        const type = p.saleType ? `(${p.saleType})` : "";
        return `${inv} • ${amt} ${type}`.trim();
      }
      case "EDIT_SALE": {
        const inv = p.invoiceNumber ? `Inv #${p.invoiceNumber}` : "Sale";
        const amt = typeof p.totalAmount === "number" ? `Rs ${p.totalAmount.toLocaleString()}` : "";
        return `Edited ${inv} • ${amt}`.trim();
      }
      case "CANCEL_SALE": {
        const inv = p.invoiceNumber ? `Inv #${p.invoiceNumber}` : "Sale";
        const reason = p.cancellationReason ? ` (${p.cancellationReason})` : "";
        return `Cancelled ${inv}${reason}`;
      }
      case "UPSERT_CUSTOMER": {
        const name = typeof p.name === "string" ? p.name : "Customer";
        const phone = typeof p.phone === "string" ? ` • ${p.phone}` : "";
        return `${name}${phone}`;
      }
      case "RECORD_PAYMENT": {
        const amt = typeof p.amount === "number" ? `Rs ${p.amount.toLocaleString()}` : "";
        const method = typeof p.paymentMethod === "string" ? p.paymentMethod : "CASH";
        return `Payment ${amt} via ${method}`;
      }
      case "CREATE_RETURN": {
        const reason = typeof p.reason === "string" ? p.reason : "Quarantined stock return";
        return `Return: ${reason}`;
      }
      case "RECORD_DAMAGE": {
        const qty = typeof p.quantity === "number" ? `${p.quantity} crates` : "";
        const type = typeof p.damageType === "string" ? p.damageType : "Write-off";
        return `Damage write-off: ${qty} (${type})`;
      }
      default:
        return `Entity ID: ${op.entityId.slice(0, 8)}...`;
    }
  };

  // Operation Type styling
  const getOperationTypeBadge = (type: string) => {
    switch (type) {
      case "CREATE_SALE":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700";
      case "EDIT_SALE":
        return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-300 dark:border-sky-700";
      case "CANCEL_SALE":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-700";
      case "POST_RECEIVING":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700";
      case "UPSERT_CUSTOMER":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-700";
      case "RECORD_PAYMENT":
        return "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-700";
      case "CREATE_RETURN":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-700";
      case "RECORD_DAMAGE":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-300 dark:border-orange-700";
      default:
        return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700";
    }
  };

  // Filter outbox operations
  const filteredOperations = outboxOperations.filter((op) => {
    // 1. Tab filter
    if (activeTab === "UNSYNCED") {
      if (op.status === "SYNCED") return false;
    } else if (activeTab === "SYNCED") {
      if (op.status !== "SYNCED") return false;
    } else if (activeTab === "FAILED") {
      if (op.status !== "FAILED") return false;
    }

    // 2. Type filter
    if (selectedType !== "ALL" && op.operationType !== selectedType) {
      return false;
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSeq = op.clientSequence.includes(q);
      const matchesType = op.operationType.toLowerCase().includes(q);
      const matchesEntity = op.entityId.toLowerCase().includes(q);
      const matchesOpId = op.operationId.toLowerCase().includes(q);
      const summary = getOperationSummary(op).toLowerCase();
      const matchesSummary = summary.includes(q);
      const matchesError = (op.lastError || "").toLowerCase().includes(q);
      if (!matchesSeq && !matchesType && !matchesEntity && !matchesOpId && !matchesSummary && !matchesError) {
        return false;
      }
    }

    return true;
  });

  // Extract unique operation types present in the outbox
  const availableTypes = Array.from(new Set(outboxOperations.map((op) => op.operationType))).sort();

  return (
    <div className="space-y-8">
      {/* ─── Top Header & Primary Sync Actions ────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
              Offline-First Sync Engine
            </span>
            <span className="text-xs text-zinc-500">
              {terminalInfo.appEnv === "LOCAL" ? "Local Depot Node" : "Cloud Replication"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight mt-1.5">
            Depot Sync Center &amp; Local Ledger
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Monitor synchronized and unsynced operations, inspect local queued changes, and trigger manual synchronization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Manual Sync Button */}
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
              isSyncing
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:scale-95"
            }`}
            title="Push local pending mutations and pull cloud updates"
          >
            <IconRefresh className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Synchronizing..." : "Sync Now (Push & Pull)"}</span>
          </button>

          {/* Quarantine Manager Button */}
          <Link
            href="/sync/quarantine"
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              quarantineCount > 0
                ? "bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                : "border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            }`}
          >
            <IconAlertTriangle className="w-4 h-4" />
            <span>Quarantine ({quarantineCount})</span>
          </Link>
        </div>
      </div>

      {/* ─── Sync Feedback Toast / Banner ─────────────────────────────────── */}
      {syncFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 shadow-xs transition-all ${
            syncFeedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : syncFeedback.type === "warning"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {syncFeedback.type === "success" ? (
              <IconCheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : syncFeedback.type === "warning" ? (
              <IconWifiOff className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <IconAlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {syncFeedback.type === "success"
                  ? "Synchronization Complete"
                  : syncFeedback.type === "warning"
                  ? "Offline / Network Notice"
                  : "Synchronization Alert"}
              </h4>
              <p className="text-xs mt-0.5 font-medium">{syncFeedback.message}</p>
            </div>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-zinc-500"
          >
            <IconClose className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── KPI Metrics Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Unsynced Operations Card */}
        <div
          className={`rounded-2xl p-5 border shadow-xs space-y-2 transition-all ${
            outboxCounts.unsynced > 0
              ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80"
              : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                outboxCounts.unsynced > 0
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-zinc-500"
              }`}
            >
              Unsynced Operations
            </span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                outboxCounts.unsynced > 0
                  ? "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {outboxCounts.unsynced > 0 ? (
                <IconClock className="w-4 h-4" />
              ) : (
                <IconCheckCircle className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            {outboxCounts.unsynced}
          </div>
          <div className="text-xs text-zinc-500 flex items-center gap-2">
            {outboxCounts.unsynced > 0 ? (
              <>
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  {outboxCounts.pending} Pending
                </span>
                {outboxCounts.failed > 0 && (
                  <span className="font-semibold text-rose-600">
                    • {outboxCounts.failed} Failed
                  </span>
                )}
              </>
            ) : (
              <span className="text-emerald-600 font-semibold">
                ✓ All local operations synced
              </span>
            )}
          </div>
        </div>

        {/* Synced Operations Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Synced Operations
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconCheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            {outboxCounts.synced.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500">
            Confirmed by Cloud • Total {outboxCounts.total} recorded
          </div>
        </div>

        {/* Local Sync Cursor Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Cloud Pull Cursor
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <IconHistory className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50 font-mono">
            #{cursor?.lastSequence || "0"}
          </div>
          <div className="text-xs text-zinc-500 truncate">
            Last pull: {cursor ? formatDateTime(cursor.lastSyncedAt) : "Never"}
          </div>
        </div>

        {/* Terminal & Target Endpoint Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Terminal Identity
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IconServer className="w-4 h-4" />
            </div>
          </div>
          <div className="text-base font-black text-zinc-900 dark:text-zinc-50 truncate font-mono">
            {terminalInfo.deviceId}
          </div>
          <div className="text-xs text-zinc-500 truncate" title={terminalInfo.cloudBaseUrl}>
            Target: {terminalInfo.cloudBaseUrl}
          </div>
        </div>
      </div>

      {/* ─── Local Operations Ledger (Sync & Unsynced Table) ─────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs space-y-4 p-5">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Local Operations Ledger</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                {outboxOperations.length} records
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Mutations recorded locally on this terminal waiting to be synced or confirmed by Cloud.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {outboxCounts.failed > 0 && (
              <button
                onClick={handleRetryAllFailed}
                disabled={isRetryingAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs"
              >
                <IconRefresh className={`w-3.5 h-3.5 ${isRetryingAll ? "animate-spin" : ""}`} />
                <span>Retry Failed ({outboxCounts.failed})</span>
              </button>
            )}

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-all"
            >
              <IconRefresh className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Syncing..." : "Sync Ledger"}</span>
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Filter Tabs */}
          <div className="inline-flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 self-start">
            <button
              onClick={() => setActiveTab("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "ALL"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              All ({outboxCounts.total})
            </button>
            <button
              onClick={() => setActiveTab("UNSYNCED")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === "UNSYNCED"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <span>Unsynced</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  outboxCounts.unsynced > 0
                    ? "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300"
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {outboxCounts.unsynced}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("SYNCED")}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === "SYNCED"
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs"
                  : "hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              Synced ({outboxCounts.synced})
            </button>
            {outboxCounts.failed > 0 && (
              <button
                onClick={() => setActiveTab("FAILED")}
                className={`px-3 py-1.5 rounded-lg transition-all text-rose-600 dark:text-rose-400 ${
                  activeTab === "FAILED"
                    ? "bg-white dark:bg-zinc-900 shadow-xs font-black"
                    : "hover:text-rose-700"
                }`}
              >
                Failed ({outboxCounts.failed})
              </button>
            )}
          </div>

          {/* Search & Operation Type Dropdown */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <IconSearch className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search sequence, entity, invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <IconClose className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Type Dropdown */}
            {availableTypes.length > 0 && (
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Types</option>
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Outbox Operations Table */}
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/50 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                <th className="py-3 px-5">Seq #</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Operation Type</th>
                <th className="py-3 px-5">Transaction Details</th>
                <th className="py-3 px-5">Created At</th>
                <th className="py-3 px-5">Synced At</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {filteredOperations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <IconBox className="w-8 h-8 text-zinc-400 stroke-[1.5]" />
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                        No operations match the selected criteria.
                      </p>
                      <p className="text-xs text-zinc-500">
                        {activeTab === "UNSYNCED"
                          ? "All local operations have been successfully synchronized to Cloud!"
                          : "New local transactions will appear here as they are performed."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOperations.map((op) => {
                  const summary = getOperationSummary(op);
                  const typeClass = getOperationTypeBadge(op.operationType);

                  return (
                    <tr
                      key={op.id}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      {/* Client Sequence */}
                      <td className="py-3.5 px-5 font-mono font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                        #{op.clientSequence}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        {op.status === "SYNCED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                            <IconCheckCircle className="w-3 h-3" />
                            <span>Synced</span>
                          </span>
                        ) : op.status === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                            <IconClock className="w-3 h-3" />
                            <span>Unsynced (Pending)</span>
                          </span>
                        ) : op.status === "IN_FLIGHT" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-700 animate-pulse">
                            <IconRefresh className="w-3 h-3 animate-spin" />
                            <span>Syncing...</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                            <IconAlertTriangle className="w-3 h-3" />
                            <span>Failed (Blocked)</span>
                          </span>
                        )}
                      </td>

                      {/* Operation Type */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${typeClass}`}
                        >
                          {op.operationType}
                        </span>
                      </td>

                      {/* Summary & Entity ID */}
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                          {summary}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400 mt-0.5 truncate">
                          ID: {op.entityId}
                        </div>
                        {op.status === "FAILED" && op.lastError && (
                          <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 mt-1 line-clamp-1">
                            Error: {op.lastError}
                          </div>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-5 whitespace-nowrap font-mono text-zinc-600 dark:text-zinc-400">
                        {formatDateTime(op.createdAt)}
                      </td>

                      {/* Synced At */}
                      <td className="py-3.5 px-5 whitespace-nowrap font-mono text-zinc-500">
                        {op.syncedAt ? (
                          formatDateTime(op.syncedAt)
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 font-sans italic">
                            Pending sync
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {op.status === "FAILED" && (
                            <button
                              onClick={() => handleRetryOperation(op.operationId)}
                              disabled={retryingId === op.operationId}
                              className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-2xs"
                              title="Reset status to PENDING"
                            >
                              {retryingId === op.operationId ? "Retrying..." : "Retry"}
                            </button>
                          )}

                          <button
                            onClick={() => setInspectingOp(op)}
                            className="px-2.5 py-1 rounded-md text-xs font-bold border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all"
                          >
                            Inspect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Inspect Operation Modal / Drawer ─────────────────────────────── */}
      {inspectingOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                    Seq #{inspectingOp.clientSequence}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${getOperationTypeBadge(
                      inspectingOp.operationType
                    )}`}
                  >
                    {inspectingOp.operationType}
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                  Operation Inspection &amp; Payload
                </h3>
              </div>
              <button
                onClick={() => setInspectingOp(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 font-mono">
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase">Operation ID</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-bold select-all">
                    {inspectingOp.operationId}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase">Entity ID</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-bold select-all">
                    {inspectingOp.entityId}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase">Status</span>
                  <span
                    className={`font-bold ${
                      inspectingOp.status === "SYNCED"
                        ? "text-emerald-600"
                        : inspectingOp.status === "FAILED"
                        ? "text-rose-600"
                        : "text-amber-600"
                    }`}
                  >
                    {inspectingOp.status} (Retries: {inspectingOp.retryCount})
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block text-[10px] uppercase">Created At</span>
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {formatDateTime(inspectingOp.createdAt)}
                  </span>
                </div>
                {inspectingOp.syncedAt && (
                  <div className="col-span-2">
                    <span className="text-zinc-400 block text-[10px] uppercase">Confirmed Synced At</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatDateTime(inspectingOp.syncedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Error Notice if FAILED */}
              {inspectingOp.lastError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <IconAlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Last Sync Error</span>
                  </div>
                  <p className="font-mono text-xs">{inspectingOp.lastError}</p>
                </div>
              )}

              {/* JSON Payload Viewer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-zinc-700 dark:text-zinc-300">Mutation Payload</span>
                  <button
                    onClick={() => handleCopyPayload(inspectingOp.payload)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {copiedPayload ? "✓ Copied to Clipboard" : "Copy JSON"}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-zinc-950 text-zinc-100 font-mono text-[11px] overflow-x-auto max-h-60 border border-zinc-800">
                  {JSON.stringify(inspectingOp.payload, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                {inspectingOp.status === "SYNCED"
                  ? "Operation is permanently synced."
                  : "Operation will be processed in sequence order."}
              </span>
              <div className="flex items-center gap-2">
                {inspectingOp.status === "FAILED" && (
                  <button
                    onClick={() => handleRetryOperation(inspectingOp.operationId)}
                    disabled={retryingId === inspectingOp.operationId}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs"
                  >
                    {retryingId === inspectingOp.operationId ? "Retrying..." : "Retry This Operation"}
                  </button>
                )}
                <button
                  onClick={() => setInspectingOp(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Registered Depot Devices Table (Cloud & Network Health) ─────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Registered Depot Devices
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Local Windows point-of-sale terminals configured to synchronize business data.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                <th className="py-3 px-5">Device Name</th>
                <th className="py-3 px-5">Device ID</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5">Last Heartbeat / Sync</th>
                <th className="py-3 px-5 text-right">Last Client Sequence</th>
                <th className="py-3 px-5">Registered Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    No depot devices registered yet. Devices are registered automatically upon their initial sync push.
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const isRevoked = device.isRevoked;
                  const diffMin = (Date.now() - new Date(device.lastSeenAt).getTime()) / (1000 * 60);
                  const isOnline = !isRevoked && diffMin <= 10;
                  const isIdle = !isRevoked && diffMin <= 1440;

                  return (
                    <tr
                      key={device.deviceId}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="py-3.5 px-5 font-bold text-zinc-900 dark:text-zinc-100">
                        {device.name}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-zinc-500">
                        {device.deviceId}
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            isRevoked
                              ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                              : isOnline
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : isIdle
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          ● {isRevoked ? "REVOKED" : isOnline ? "ONLINE" : isIdle ? "IDLE (24h)" : "OFFLINE"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs">
                        {formatDateTime(device.lastSeenAt)}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        #{device.lastSequence}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-500 text-xs">
                        {formatDateTime(device.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Quarantined Records Notice (if any) ─────────────────────────── */}
      {recentQuarantines.length > 0 && (
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Pending Quarantined Operations ({quarantineCount})
              </h3>
            </div>
            <Link
              href="/sync/quarantine"
              className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline"
            >
              Open Quarantine Manager →
            </Link>
          </div>

          <div className="divide-y divide-amber-200/60 dark:divide-amber-900/30 text-xs">
            {recentQuarantines.map((q) => (
              <div
                key={q.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      Seq #{q.changeSequence}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-mono text-xs">
                      {q.operationType}
                    </span>
                    <span className="text-xs text-red-600 font-semibold">[{q.errorCode}]</span>
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {q.errorMessage}
                  </div>
                </div>
                <div className="text-xs text-zinc-500 font-mono">{formatDateTime(q.createdAt)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Recent Inbound Cloud Replication Activity ───────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs space-y-4 p-5">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Recent Cloud Inbound Replication Activity
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Last operations transmitted from depot terminals and acknowledged in Cloud.
          </p>
        </div>

        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                <th className="py-3 px-5">Processed At</th>
                <th className="py-3 px-5">Device</th>
                <th className="py-3 px-5">Operation Type</th>
                <th className="py-3 px-5">Entity ID</th>
                <th className="py-3 px-5 text-right">Client Seq</th>
                <th className="py-3 px-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {recentOperations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    No cloud sync activity logged yet.
                  </td>
                </tr>
              ) : (
                recentOperations.map((op) => (
                  <tr
                    key={op.id}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="py-3 px-5 font-mono text-xs whitespace-nowrap">
                      {formatDateTime(op.processedAt)}
                    </td>
                    <td className="py-3 px-5 font-mono text-xs text-zinc-500">
                      {op.deviceId}
                    </td>
                    <td className="py-3 px-5">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {op.operationType}
                      </span>
                    </td>
                    <td className="py-3 px-5 font-mono text-xs text-zinc-500">
                      {op.entityId.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-5 text-right font-mono">
                      #{op.clientSequence}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          op.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {op.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
