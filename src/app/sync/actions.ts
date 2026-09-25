"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDbUser } from "@/lib/auth";
import { pushPendingOperations, retryFailedOperation, PushResult } from "@/lib/sync/client/push";
import { executePullCycle, LocalPullApplyResult, PullApplyError } from "@/lib/sync/client/pull";
import { triggerDebouncedPush } from "@/lib/sync/daemon/scheduler";
import type { Role } from "@prisma/client";

export interface ManualSyncResult {
  success: boolean;
  message: string;
  pushedCount: number;
  pulledCount: number;
  failedCount: number;
  isOffline?: boolean;
  blockedByFailedOperationId?: string;
  errorCode?: string;
}

export interface ManualSyncTestOverrides {
  cloudBaseUrl?: string;
  deviceId?: string;
  deviceToken?: string;
  fetchFn?: typeof fetch;
}

/**
 * Server action to manually trigger bi-directional synchronization (Push & Pull).
 * Accessible to authenticated Staff and Owner.
 */
export async function triggerManualSyncAction(
  _testUser?: { id: string; role: Role },
  _testOverrides?: ManualSyncTestOverrides
): Promise<ManualSyncResult> {
  // 1. Authorize: Staff and Owner can trigger manual sync
  try {
    if (!_testUser) {
      await requireDbUser();
    }
  } catch {
    return {
      success: false,
      message: "Unauthorized: You must be logged in to trigger synchronization.",
      pushedCount: 0,
      pulledCount: 0,
      failedCount: 0,
    };
  }

  // 2. Validate environment configuration
  const cloudBaseUrl = (
    _testOverrides?.cloudBaseUrl ||
    process.env.CLOUD_SYNC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.CLOUD_URL ||
    "http://localhost:3000"
  ).trim();

  const deviceId = (
    _testOverrides?.deviceId !== undefined ? _testOverrides.deviceId : process.env.SYNC_DEVICE_ID
  )?.trim();
  const deviceToken = (
    _testOverrides?.deviceToken !== undefined ? _testOverrides.deviceToken : process.env.SYNC_DEVICE_TOKEN
  )?.trim();
  const fetchFn = _testOverrides?.fetchFn ?? fetch;

  if (!deviceId || !deviceToken) {
    return {
      success: false,
      message:
        "Sync configuration missing: SYNC_DEVICE_ID and SYNC_DEVICE_TOKEN must be configured in environment variables to sync with Cloud.",
      pushedCount: 0,
      pulledCount: 0,
      failedCount: 0,
      errorCode: "MISSING_SYNC_CONFIG",
    };
  }

  let pushResult: PushResult;
  let pullResult: LocalPullApplyResult | null = null;
  let pushError: string | null = null;
  let pullError: string | null = null;

  // 3. Step A: Push local pending outbox operations to Cloud
  try {
    pushResult = await pushPendingOperations(cloudBaseUrl, deviceId, deviceToken, fetchFn, prisma);
  } catch (err: unknown) {
    pushError = err instanceof Error ? err.message : String(err);
    pushResult = {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      retryCount: 0,
      nothingToPush: false,
      networkError: pushError,
    };
  }

  // 4. Step B: Pull incremental updates from Cloud
  try {
    pullResult = await executePullCycle({
      localDeviceId: deviceId,
      serverUrl: cloudBaseUrl,
      deviceToken: deviceToken,
      fetchFn,
      dbClient: prisma,
    });
  } catch (err: unknown) {
    pullError = err instanceof Error ? err.message : String(err);
  }

  // 5. Notify in-process background scheduler if running
  try {
    triggerDebouncedPush();
  } catch {
    // Non-fatal if no background scheduler running in process
  }

  // 6. Refresh sync page view
  try {
    revalidatePath("/sync");
    revalidatePath("/sync/quarantine");
  } catch {
    // Non-fatal if path revalidation fails
  }

  // 7. Handle In-Flight / Advisory Lock Concurrency
  if (pushResult.alreadyRunning || pullResult?.alreadyRunning) {
    return {
      success: true,
      message: "A background sync cycle is currently active on this terminal. Please refresh in a few moments.",
      pushedCount: pushResult.syncedCount,
      pulledCount: pullResult?.appliedCount ?? 0,
      failedCount: pushResult.failedCount,
    };
  }

  // 8. Handle Network / Connection Offline
  if (pushResult.networkError || (pullError && !pullResult)) {
    const errorDetails = pushResult.networkError || pullError;
    return {
      success: false,
      message: `Offline / Cloud Unreachable (${cloudBaseUrl}): ${errorDetails}. Operations remain safely queued locally.`,
      pushedCount: pushResult.syncedCount,
      pulledCount: pullResult?.appliedCount ?? 0,
      failedCount: pushResult.failedCount,
      isOffline: true,
    };
  }

  // 9. Handle Queue Blocked by Failed Operation
  if (pushResult.blockedByFailedOperationId) {
    return {
      success: false,
      message: `Push queue is halted by a failed operation (ID: ${pushResult.blockedByFailedOperationId.slice(0, 8)}...). Please inspect the error and retry below.`,
      pushedCount: pushResult.syncedCount,
      pulledCount: pullResult?.appliedCount ?? 0,
      failedCount: pushResult.failedCount,
      blockedByFailedOperationId: pushResult.blockedByFailedOperationId,
    };
  }

  // 10. Handle Pull Stream Quarantined Block
  if (pullResult?.blocked) {
    return {
      success: true,
      message: `Pushed ${pushResult.syncedCount} operation(s). Inbound stream paused at sequence #${pullResult.blockedSequence} due to quarantine: ${pullResult.quarantineReason}`,
      pushedCount: pushResult.syncedCount,
      pulledCount: pullResult.appliedCount,
      failedCount: pushResult.failedCount,
    };
  }

  // 11. Full Success
  const pushMsg = pushResult.nothingToPush
    ? "No pending local operations to push"
    : `Pushed ${pushResult.syncedCount} operation${pushResult.syncedCount === 1 ? "" : "s"}`;
  const pullMsg = pullResult
    ? `Pulled ${pullResult.appliedCount} change${pullResult.appliedCount === 1 ? "" : "s"} from Cloud`
    : "Pull check completed";

  return {
    success: true,
    message: `${pushMsg}. ${pullMsg}.`,
    pushedCount: pushResult.syncedCount,
    pulledCount: pullResult?.appliedCount ?? 0,
    failedCount: pushResult.failedCount,
  };
}

/**
 * Server action to reset a single FAILED SyncOutbox operation back to PENDING.
 * Accessible to authenticated Staff and Owner.
 */
export async function retryOutboxOperationAction(
  operationId: string,
  _testUser?: { id: string; role: Role }
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    if (!_testUser) {
      await requireDbUser();
    }
  } catch {
    return {
      success: false,
      error: "Unauthorized: You must be logged in to retry sync operations.",
    };
  }

  try {
    await retryFailedOperation(operationId);
    try {
      revalidatePath("/sync");
    } catch {
      // Non-fatal outside Next request context
    }
    return {
      success: true,
      message: "Operation reset to PENDING. It will be pushed on the next sync cycle.",
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Server action to reset ALL FAILED SyncOutbox operations back to PENDING.
 * Accessible to authenticated Staff and Owner.
 */
export async function retryAllFailedOperationsAction(
  _testUser?: { id: string; role: Role }
): Promise<{
  success: boolean;
  resetCount: number;
  message?: string;
  error?: string;
}> {
  try {
    if (!_testUser) {
      await requireDbUser();
    }
  } catch {
    return {
      success: false,
      resetCount: 0,
      error: "Unauthorized: You must be logged in to retry sync operations.",
    };
  }

  try {
    const res = await prisma.syncOutbox.updateMany({
      where: { status: "FAILED" },
      data: {
        status: "PENDING",
        lastError: null,
        retryCount: 0,
      },
    });

    try {
      revalidatePath("/sync");
    } catch {
      // Non-fatal outside Next request context
    }
    return {
      success: true,
      resetCount: res.count,
      message: `Reset ${res.count} failed operation${res.count === 1 ? "" : "s"} to PENDING.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      resetCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
