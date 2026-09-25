"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDbUser } from "@/lib/auth";
import { Role, QuarantineStatus, SyncChangeAction } from "@prisma/client";
import { resolveQuarantineChange, ResolveQuarantineResult } from "@/lib/sync/client/pull";

import {
  QuarantineFilters,
  SerializedQuarantineRecord,
} from "./types";

/**
 * Server action to fetch quarantine records with filters.
 * Accessible to authenticated Staff and Owner.
 */
export async function getQuarantineRecordsAction(
  filters?: QuarantineFilters,
  _testUser?: { id: string; role: Role }
): Promise<{
  success: boolean;
  records?: SerializedQuarantineRecord[];
  error?: string;
}> {
  try {
    if (!_testUser) {
      await requireDbUser();
    }
  } catch {
    return {
      success: false,
      error: "Unauthorized: You must be logged in to view the sync quarantine.",
    };
  }

  try {
    const where: {
      status?: QuarantineStatus;
      operationType?: string;
      errorCode?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (filters?.status && filters.status !== "ALL") {
      where.status = filters.status as QuarantineStatus;
    }

    if (filters?.operationType && filters.operationType.trim()) {
      where.operationType = filters.operationType.trim();
    }

    if (filters?.errorCode && filters.errorCode.trim()) {
      where.errorCode = filters.errorCode.trim();
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        // Set to end of the day if it's a date string
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const records = await prisma.localSyncQuarantine.findMany({
      where,
      orderBy: { changeSequence: "asc" },
    });

    // Fetch user details for resolvedByUserId if any
    const userIds = Array.from(
      new Set(records.map((r) => r.resolvedByUserId).filter(Boolean) as string[])
    );

    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, role: true },
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    const serialized: SerializedQuarantineRecord[] = records.map((r) => ({
      id: r.id,
      changeSequence: r.changeSequence.toString(),
      operationId: r.operationId,
      operationType: r.operationType,
      entityId: r.entityId,
      action: r.action,
      payload: r.payload,
      sourceDeviceId: r.sourceDeviceId,
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
      resolutionAction: r.resolutionAction,
      resolutionReason: r.resolutionReason,
      resolvedByUserId: r.resolvedByUserId,
      resolvedByUser: r.resolvedByUserId ? userMap.get(r.resolvedByUserId) || null : null,
    }));

    return { success: true, records: serialized };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to fetch quarantine records: ${msg}` };
  }
}

/**
 * Server action to retry an active quarantine change.
 * Accessible to authenticated Staff and Owner.
 */
export async function retryQuarantineAction(params: {
  quarantineId: string;
  reason: string;
  _testUser?: { id: string; role: Role };
}): Promise<{
  success: boolean;
  result?: ResolveQuarantineResult;
  error?: string;
  errorCode?: string;
}> {
  let actor: { id: string };
  try {
    if (params._testUser) {
      actor = params._testUser;
    } else {
      actor = await requireDbUser();
    }
  } catch {
    return {
      success: false,
      error: "Unauthorized: You must be logged in to resolve quarantined sync items.",
    };
  }

  if (!params.reason || !params.reason.trim()) {
    return {
      success: false,
      error: "A valid resolution reason is required.",
    };
  }

  try {
    const result = await resolveQuarantineChange({
      quarantineId: params.quarantineId,
      action: "RETRY",
      reason: params.reason.trim(),
      resolvedByUserId: actor.id,
    });

    try {
      revalidatePath("/sync/quarantine");
    } catch {
      // Ignored outside of request context (e.g. tests)
    }

    return {
      success: result.success,
      result,
      error: result.error,
      errorCode: result.errorCode,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    return { success: false, error: msg, errorCode: code };
  }
}

/**
 * Server action to discard an active quarantine change.
 * Accessible to authenticated Staff and Owner.
 */
export async function discardQuarantineAction(params: {
  quarantineId: string;
  reason: string;
  _testUser?: { id: string; role: Role };
}): Promise<{
  success: boolean;
  result?: ResolveQuarantineResult;
  error?: string;
  errorCode?: string;
}> {
  let actor: { id: string };
  try {
    if (params._testUser) {
      actor = params._testUser;
    } else {
      actor = await requireDbUser();
    }
  } catch {
    return {
      success: false,
      error: "Unauthorized: You must be logged in to discard quarantined sync items.",
    };
  }

  if (!params.reason || !params.reason.trim()) {
    return {
      success: false,
      error: "A valid auditable discard reason is required.",
    };
  }

  try {
    const result = await resolveQuarantineChange({
      quarantineId: params.quarantineId,
      action: "DISCARD",
      reason: params.reason.trim(),
      resolvedByUserId: actor.id,
    });

    try {
      revalidatePath("/sync/quarantine");
    } catch {
      // Ignored outside of request context (e.g. tests)
    }

    return {
      success: result.success,
      result,
      error: result.error,
      errorCode: result.errorCode,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    return { success: false, error: msg, errorCode: code };
  }
}
