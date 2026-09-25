"use client";

import { useState, useEffect, useCallback } from "react";

type DbState = "checking" | "ok" | "error";

interface StatusPayload {
  local: { ok: boolean; latencyMs: number | null };
  cloud: { ok: boolean; latencyMs: number | null };
  sync?: { pendingCount: number };
}

const POLL_INTERVAL_MS = 10_000; // re-check every 10 seconds

export function DbStatusIndicator() {
  const [local, setLocal] = useState<DbState>("checking");
  const [cloud, setCloud] = useState<DbState>("checking");
  const [localMs, setLocalMs] = useState<number | null>(null);
  const [cloudMs, setCloudMs] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = useCallback(async () => {
    // If the browser knows we are offline, immediately reflect cloud error
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setCloud("error");
      setCloudMs(null);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await fetch("/api/db-status", {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        setLocal("error");
        setCloud("error");
        return;
      }
      const data: StatusPayload = await res.json();
      setLocal(data.local.ok ? "ok" : "error");
      setCloud(data.cloud.ok ? "ok" : "error");
      setLocalMs(data.local.latencyMs);
      setCloudMs(data.cloud.latencyMs);
      if (typeof data.sync?.pendingCount === "number") {
        setPendingCount(data.sync.pendingCount);
      }
      setLastChecked(new Date());
    } catch {
      clearTimeout(timeoutId);
      // If offline or request timed out, mark cloud as unreachable
      setCloud("error");
      setCloudMs(null);
    }
  }, []);

  useEffect(() => {
    check();

    const handleOnline = () => {
      check();
    };

    const handleOffline = () => {
      setCloud("error");
      setCloudMs(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [check]);

  return (
    <div
      className="hidden sm:flex items-center gap-1.5"
      title={lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : "Checking…"}
    >
      <Pill
        label="Local DB"
        state={local}
        latencyMs={localMs}
        title={`Local PostgreSQL — ${
          local === "ok" ? `${localMs}ms` : local === "error" ? "unreachable" : "checking…"
        }`}
      />
      <Pill
        label="Cloud"
        state={cloud}
        latencyMs={cloudMs}
        title={`Supabase Cloud — ${
          cloud === "ok" ? `${cloudMs}ms` : cloud === "error" ? "offline / unreachable" : "checking…"
        }`}
      />
      <SyncPill
        pendingCount={pendingCount}
        cloudState={cloud}
      />
    </div>
  );
}

function Pill({
  label,
  state,
  latencyMs,
  title,
}: {
  label: string;
  state: DbState;
  latencyMs: number | null;
  title: string;
}) {
  const dot =
    state === "ok"
      ? "bg-emerald-500"
      : state === "error"
      ? "bg-red-500"
      : "bg-amber-400 animate-pulse";

  const pill =
    state === "ok"
      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
      : state === "error"
      ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
      : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300";

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold leading-none cursor-default select-none transition-colors ${pill}`}
      title={title}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span>{label}</span>
      {state === "ok" && latencyMs !== null && (
        <span className="opacity-60">{latencyMs}ms</span>
      )}
    </div>
  );
}

function SyncPill({
  pendingCount,
  cloudState,
}: {
  pendingCount: number;
  cloudState: DbState;
}) {
  if (pendingCount > 0) {
    return (
      <div
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold leading-none cursor-default select-none transition-colors bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300"
        title={`${pendingCount} operation(s) waiting to sync to Cloud`}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500 animate-pulse" />
        <span>{pendingCount} Pending</span>
      </div>
    );
  }

  if (cloudState === "ok") {
    return (
      <div
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold leading-none cursor-default select-none transition-colors bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
        title="All local operations are synchronized with Cloud"
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
        <span>Synced</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold leading-none cursor-default select-none transition-colors bg-zinc-100 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
      title="Depot is offline. Changes are saved locally and will sync when reconnected."
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-400" />
      <span>Offline</span>
    </div>
  );
}
