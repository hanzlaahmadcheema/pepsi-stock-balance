"use client";

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
} from "@/components/ui/icons";

interface SyncStatusClientProps {
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
  devices,
  cursor,
  quarantineCount,
  recentQuarantines,
  totalChanges,
  recentOperations,
  health,
}: SyncStatusClientProps) {
  const getDeviceStatus = (lastSeenAtStr: string, isRevoked: boolean) => {
    if (isRevoked) {
      return {
        label: "REVOKED",
        className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        online: false,
      };
    }
    const diffMin = (Date.now() - new Date(lastSeenAtStr).getTime()) / (1000 * 60);
    if (diffMin <= 10) {
      return {
        label: "ONLINE",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        online: true,
      };
    }
    if (diffMin <= 1440) {
      return {
        label: "IDLE (24h)",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        online: false,
      };
    }
    return {
      label: "OFFLINE",
      className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
      online: false,
    };
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
              Edge Replication Engine
            </span>
            <span className="text-xs text-zinc-500">
              Bi-directional Offline-First Synchronization
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight mt-1.5">
            Depot Sync &amp; Device Health
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Real-time status of local Windows depot terminals, changelog replication, and operation processing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/sync/quarantine"
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
              quarantineCount > 0
                ? "bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                : "border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            }`}
          >
            <IconAlertTriangle className="w-4 h-4" />
            <span>Quarantine Manager ({quarantineCount})</span>
          </Link>
        </div>
      </div>

      {/* Sync Health Banner */}
      <div
        className={`p-6 rounded-2xl border shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${
          health.overallHealth === "HEALTHY"
            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
            : health.overallHealth === "ATTENTION"
            ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              health.overallHealth === "HEALTHY"
                ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300"
                : health.overallHealth === "ATTENTION"
                ? "bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300"
                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {health.overallHealth === "HEALTHY" ? (
              <IconCheckCircle className="w-6 h-6" />
            ) : health.overallHealth === "ATTENTION" ? (
              <IconAlertTriangle className="w-6 h-6" />
            ) : (
              <IconWifiOff className="w-6 h-6" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {health.overallHealth === "HEALTHY"
                ? "Replication Network Healthy"
                : health.overallHealth === "ATTENTION"
                ? "Action Required: Quarantined Records"
                : "No Active Depot Terminals Connected"}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
              {health.overallHealth === "HEALTHY"
                ? "All inbound transactional logs from the Windows Depot are processed. Zero quarantine errors recorded."
                : health.overallHealth === "ATTENTION"
                ? `${quarantineCount} operations encountered validation or conflict discrepancies and require inspection in the Quarantine Manager.`
                : "Depot terminal has not communicated within the last 24 hours. Ensure Windows background sync daemon is running."}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-left md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-zinc-200 dark:border-zinc-800">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block">
            Cloud Sync Cursor
          </span>
          <span className="font-mono text-sm font-bold text-zinc-800 dark:text-zinc-200 block mt-0.5">
            Sequence #{cursor?.lastSequence || "0"}
          </span>
          <span className="text-xs text-zinc-500 block mt-0.5">
            Last Synced: {cursor ? formatDateTime(cursor.lastSyncedAt) : "Never"}
          </span>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Connected Devices */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Depot Devices
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IconServer className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            {health.onlineDevicesCount} / {health.totalDevicesCount}
          </div>
          <div className="text-xs text-zinc-500">
            Online within 10 minutes ({health.activeWithin24hCount} active today)
          </div>
        </div>

        {/* Global Changelog Sequence */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Changelog Entries
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <IconHistory className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
            {totalChanges.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500">
            Global ordered replication sequence records
          </div>
        </div>

        {/* Quarantine Alerts */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Quarantined Changes
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <IconAlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-2xl font-black ${
              quarantineCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"
            }`}
          >
            {quarantineCount}
          </div>
          <div className="text-xs text-zinc-500">
            {quarantineCount === 0 ? "Zero pending conflicts" : "Requires manual review"}
          </div>
        </div>

        {/* Sync Security & Tokens */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Authentication
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <IconShield className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            HMAC-SHA256
          </div>
          <div className="text-xs text-zinc-500">
            Bearer tokens hashed and validated per request
          </div>
        </div>
      </div>

      {/* Connected Depot Devices Table */}
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
                  const status = getDeviceStatus(device.lastSeenAt, device.isRevoked);
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
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${status.className}`}
                        >
                          ● {status.label}
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

      {/* Quarantined Records Notice (if any) */}
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
              <div key={q.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      Seq #{q.changeSequence}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-mono text-xs">
                      {q.operationType}
                    </span>
                    <span className="text-xs text-red-600 font-semibold">
                      [{q.errorCode}]
                    </span>
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {q.errorMessage}
                  </div>
                </div>
                <div className="text-xs text-zinc-500 font-mono">
                  {formatDateTime(q.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Processed Operations Feed */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs space-y-4 p-5">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            Recent Inbound Replication Activity
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Last operations transmitted from the local depot terminals and applied into the cloud database.
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
                    No sync activity logged yet.
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
