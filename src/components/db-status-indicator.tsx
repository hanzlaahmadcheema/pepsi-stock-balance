"use client";

import { useState, useEffect, useCallback } from "react";

type DbState = "checking" | "ok" | "error";

interface StatusPayload {
  local: { ok: boolean; latencyMs: number | null };
  cloud: { ok: boolean; latencyMs: number | null };
}

const POLL_INTERVAL_MS = 15_000; // re-check every 15 seconds

export function DbStatusIndicator() {
  const [local, setLocal] = useState<DbState>("checking");
  const [cloud, setCloud] = useState<DbState>("checking");
  const [localMs, setLocalMs] = useState<number | null>(null);
  const [cloudMs, setCloudMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/db-status", { cache: "no-store" });
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
      setLastChecked(new Date());
    } catch {
      setLocal("error");
      setCloud("error");
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [check]);

  return (
    <div className="hidden sm:flex items-center gap-1.5" title={lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : "Checking…"}>
      <Pill
        label="Local DB"
        state={local}
        latencyMs={localMs}
        title={`Local PostgreSQL — ${local === "ok" ? `${localMs}ms` : local === "error" ? "unreachable" : "checking…"}`}
      />
      <Pill
        label="Cloud"
        state={cloud}
        latencyMs={cloudMs}
        title={`Supabase Cloud — ${cloud === "ok" ? `${cloudMs}ms` : cloud === "error" ? "unreachable" : "checking…"}`}
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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold leading-none cursor-default select-none transition-colors ${pill}`}
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
