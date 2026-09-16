/**
 * Phase 4 Sync — Cloud Pull Service (Server Engine)
 *
 * Implements the server-side incremental query over SyncChangeLog for
 * authenticated SyncDevices.
 *
 * Rules:
 *  - Queries changes strictly after the supplied cursor (WHERE changeSequence > cursor).
 *  - Strictly ordered by changeSequence ASC.
 *  - Enforces batchSize limit (default 50, maximum 100).
 *  - Does NOT filter out sourceDeviceId != deviceId. Devices receive their own changes
 *    when needed for cursor reconciliation.
 *  - Returns complete SyncChangeRecord including immutable operationId.
 */

import { type SyncDevice } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  SyncBatchPullPayload,
  SyncBatchPullResponse,
  SyncChangeRecord,
  SyncOperationType,
} from "@/lib/sync/types";

export const DEFAULT_PULL_BATCH_SIZE = 50;
export const MAX_PULL_BATCH_SIZE = 100;
export const PULL_SCHEMA_VERSION = "1.0";

export class PullError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.name = "PullError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Executes an incremental pull query on Cloud PostgreSQL for an authenticated device.
 */
export async function fetchDevicePullBatch(
  device: SyncDevice,
  payload: SyncBatchPullPayload
): Promise<SyncBatchPullResponse> {
  // 1. Schema version validation
  if (!payload.schemaVersion || payload.schemaVersion !== PULL_SCHEMA_VERSION) {
    throw new PullError(
      `Unsupported schema version: '${payload.schemaVersion}'. Expected '${PULL_SCHEMA_VERSION}'.`,
      "SCHEMA_VERSION_MISMATCH",
      422
    );
  }

  // 2. Device ID match validation
  if (!payload.deviceId || payload.deviceId !== device.deviceId) {
    throw new PullError(
      `Body deviceId '${payload.deviceId}' does not match authenticated device '${device.deviceId}'.`,
      "DEVICE_ID_MISMATCH",
      400
    );
  }

  // 3. Cursor validation
  const rawCursor = payload.cursor ?? payload.lastSequence ?? "0";
  let cursorSeq: bigint;
  try {
    cursorSeq = BigInt(rawCursor);
    if (cursorSeq < BigInt(0)) {
      throw new Error("negative");
    }
  } catch {
    throw new PullError(
      "Cursor / lastSequence must be a non-negative integer string.",
      "INVALID_CURSOR",
      400
    );
  }

  // 4. Batch size bounding
  let batchSize = DEFAULT_PULL_BATCH_SIZE;
  if (payload.batchSize !== undefined && payload.batchSize !== null) {
    if (
      typeof payload.batchSize !== "number" ||
      !Number.isInteger(payload.batchSize) ||
      payload.batchSize <= 0
    ) {
      throw new PullError(
        "batchSize must be a positive integer.",
        "INVALID_BATCH_SIZE",
        400
      );
    }
    batchSize = Math.min(payload.batchSize, MAX_PULL_BATCH_SIZE);
  }

  // 5. Query SyncChangeLog strictly after cursor
  // Fetch batchSize + 1 to determine hasMore without a secondary COUNT query
  const changes = await prisma.syncChangeLog.findMany({
    where: {
      changeSequence: { gt: cursorSeq },
    },
    orderBy: {
      changeSequence: "asc",
    },
    take: batchSize + 1,
  });

  const hasMore = changes.length > batchSize;
  const batchChanges = hasMore ? changes.slice(0, batchSize) : changes;

  // 6. Map to canonical SyncChangeRecord
  const mappedChanges: SyncChangeRecord[] = batchChanges.map((c) => ({
    changeSequence: c.changeSequence.toString(),
    operationId: c.operationId,
    operationType: c.operationType as SyncOperationType,
    entityId: c.entityId,
    action: c.action,
    payload: c.payload as Record<string, unknown>,
    sourceDeviceId: c.sourceDeviceId,
    createdAt: c.createdAt.toISOString(),
  }));

  const fromSequence = cursorSeq.toString();
  const toSequence =
    batchChanges.length > 0
      ? batchChanges[batchChanges.length - 1].changeSequence.toString()
      : fromSequence;

  // 7. Update device heartbeat
  await prisma.syncDevice.update({
    where: { deviceId: device.deviceId },
    data: { lastSeenAt: new Date() },
  });

  return {
    success: true,
    deviceId: device.deviceId,
    fromSequence,
    toSequence,
    changes: mappedChanges,
    hasMore,
    serverTimestamp: new Date().toISOString(),
  };
}
