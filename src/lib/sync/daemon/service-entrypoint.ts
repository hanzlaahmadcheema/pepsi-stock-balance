/**
 * Phase 5 — Step 4: Sync Daemon Service Entrypoint for Windows Depot Runtime
 *
 * Dedicated standalone entrypoint for the "Pepsi Depot Sync" NSSM Windows service:
 * - Validates environment and database configuration before starting
 * - Prevents duplicate scheduler instances
 * - Captures SIGINT / SIGTERM for graceful shutdown
 * - Emits clean, structured logs formatted for Windows service event capture
 * - Masks all secrets (database passwords, sync tokens, auth headers)
 */

import { prisma } from "@/lib/prisma";
import {
  SyncScheduler,
  SyncSchedulerConfig,
  startSyncScheduler,
  stopSyncScheduler,
  getActiveScheduler,
} from "./scheduler";

export interface DaemonConfig {
  databaseUrl: string;
  cloudBaseUrl: string;
  deviceId: string;
  deviceToken: string;
  normalIntervalMs?: number;
  debounceMs?: number;
}

/**
 * Masks sensitive connection strings (e.g. PostgreSQL credentials) for safe logging.
 */
export function sanitizeDatabaseUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.password) {
      url.password = "******";
    }
    return url.toString();
  } catch {
    // If not a parseable URL, mask middle chars
    return rawUrl.replace(/:([^@/]+)@/, ":******@");
  }
}

/**
 * Masks a secret string showing only prefix/length.
 */
export function maskSecret(secret: string): string {
  if (!secret) return "[EMPTY]";
  if (secret.length <= 8) return "[PROTECTED]";
  return `${secret.slice(0, 4)}...[${secret.length} chars]`;
}

/**
 * Validates and loads daemon environment variables.
 * Throws explicit descriptive errors if configuration is missing or invalid.
 */
export function validateDaemonConfig(
  env: Record<string, string | undefined> = process.env
): DaemonConfig {
  const errors: string[] = [];

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    errors.push("Missing required environment variable: DATABASE_URL");
  }

  const cloudBaseUrl = (
    env.CLOUD_SYNC_BASE_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    env.CLOUD_URL
  )?.trim();
  if (!cloudBaseUrl) {
    errors.push(
      "Missing required environment variable: CLOUD_SYNC_BASE_URL (or NEXT_PUBLIC_APP_URL / CLOUD_URL)"
    );
  } else {
    try {
      const parsed = new URL(cloudBaseUrl);
      if (!parsed.protocol.startsWith("http")) {
        errors.push(`Invalid CLOUD_SYNC_BASE_URL protocol: '${parsed.protocol}'. Must be http:// or https://`);
      }
    } catch {
      errors.push(`Invalid CLOUD_SYNC_BASE_URL: '${cloudBaseUrl}' is not a valid URL.`);
    }
  }

  const deviceId = env.SYNC_DEVICE_ID?.trim();
  if (!deviceId) {
    errors.push("Missing required environment variable: SYNC_DEVICE_ID");
  }

  const deviceToken = env.SYNC_DEVICE_TOKEN?.trim();
  if (!deviceToken) {
    errors.push("Missing required environment variable: SYNC_DEVICE_TOKEN");
  }

  if (errors.length > 0) {
    throw new Error(
      `Sync Daemon Configuration Error:\n  - ${errors.join("\n  - ")}\n\nPlease ensure your .env.production or Windows environment variables are properly set.`
    );
  }

  let normalIntervalMs: number | undefined;
  if (env.SYNC_NORMAL_INTERVAL_MS) {
    const parsed = parseInt(env.SYNC_NORMAL_INTERVAL_MS, 10);
    if (!isNaN(parsed) && parsed >= 5000) {
      normalIntervalMs = parsed;
    }
  }

  let debounceMs: number | undefined;
  if (env.SYNC_DEBOUNCE_MS) {
    const parsed = parseInt(env.SYNC_DEBOUNCE_MS, 10);
    if (!isNaN(parsed) && parsed >= 200) {
      debounceMs = parsed;
    }
  }

  return {
    databaseUrl: databaseUrl!,
    cloudBaseUrl: cloudBaseUrl!,
    deviceId: deviceId!,
    deviceToken: deviceToken!,
    normalIntervalMs,
    debounceMs,
  };
}

/**
 * Formats a log line for Windows NSSM service output.
 */
function logInfo(tag: string, message: string, meta?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${ts}] [INFO] [${tag}] ${message}${metaStr}`);
}

function logWarn(tag: string, message: string, meta?: Record<string, unknown>): void {
  const ts = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  console.warn(`[${ts}] [WARN] [${tag}] ${message}${metaStr}`);
}

function logError(tag: string, message: string, err?: unknown): void {
  const ts = new Date().toISOString();
  const errStr = err instanceof Error ? ` | ${err.message}` : err ? ` | ${String(err)}` : "";
  console.error(`[${ts}] [ERROR] [${tag}] ${message}${errStr}`);
}

/**
 * Starts the standalone sync daemon service.
 */
export async function startDaemonService(
  env: Record<string, string | undefined> = process.env
): Promise<SyncScheduler> {
  logInfo("STARTUP", "Starting Pepsi Depot Sync Daemon service...");

  // 1. Validate environment configuration
  const config = validateDaemonConfig(env);
  logInfo("CONFIG", "Configuration validated successfully", {
    cloudBaseUrl: config.cloudBaseUrl,
    deviceId: config.deviceId,
    deviceToken: maskSecret(config.deviceToken),
    databaseUrl: sanitizeDatabaseUrl(config.databaseUrl),
    normalIntervalMs: config.normalIntervalMs ?? 30000,
    debounceMs: config.debounceMs ?? 1000,
  });

  // 2. Verify local database connectivity before launching scheduler loop
  try {
    const startPing = Date.now();
    await prisma.$queryRaw`SELECT 1 as startup_check`;
    const latency = Date.now() - startPing;
    logInfo("DATABASE", `Connected to local PostgreSQL successfully (${latency}ms)`);
  } catch (err: unknown) {
    logError("DATABASE", "Failed to connect to local PostgreSQL. Check service and credentials.", err);
    throw err;
  }

  // 3. Configure SyncScheduler with telemetry callbacks
  const schedulerConfig: SyncSchedulerConfig = {
    cloudBaseUrl: config.cloudBaseUrl,
    deviceId: config.deviceId,
    deviceToken: config.deviceToken,
    normalIntervalMs: config.normalIntervalMs,
    debounceMs: config.debounceMs,
    runImmediatelyOnStart: true,
    dbClient: prisma,
    onPushResult: (res) => {
      if (res.success && res.syncedCount > 0) {
        logInfo("PUSH", `Successfully pushed ${res.syncedCount} operations to Cloud`, {
          failedCount: res.failedCount,
          retryCount: res.retryCount,
        });
      }
    },
    onPullResult: (res) => {
      if (res.appliedCount > 0) {
        logInfo("PULL", `Applied ${res.appliedCount} changes from Cloud (Cursor: ${res.newCursor})`);
      }
      if (res.blocked) {
        logWarn("QUARANTINE", `Pull stream halted by quarantined change at sequence ${res.blockedSequence || res.newCursor}`, {
          reason: res.quarantineReason,
          errorCode: res.quarantineErrorCode,
        });
      }
    },
    onError: (channel, err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logWarn(channel.toUpperCase(), `Sync error on ${channel}: ${msg}`);
    },
  };

  // 4. Start scheduler singleton
  const scheduler = await startSyncScheduler(schedulerConfig);
  logInfo("RUNNING", "Pepsi Depot Sync Daemon is active and running normal 30-second cycles.");

  return scheduler;
}

/**
 * Registers OS signal listeners for clean Windows/NSSM shutdown.
 */
export function registerProcessLifecycleHandlers(scheduler: SyncScheduler): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logInfo("SHUTDOWN", `Received ${signal}. Shutting down sync scheduler gracefully...`);
    try {
      await scheduler.stop();
      logInfo("SHUTDOWN", "Sync scheduler stopped cleanly. Advisory locks released.");
      process.exit(0);
    } catch (err: unknown) {
      logError("SHUTDOWN", "Error during scheduler shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  process.on("uncaughtException", (err) => {
    logError("FATAL", "Uncaught exception in sync daemon process:", err);
    // Let NSSM restart the process
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logWarn("UNHANDLED", "Unhandled promise rejection in sync daemon:", { reason: String(reason) });
  });
}

// Auto-run if executed directly as script
if (process.argv[1] && (process.argv[1].endsWith("service-entrypoint.ts") || process.argv[1].endsWith("service-entrypoint.js"))) {
  startDaemonService()
    .then((scheduler) => {
      registerProcessLifecycleHandlers(scheduler);
    })
    .catch((err) => {
      console.error("[FATAL] Failed to start Pepsi Depot Sync Daemon:", err);
      process.exit(1);
    });
}
