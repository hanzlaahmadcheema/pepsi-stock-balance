/**
 * Phase 5 — Step 2: Local Sync Daemon & Runtime Scheduler
 *
 * Provides a robust, cross-platform, single-flight scheduling service for
 * the local Windows Depot runtime:
 *
 * Core Behaviors:
 *  1. Normal interval: Runs independent PUSH and PULL every 30 seconds.
 *  2. Immediate/debounced push: Important local mutations trigger a debounced PUSH (default 1s window)
 *     collapsing rapid mutation bursts into a single sync operation.
 *  3. Exponential backoff: On network/offline failure, enters agreed backoff progression:
 *     5s → 10s → 20s → 40s → 80s → 160s → 300s (max).
 *  4. Backoff reset: Any successful push or pull immediately resets that channel's backoff to 0.
 *  5. Error resilience: Individual sync failures (network, HTTP 5xx, schema, quarantine) do not crash
 *     the daemon; the scheduler logs and backs off.
 *  6. Single-flight per channel:
 *     - Push and Pull are independent and may run concurrently.
 *     - Overlapping PUSH calls are blocked in-process and via PostgreSQL advisory lock (88492001).
 *     - Overlapping PULL calls are blocked in-process and via PostgreSQL advisory lock (88492002).
 *  7. Clean shutdown: Cancels pending timers, completes or awaits in-flight promises.
 *  8. Process-level singleton: Prevents multiple concurrent scheduler instances in the same process.
 */

import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@prisma/client";
import {
  pushPendingOperations,
  type PushResult,
  SYNC_PUSH_ADVISORY_LOCK_ID,
} from "@/lib/sync/client/push";
import {
  executePullCycle,
  type LocalPullApplyResult,
  SYNC_PULL_ADVISORY_LOCK_ID,
  PullApplyError,
} from "@/lib/sync/client/pull";

// ─── Default Constants ────────────────────────────────────────────────────────

/** Normal steady-state polling interval: 30 seconds. */
export const DEFAULT_NORMAL_INTERVAL_MS = 30_000;

/** Default debounce window for immediate push triggers: 1 second. */
export const DEFAULT_DEBOUNCE_MS = 1_000;

/**
 * Agreed exponential backoff schedule for offline / network failures:
 * 5s → 10s → 20s → 40s → 80s → 160s → 300s max.
 */
export const DEFAULT_BACKOFF_SCHEDULE_MS = [
  5_000,    // 5s
  10_000,   // 10s
  20_000,   // 20s
  40_000,   // 40s
  80_000,   // 80s
  160_000,  // 160s
  300_000,  // 300s (max)
];

export const MAX_BACKOFF_MS = 300_000;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface SyncSchedulerConfig {
  cloudBaseUrl: string;
  deviceId: string;
  deviceToken: string;
  normalIntervalMs?: number;
  debounceMs?: number;
  backoffScheduleMs?: number[];
  fetchFn?: typeof fetch;
  dbClient?: PrismaClient;
  /** Whether to run push and pull immediately when start() is called. Default: true. */
  runImmediatelyOnStart?: boolean;
  /** Optional callbacks for telemetry and testing */
  onPushResult?: (result: PushResult) => void;
  onPullResult?: (result: LocalPullApplyResult) => void;
  onError?: (channel: "push" | "pull", error: unknown) => void;
}

export interface SyncSchedulerStatus {
  running: boolean;
  isPushing: boolean;
  isPulling: boolean;
  pushBackoffIndex: number;
  pullBackoffIndex: number;
  currentPushIntervalMs: number;
  currentPullIntervalMs: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastPushSuccess: boolean | null;
  lastPullSuccess: boolean | null;
  lastPushError: string | null;
  lastPullError: string | null;
  totalPushCycles: number;
  totalPullCycles: number;
}

// ─── Process-Level Singleton Registration ─────────────────────────────────────

let activeSchedulerInstance: SyncScheduler | null = null;

// ─── Network Error Detection Helper ───────────────────────────────────────────

export function isNetworkOrOfflineError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof PullApplyError) {
    return (
      err.code === "HTTP_ERROR" ||
      err.code === "FETCH_ERROR" ||
      err.code === "NETWORK_ERROR" ||
      err.message.includes("fetch failed") ||
      err.message.includes("HTTP 5") ||
      err.message.includes("HTTP 502") ||
      err.message.includes("HTTP 503") ||
      err.message.includes("HTTP 504")
    );
  }
  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("fetch failed") ||
      msg.includes("econnrefused") ||
      msg.includes("enotfound") ||
      msg.includes("etimedout") ||
      msg.includes("econnreset") ||
      msg.includes("network") ||
      msg.includes("offline")
    );
  }
  return false;
}

// ─── SyncScheduler Class ──────────────────────────────────────────────────────

export class SyncScheduler {
  private readonly config: SyncSchedulerConfig;
  private readonly normalIntervalMs: number;
  private readonly debounceMs: number;
  private readonly backoffScheduleMs: number[];
  private readonly fetchFn: typeof fetch;
  private readonly dbClient: PrismaClient;

  private running: boolean = false;
  private pushTimer: NodeJS.Timeout | null = null;
  private pullTimer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  private pushBackoffIndex: number = 0;
  private pullBackoffIndex: number = 0;

  private isPushing: boolean = false;
  private isPulling: boolean = false;
  private pendingDebouncedPush: boolean = false;

  private activePushPromise: Promise<PushResult | null> | null = null;
  private activePullPromise: Promise<LocalPullApplyResult | null> | null = null;

  // Status tracking
  private lastPushAt: string | null = null;
  private lastPullAt: string | null = null;
  private lastPushSuccess: boolean | null = null;
  private lastPullSuccess: boolean | null = null;
  private lastPushError: string | null = null;
  private lastPullError: string | null = null;
  private totalPushCycles: number = 0;
  private totalPullCycles: number = 0;

  constructor(config: SyncSchedulerConfig) {
    this.config = config;
    this.normalIntervalMs = config.normalIntervalMs ?? DEFAULT_NORMAL_INTERVAL_MS;
    this.debounceMs = config.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.backoffScheduleMs = config.backoffScheduleMs ?? DEFAULT_BACKOFF_SCHEDULE_MS;
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
    this.dbClient = config.dbClient ?? prisma;
  }

  // ─── Lifecycle Methods ─────────────────────────────────────────────────────

  /**
   * Starts the sync scheduler.
   * Throws an error if already running or if another scheduler is already active in this process.
   */
  public async start(): Promise<void> {
    if (this.running) {
      throw new Error("SyncScheduler is already running.");
    }
    if (activeSchedulerInstance && activeSchedulerInstance !== this && activeSchedulerInstance.isRunning()) {
      throw new Error("A SyncScheduler instance is already running in this process.");
    }

    this.running = true;
    activeSchedulerInstance = this;

    const runImmediately = this.config.runImmediatelyOnStart ?? true;
    if (runImmediately) {
      // Execute initial push and pull independently without blocking startup
      void this.runPushCycle();
      void this.runPullCycle();
    } else {
      this.scheduleNextPush(this.normalIntervalMs);
      this.scheduleNextPull(this.normalIntervalMs);
    }
  }

  /**
   * Clean shutdown: clears all timers, resets running state, and awaits any in-flight cycles.
   */
  public async stop(): Promise<void> {
    this.running = false;

    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    if (this.pullTimer) {
      clearTimeout(this.pullTimer);
      this.pullTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingDebouncedPush = false;

    if (activeSchedulerInstance === this) {
      activeSchedulerInstance = null;
    }

    // Await any in-flight cycles to complete cleanly
    const inFlight: Promise<unknown>[] = [];
    if (this.activePushPromise) inFlight.push(this.activePushPromise);
    if (this.activePullPromise) inFlight.push(this.activePullPromise);

    if (inFlight.length > 0) {
      await Promise.allSettled(inFlight);
    }
  }

  public isRunning(): boolean {
    return this.running;
  }

  public getStatus(): SyncSchedulerStatus {
    return {
      running: this.running,
      isPushing: this.isPushing,
      isPulling: this.isPulling,
      pushBackoffIndex: this.pushBackoffIndex,
      pullBackoffIndex: this.pullBackoffIndex,
      currentPushIntervalMs: this.getPushIntervalMs(),
      currentPullIntervalMs: this.getPullIntervalMs(),
      lastPushAt: this.lastPushAt,
      lastPullAt: this.lastPullAt,
      lastPushSuccess: this.lastPushSuccess,
      lastPullSuccess: this.lastPullSuccess,
      lastPushError: this.lastPushError,
      lastPullError: this.lastPullError,
      totalPushCycles: this.totalPushCycles,
      totalPullCycles: this.totalPullCycles,
    };
  }

  // ─── Immediate / Debounced Push Trigger ─────────────────────────────────────

  /**
   * Notifies the scheduler that an important local mutation occurred (e.g. Sale, Payment, Customer).
   * Debounces repeated calls within `debounceMs` into a single immediate push.
   */
  public triggerImmediatePush(): void {
    if (!this.running) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (!this.running) return;

      if (this.isPushing) {
        // A push is already executing; flag so that another runs immediately after
        this.pendingDebouncedPush = true;
        return;
      }

      // Clear the scheduled normal push timer so we don't double-push
      if (this.pushTimer) {
        clearTimeout(this.pushTimer);
        this.pushTimer = null;
      }

      void this.runPushCycle();
    }, this.debounceMs);
  }

  // ─── Independent Push Execution ────────────────────────────────────────────

  public async runPushCycle(): Promise<PushResult | null> {
    if (!this.running) return null;

    if (this.isPushing) {
      // In-process single flight protection
      this.pendingDebouncedPush = true;
      return null;
    }

    this.isPushing = true;
    this.totalPushCycles++;
    this.lastPushAt = new Date().toISOString();

    const pushPromise = (async (): Promise<PushResult | null> => {
      try {
        const result = await pushPendingOperations(
          this.config.cloudBaseUrl,
          this.config.deviceId,
          this.config.deviceToken,
          this.fetchFn,
          this.dbClient
        );

        if (result.alreadyRunning) {
          // Database advisory lock (88492001) held by another process/worker.
          // Do NOT advance backoff; reschedule at normal interval.
          this.scheduleNextPush(this.normalIntervalMs);
          return result;
        }

        if (result.networkError) {
          // Network / offline failure
          this.lastPushSuccess = false;
          this.lastPushError = result.networkError;
          this.applyPushBackoff();
        } else {
          // Success (either synced items or nothing to push)
          this.lastPushSuccess = true;
          this.lastPushError = null;
          this.pushBackoffIndex = 0; // Reset backoff
          this.scheduleNextPush(this.normalIntervalMs);
        }

        this.config.onPushResult?.(result);
        return result;
      } catch (err: unknown) {
        this.lastPushSuccess = false;
        this.lastPushError = err instanceof Error ? err.message : String(err);
        this.config.onError?.("push", err);

        // Survive failure without terminating daemon
        if (isNetworkOrOfflineError(err)) {
          this.applyPushBackoff();
        } else {
          // Non-network unexpected error: schedule next attempt at backoff or normal
          this.applyPushBackoff();
        }
        return null;
      } finally {
        this.isPushing = false;
        this.activePushPromise = null;

        if (this.pendingDebouncedPush && this.running) {
          this.pendingDebouncedPush = false;
          // Reschedule debounced push immediately
          this.triggerImmediatePush();
        }
      }
    })();

    this.activePushPromise = pushPromise;
    return await pushPromise;
  }

  // ─── Independent Pull Execution ────────────────────────────────────────────

  public async runPullCycle(): Promise<LocalPullApplyResult | null> {
    if (!this.running) return null;

    if (this.isPulling) {
      // In-process single flight protection
      return null;
    }

    this.isPulling = true;
    this.totalPullCycles++;
    this.lastPullAt = new Date().toISOString();

    const pullPromise = (async (): Promise<LocalPullApplyResult | null> => {
      try {
        const result = await executePullCycle({
          localDeviceId: this.config.deviceId,
          serverUrl: this.config.cloudBaseUrl,
          deviceToken: this.config.deviceToken,
          fetchFn: this.fetchFn,
          dbClient: this.dbClient,
        });

        if (result.alreadyRunning) {
          // Database advisory lock (88492002) held by another process/worker.
          this.scheduleNextPull(this.normalIntervalMs);
          return result;
        }

        if (result.blocked) {
          // Deterministic quarantine block occurred (e.g. LocalSyncQuarantine record written).
          // This is a business/quarantine state, NOT a network failure.
          // Respect existing quarantine semantics without crashing the daemon.
          this.lastPullSuccess = true;
          this.lastPullError = `Blocked at sequence ${result.blockedSequence}: ${result.quarantineReason}`;
          this.pullBackoffIndex = 0; // Reset backoff since connection succeeded
          this.scheduleNextPull(this.normalIntervalMs);
        } else {
          // Successful pull apply
          this.lastPullSuccess = true;
          this.lastPullError = null;
          this.pullBackoffIndex = 0; // Reset backoff
          this.scheduleNextPull(this.normalIntervalMs);
        }

        this.config.onPullResult?.(result);
        return result;
      } catch (err: unknown) {
        this.lastPullSuccess = false;
        this.lastPullError = err instanceof Error ? err.message : String(err);
        this.config.onError?.("pull", err);

        // Survive failure without terminating daemon
        if (isNetworkOrOfflineError(err)) {
          this.applyPullBackoff();
        } else {
          // Unexpected error: apply backoff so we don't spin in a crash loop
          this.applyPullBackoff();
        }
        return null;
      } finally {
        this.isPulling = false;
        this.activePullPromise = null;
      }
    })();

    this.activePullPromise = pullPromise;
    return await pullPromise;
  }

  // ─── Scheduling & Backoff Helpers ──────────────────────────────────────────

  private scheduleNextPush(delayMs: number): void {
    if (!this.running) return;
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      if (this.running) {
        void this.runPushCycle();
      }
    }, delayMs);
  }

  private scheduleNextPull(delayMs: number): void {
    if (!this.running) return;
    if (this.pullTimer) {
      clearTimeout(this.pullTimer);
    }
    this.pullTimer = setTimeout(() => {
      this.pullTimer = null;
      if (this.running) {
        void this.runPullCycle();
      }
    }, delayMs);
  }

  private applyPushBackoff(): void {
    const delay = this.backoffScheduleMs[this.pushBackoffIndex] ?? MAX_BACKOFF_MS;
    if (this.pushBackoffIndex < this.backoffScheduleMs.length) {
      this.pushBackoffIndex++;
    }
    this.scheduleNextPush(delay);
  }

  private applyPullBackoff(): void {
    const delay = this.backoffScheduleMs[this.pullBackoffIndex] ?? MAX_BACKOFF_MS;
    if (this.pullBackoffIndex < this.backoffScheduleMs.length) {
      this.pullBackoffIndex++;
    }
    this.scheduleNextPull(delay);
  }

  private getPushIntervalMs(): number {
    if (this.pushBackoffIndex === 0) return this.normalIntervalMs;
    const idx = Math.min(this.pushBackoffIndex - 1, this.backoffScheduleMs.length - 1);
    return this.backoffScheduleMs[idx] ?? this.normalIntervalMs;
  }

  private getPullIntervalMs(): number {
    if (this.pullBackoffIndex === 0) return this.normalIntervalMs;
    const idx = Math.min(this.pullBackoffIndex - 1, this.backoffScheduleMs.length - 1);
    return this.backoffScheduleMs[idx] ?? this.normalIntervalMs;
  }
}

// ─── Module Singleton Helpers ─────────────────────────────────────────────────

export function getActiveScheduler(): SyncScheduler | null {
  return activeSchedulerInstance;
}

/**
 * Global trigger to request an immediate debounced push.
 * If a scheduler is active in this process, triggers debounce push.
 * Safe no-op if no scheduler is running.
 */
export function triggerDebouncedPush(): void {
  activeSchedulerInstance?.triggerImmediatePush();
}

/**
 * Starts the global scheduler singleton with the provided config.
 */
export async function startSyncScheduler(config: SyncSchedulerConfig): Promise<SyncScheduler> {
  const scheduler = new SyncScheduler(config);
  await scheduler.start();
  return scheduler;
}

/**
 * Stops the global scheduler singleton if running.
 */
export async function stopSyncScheduler(): Promise<void> {
  if (activeSchedulerInstance) {
    await activeSchedulerInstance.stop();
  }
}
