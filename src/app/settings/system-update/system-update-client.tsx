"use client";

import { useState, useCallback } from "react";
import type { SystemVersionInfo } from "@/lib/version/service";
import { IconServer, IconShield, IconCheck, IconRotateCcw, IconZap, IconRocket, IconWifiOff, IconArrowUp } from "@/components/ui/icons";

export function SystemUpdateClient({
  initialData,
  isOwner,
}: {
  initialData: SystemVersionInfo;
  isOwner: boolean;
}) {
  const [data, setData] = useState<SystemVersionInfo>(initialData);
  const [scanning, setScanning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pollCountdown, setPollCountdown] = useState<number | null>(null);

  const handleScan = useCallback(async () => {
    try {
      setScanning(true);
      const res = await fetch("/api/system/version?scan=true", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Ignore network errors during scan
    } finally {
      setScanning(false);
    }
  }, []);

  const pollServerForRestart = useCallback(() => {
    let attempts = 0;
    const maxAttempts = 35;
    setPollCountdown(35);

    const timer = setInterval(async () => {
      attempts++;
      setPollCountdown((prev) => (prev && prev > 1 ? prev - 1 : null));

      try {
        const res = await fetch("/health", { cache: "no-store" });
        if (res.ok) {
          clearInterval(timer);
          setStatusMessage("System successfully updated and reconnected! Reloading in 2 seconds...");
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch {
        // Still rebuilding/restarting
      }

      if (attempts >= maxAttempts) {
        clearInterval(timer);
        setStatusMessage("Update completed. Please refresh your browser.");
        setUpdating(false);
      }
    }, 2000);
  }, []);

  const handleUpdate = async () => {
    if (!isOwner) return;
    if (
      !confirm(
        "Are you sure you want to pull and install the latest update? The background services will rebuild and restart automatically."
      )
    ) {
      return;
    }

    try {
      setUpdating(true);
      setStatusMessage("Dispatching update command to server...");

      const res = await fetch("/api/system/update", {
        method: "POST",
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setStatusMessage("Update initiated: Pulling latest changes from GitHub & compiling production build. Services will restart shortly.");
        setTimeout(() => {
          pollServerForRestart();
        }, 8000);
      } else {
        setStatusMessage(json.message || "Failed to initiate update.");
        setUpdating(false);
      }
    } catch {
      setStatusMessage("Update command dispatched. Probing server health for restart...");
      setTimeout(() => {
        pollServerForRestart();
      }, 8000);
    }
  };

  const isUpdateAvailable = data.status === "UPDATE_AVAILABLE";
  const shortSha = data.local.shortHash;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
              System Administration
            </span>
            <span className="text-xs text-zinc-500">
              Platform: <strong className="text-zinc-700 dark:text-zinc-300">{data.environment}</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">
            System Updates &amp; Repository Scanner
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Scan remote GitHub for new releases, verify code integrity, and deploy updates directly from this interface.
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning || updating}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-2xs"
          >
            {scanning ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                <span>Scanning GitHub...</span>
              </>
            ) : (
              <>
                <IconRotateCcw className="w-3.5 h-3.5" />
                <span>Scan for Updates</span>
              </>
            )}
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={handleUpdate}
              disabled={updating || scanning}
              className={`px-5 py-2 text-xs font-bold rounded-xl text-white shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 ${
                isUpdateAvailable
                  ? "bg-amber-600 hover:bg-amber-500 animate-pulse shadow-amber-500/25 ring-2 ring-amber-500/30"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {updating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Updating System...</span>
                </>
              ) : (
                <>
                  <IconZap className="w-3.5 h-3.5" />
                  <span>{isUpdateAvailable ? "Update to Latest Release" : "Force Pull & Rebuild"}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Status Alert Banner */}
      {isUpdateAvailable ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <IconRocket className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-950 dark:text-amber-100">
                New Version Available on GitHub
              </h2>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Remote branch <b>origin/main</b> has new commits. Your deployment is at <b>{shortSha}</b> while remote is at <b>{data.remote?.shortHash}</b>.
              </p>
            </div>
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={handleUpdate}
              disabled={updating}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors shrink-0 shadow-xs cursor-pointer"
            >
              Update Now →
            </button>
          )}
        </div>
      ) : data.status === "OFFLINE" ? (
        <div className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 rounded-2xl p-5 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
            <IconWifiOff className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Offline Mode — GitHub Remote Unreachable
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              The application is operating normally on local database and running commit <b>{shortSha}</b>. Remote check will resume once internet is restored.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-5 shadow-2xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <IconCheck className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-emerald-950 dark:text-emerald-100">
              Repository is at Latest Commit
            </h2>
            <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
              Your installation matches commit <b>{shortSha}</b> on <b>origin/main</b>. Zero pending updates required.
            </p>
          </div>
        </div>
      )}

      {/* Progress & Live Update Notice */}
      {statusMessage && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 space-y-2 shadow-xs">
          <div className="flex items-center gap-2.5 font-bold text-sm">
            {updating && <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />}
            <span>{statusMessage}</span>
          </div>
          {pollCountdown !== null && (
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Polling web server health (reconnect attempt {36 - pollCountdown}/35)...
            </p>
          )}
        </div>
      )}

      {/* Side-by-Side Version Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Card: Currently Deployed Version */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <IconServer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Currently Running Code
              </h2>
            </div>
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
              Branch: {data.branch}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-zinc-400 uppercase font-bold text-[10px] tracking-wider block">Commit SHA</span>
              <span className="font-mono text-base font-black text-blue-600 dark:text-blue-400 select-all">
                {data.local.hash}
              </span>
            </div>

            <div>
              <span className="text-zinc-400 uppercase font-bold text-[10px] tracking-wider block">Commit Message</span>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {data.local.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Committed By</span>
                <b className="text-zinc-900 dark:text-zinc-100">{data.local.author}</b>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Committed Date</span>
                <b className="text-zinc-900 dark:text-zinc-100">
                  {new Date(data.local.date).toLocaleString()}
                </b>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Remote GitHub Repository */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <IconShield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Remote GitHub (origin/main)
              </h2>
            </div>
            {data.remote && (
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  isUpdateAvailable
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                }`}
              >
                {isUpdateAvailable ? (
                  <>
                    <IconArrowUp className="w-3 h-3" />
                    <span>Newer Commit Available</span>
                  </>
                ) : (
                  <>
                    <IconCheck className="w-3 h-3" />
                    <span>In Sync</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-zinc-400 uppercase font-bold text-[10px] tracking-wider block">Remote Commit SHA</span>
              <span className="font-mono text-base font-black text-purple-600 dark:text-purple-400 select-all">
                {data.remote?.hash || (data.status === "OFFLINE" ? "Offline" : "Unknown")}
              </span>
            </div>

            <div>
              <span className="text-zinc-400 uppercase font-bold text-[10px] tracking-wider block">Latest Message</span>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                {data.remote?.message || (data.status === "OFFLINE" ? "GitHub unreachable" : "Scanning...")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Committed By</span>
                <b className="text-zinc-900 dark:text-zinc-100">{data.remote?.author || "GitHub"}</b>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Remote Date</span>
                <b className="text-zinc-900 dark:text-zinc-100">
                  {data.remote?.date ? new Date(data.remote.date).toLocaleString() : "—"}
                </b>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Commit History / Changelog */}
      {data.recentCommits && data.recentCommits.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Recent Deployment Changelog
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Commit history and recent software changes recorded in local git log.
              </p>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              Last scan: {new Date(data.lastCheckedAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {data.recentCommits.map((c, idx) => (
              <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400">
                    {c.shortHash}
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {c.message}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-zinc-400 text-[11px] shrink-0">
                  <span>{c.author}</span>
                  <span>&bull;</span>
                  <span>{c.relativeDate}</span>
                  {idx === 0 && (
                    <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                      CURRENT
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
