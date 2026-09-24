"use client";

import { useState, useEffect, useCallback } from "react";
import type { SystemVersionInfo } from "@/lib/version/service";

export function SystemVersionPill({ isOwner = false }: { isOwner?: boolean }) {
  const [data, setData] = useState<SystemVersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pollCountdown, setPollCountdown] = useState<number | null>(null);

  const fetchVersion = useCallback(async (forceScan = false) => {
    try {
      if (forceScan) setScanning(true);
      const res = await fetch(`/api/system/version${forceScan ? "?scan=true" : ""}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Ignore background fetch errors
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    fetchVersion(false);
    // Auto-scan periodically every 2 minutes
    const interval = setInterval(() => {
      fetchVersion(false);
    }, 120_000);
    return () => clearInterval(interval);
  }, [fetchVersion]);

  // Poll server health after update initiated
  const pollServerForRestart = useCallback(() => {
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s
    setPollCountdown(30);

    const timer = setInterval(async () => {
      attempts++;
      setPollCountdown((prev) => (prev && prev > 1 ? prev - 1 : null));

      try {
        const res = await fetch("/health", { cache: "no-store" });
        if (res.ok) {
          clearInterval(timer);
          setStatusMessage("System successfully updated and reconnected! Reloading page...");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch {
        // Still restarting
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
    if (!confirm("Are you sure you want to update the system to the latest commit? Services will briefly rebuild and restart.")) {
      return;
    }

    try {
      setUpdating(true);
      setStatusMessage("Initiating automated system update...");

      const res = await fetch("/api/system/update", {
        method: "POST",
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setStatusMessage("Update in progress: Pulling latest code and building... Waiting for service restart.");
        // Give background updater 8 seconds before probing health
        setTimeout(() => {
          pollServerForRestart();
        }, 8000);
      } else {
        setStatusMessage(json.message || "Failed to trigger update.");
        setUpdating(false);
      }
    } catch {
      setStatusMessage("Update command dispatched. Monitoring service restart...");
      setTimeout(() => {
        pollServerForRestart();
      }, 8000);
    }
  };

  if (loading && !data) {
    return null;
  }

  const isUpdateAvailable = data?.status === "UPDATE_AVAILABLE";
  const shortSha = data?.local?.shortHash || "latest";

  return (
    <>
      {/* Topbar Interactive Pill */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight transition-all cursor-pointer shadow-2xs ${
          isUpdateAvailable
            ? "bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/80 dark:hover:bg-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 animate-pulse"
            : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
        }`}
        title={
          isUpdateAvailable
            ? `New update available (${data?.remote?.shortHash})! Click to review and update.`
            : `System up to date at commit ${shortSha}. Click to view details.`
        }
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isUpdateAvailable ? "bg-amber-500 animate-ping" : "bg-emerald-500"
          }`}
        />
        <span>
          {isUpdateAvailable ? (
            <span className="flex items-center gap-1">
              <span>Update Ready</span>
              <span className="font-mono text-[10px] opacity-75">({shortSha})</span>
            </span>
          ) : (
            <span className="font-mono text-[11px]">git:{shortSha}</span>
          )}
        </span>
      </button>

      {/* System Update & Version Scanner Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                  ⚡
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
                    System Version &amp; Repository Scanner
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Verify deployment commits against remote GitHub repository.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !updating && setModalOpen(false)}
                disabled={updating}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer disabled:opacity-40"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Status Alert Banner */}
              {isUpdateAvailable ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start gap-3 text-amber-900 dark:text-amber-200">
                  <span className="text-xl">🚀</span>
                  <div>
                    <h4 className="font-bold text-sm">New Update Available</h4>
                    <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">
                      GitHub repository has newer commits on <b>origin/main</b>. You can pull the latest release and update this system with one click.
                    </p>
                  </div>
                </div>
              ) : data?.status === "OFFLINE" ? (
                <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 flex items-start gap-3 text-zinc-800 dark:text-zinc-200">
                  <span className="text-lg">📡</span>
                  <div>
                    <h4 className="font-bold text-sm">Offline Mode</h4>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      Remote GitHub could not be reached right now. Local operations are active and using commit <b>{shortSha}</b>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-start gap-3 text-emerald-900 dark:text-emerald-200">
                  <span className="text-lg">✓</span>
                  <div>
                    <h4 className="font-bold text-sm">System is Up to Date</h4>
                    <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">
                      This machine is currently running the latest commit <b>({shortSha})</b> matching <b>origin/main</b>.
                    </p>
                  </div>
                </div>
              )}

              {/* Progress/Updating Status Banner */}
              {statusMessage && (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {updating && <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />}
                    <span>{statusMessage}</span>
                  </div>
                  {pollCountdown !== null && (
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Checking web service health (timeout in {pollCountdown}s)...
                    </p>
                  )}
                </div>
              )}

              {/* Two Column Commit Comparison Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Current Local Version */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Currently Running
                    </span>
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">
                      {data?.branch || "main"}
                    </span>
                  </div>
                  <div className="font-mono text-sm font-black text-blue-600 dark:text-blue-400">
                    {data?.local?.shortHash || "—"}
                  </div>
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
                    {data?.local?.message || "No commit message"}
                  </p>
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-500">
                    <div>Author: <b className="text-zinc-700 dark:text-zinc-300">{data?.local?.author}</b></div>
                    <div>Date: {data?.local?.date ? new Date(data.local.date).toLocaleString() : "—"}</div>
                  </div>
                </div>

                {/* Remote GitHub Version */}
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      Remote GitHub (origin/main)
                    </span>
                    {data?.remote && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isUpdateAvailable ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200"
                      }`}>
                        {isUpdateAvailable ? "Newer" : "Matches Local"}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-sm font-black text-purple-600 dark:text-purple-400">
                    {data?.remote?.shortHash || (data?.status === "OFFLINE" ? "Offline" : "Checking...")}
                  </div>
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
                    {data?.remote?.message || (data?.status === "OFFLINE" ? "GitHub unreachable" : "Scanning remote...")}
                  </p>
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-500">
                    <div>Author: <b className="text-zinc-700 dark:text-zinc-300">{data?.remote?.author || "—"}</b></div>
                    <div>Date: {data?.remote?.date ? new Date(data.remote.date).toLocaleString() : "—"}</div>
                  </div>
                </div>
              </div>

              {/* Recent Repository Changes */}
              {data?.recentCommits && data.recentCommits.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                    Recent Commits on This Branch
                  </h4>
                  <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-750 divide-y divide-zinc-200 dark:divide-zinc-700/60 overflow-hidden">
                    {data.recentCommits.map((c, i) => (
                      <div key={i} className="px-3.5 py-2.5 flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                              {c.shortHash}
                            </span>
                            <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {c.message}
                            </span>
                          </div>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                            {c.author} &bull; {c.relativeDate}
                          </span>
                        </div>
                        {i === 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 shrink-0">
                            Current HEAD
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Environment: <b>{data?.environment || "Unknown"}</b></span>
                <span>Last scanned: {data?.lastCheckedAt ? new Date(data.lastCheckedAt).toLocaleTimeString() : "Just now"}</span>
              </div>
            </div>

            {/* Modal Action Buttons Footer */}
            <div className="p-4 px-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => fetchVersion(true)}
                disabled={scanning || updating}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                    <span>Scanning GitHub...</span>
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    <span>Scan / Check for Updates</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={updating}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-semibold rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Close
                </button>

                {isOwner && (
                  <button
                    type="button"
                    onClick={handleUpdate}
                    disabled={updating || scanning}
                    className={`w-full sm:w-auto px-5 py-2 text-xs font-bold rounded-xl text-white shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${
                      isUpdateAvailable
                        ? "bg-amber-600 hover:bg-amber-500 animate-pulse shadow-amber-500/20"
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
                        <span>⚡</span>
                        <span>{isUpdateAvailable ? "Update to Latest Commit" : "Force Pull & Update"}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
