/**
 * Phase 2 Sync — Cloud Push Batch Processor
 *
 * Implements stop-on-first-error batch semantics with per-operation idempotency:
 *
 *   For each operation in clientSequence order:
 *     1. Check ProcessedSyncOperation for duplicate operationId → return cached ACK/rejection.
 *     2. Prevent sequence reuse with a different operationId (UNIQUE deviceId, clientSequence).
 *     3. Validate clientSequence is exactly (lastAcceptedSeq + 1) for this device.
 *     4. BEGIN TRANSACTION
 *        a. dispatchDomainOperation(tx, op, device)
 *        b. INSERT ProcessedSyncOperation (idempotency record)
 *        c. COMMIT
 *     5. On success → ACK this operation, update lastCommittedSeq, continue to next.
 *     6. On any failure (including UnimplementedOperationError) → transaction rolls back
 *        (no ProcessedSyncOperation remains), record rejection, STOP BATCH
 *        (subsequent ops in batch remain unexecuted).
 *
 * After the loop: update SyncDevice.lastSeenAt and SyncDevice.lastSequence with
 * the highest committed clientSequence.
 *
 * NOTE: SyncChangeLog writes are intentionally NOT part of this phase.
 * The clean extension point is marked with "TODO Phase 3+" inside the transaction.
 */

import { prisma } from "@/lib/prisma";
import {
  UnsupportedOperationError,
  UnimplementedOperationError,
  dispatchDomainOperation,
} from "./operation-dispatcher";
import type { SyncOperation, SyncBatchPushResponse } from "@/lib/sync/types";
import type { SyncDevice } from "@prisma/client";

// ─── Error classification ─────────────────────────────────────────────────────

/** Transient errors where retrying without changing payload might succeed (connection/deadlock). */
const TRANSIENT_ERROR_CODES = new Set([
  "P1000", // Authentication failed against DB
  "P1001", // Can't reach database server
  "P1002", // Database server timed out
  "P1008", // Operations timed out
  "P1011", // Error opening a TLS connection
  "P1017", // Server closed connection
  "P2024", // Timed out fetching connection from pool
  "P2028", // Transaction API error
  "P2034", // Transaction failed due to write conflict or deadlock
]);

function isDeterministicError(err: unknown): boolean {
  if (
    err instanceof UnsupportedOperationError ||
    err instanceof UnimplementedOperationError
  ) {
    return true;
  }
  if (err instanceof Error) {
    if (
      err.name === "UnsupportedOperationError" ||
      err.name === "UnimplementedOperationError"
    ) {
      return true;
    }
    const code = (err as Error & { code?: string }).code;
    if (code && TRANSIENT_ERROR_CODES.has(code)) {
      return false;
    }
    const msg = err.message.toLowerCase();
    if (
      msg.includes("connection pool") ||
      msg.includes("timed out") ||
      msg.includes("econnrefused") ||
      msg.includes("socket hang up") ||
      msg.includes("connection reset")
    ) {
      return false;
    }
    // Business rule violations, validation errors, and entity constraint errors are deterministic
    return true;
  }
  return false;
}

// ─── Sequence tracking ───────────────────────────────────────────────────────

/**
 * Returns the highest `clientSequence` that has been successfully committed for
 * this device, or 0n if no operations have been processed yet.
 * Takes the maximum of the highest ProcessedSyncOperation sequence and the device's recorded lastSequence.
 */
async function getLastAcceptedSequence(deviceId: string): Promise<bigint> {
  const lastOp = await prisma.processedSyncOperation.findFirst({
    where: { deviceId, status: "SUCCESS" },
    orderBy: { clientSequence: "desc" },
    select: { clientSequence: true },
  });
  const deviceRecord = await prisma.syncDevice.findUnique({
    where: { deviceId },
    select: { lastSequence: true },
  });

  const opSeq = lastOp?.clientSequence ?? BigInt(0);
  const devSeq = deviceRecord?.lastSequence ?? BigInt(0);
  return opSeq > devSeq ? opSeq : devSeq;
}

// ─── Per-operation ACK types ─────────────────────────────────────────────────

interface RejectedOp {
  operationId: string;
  error: string;
  errorCode?: string;
  expectedSequence?: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Processes a validated push batch from an authenticated device.
 *
 * @param device      Authenticated `SyncDevice` (from `authenticateDevice`).
 * @param batchId     Client-generated batch UUID (echoed in response).
 * @param operations  Operations already sorted by `clientSequence` ASC by the caller.
 * @returns           `SyncBatchPushResponse` ready to serialize and return.
 */
export async function processDevicePushBatch(
  device: SyncDevice,
  batchId: string,
  operations: SyncOperation[]
): Promise<SyncBatchPushResponse> {
  const acknowledgedOperationIds: string[] = [];
  const rejectedOperations: RejectedOp[] = [];

  let lastCommittedSeq: bigint = await getLastAcceptedSequence(device.deviceId);

  for (const operation of operations) {
    const clientSeq = BigInt(operation.clientSequence);

    // ── Step 1: Check for duplicate operationId (idempotency replay) ─────────
    const existingByOpId = await prisma.processedSyncOperation.findUnique({
      where: { operationId: operation.operationId },
    });

    if (existingByOpId) {
      if (existingByOpId.status === "SUCCESS") {
        acknowledgedOperationIds.push(operation.operationId);
        if (existingByOpId.clientSequence > lastCommittedSeq) {
          lastCommittedSeq = existingByOpId.clientSequence;
        }
      } else {
        // Previously rejected
        rejectedOperations.push({
          operationId: operation.operationId,
          error: existingByOpId.errorMessage ?? "Operation was previously rejected.",
          errorCode: "PREVIOUSLY_REJECTED",
        });
        break; // stop-on-first-error
      }
      continue;
    }

    // ── Step 2: Prevent sequence reuse with a different operationId ──────────
    const existingBySeq = await prisma.processedSyncOperation.findUnique({
      where: {
        deviceId_clientSequence: {
          deviceId: device.deviceId,
          clientSequence: clientSeq,
        },
      },
    });

    if (existingBySeq) {
      const reuseError = `clientSequence ${clientSeq} was already used by operation ${existingBySeq.operationId}. Sequence reuse is forbidden.`;
      rejectedOperations.push({
        operationId: operation.operationId,
        error: reuseError,
        errorCode: "SEQUENCE_REUSE_FORBIDDEN",
      });
      break; // stop-on-first-error
    }

    // ── Step 3: Strict per-device sequence validation ────────────────────────
    const expectedSeq = lastCommittedSeq + BigInt(1);
    if (clientSeq !== expectedSeq) {
      const gapError =
        clientSeq < expectedSeq
          ? `clientSequence ${clientSeq} is obsolete (expected ${expectedSeq}).`
          : `clientSequence gap detected: expected ${expectedSeq}, got ${clientSeq}. Missing operations must be pushed first.`;

      rejectedOperations.push({
        operationId: operation.operationId,
        error: gapError,
        errorCode: "SEQUENCE_GAP",
        expectedSequence: expectedSeq.toString(),
      });
      break; // stop-on-first-error: do NOT insert ProcessedSyncOperation for unapplied gap ops
    }

    // ── Step 4: Process inside an atomic transaction ─────────────────────────
    try {
      await prisma.$transaction(
        async (tx) => {
          // 4a. Dispatch business logic
          await dispatchDomainOperation(tx, operation, device);

          // 4b. Record idempotency proof — committed atomically with the mutation.
          await tx.processedSyncOperation.create({
            data: {
              operationId: operation.operationId,
              deviceId: device.deviceId,
              clientSequence: clientSeq,
              operationType: operation.operationType,
              entityId: operation.entityId,
              status: "SUCCESS",
            },
          });
        },
        { timeout: 60000, maxWait: 20000 }
      );

      // ── Step 5: ACK ────────────────────────────────────────────────────────
      acknowledgedOperationIds.push(operation.operationId);
      lastCommittedSeq = clientSeq;
    } catch (err) {
      // ── Step 6: Classify failure and stop batch ────────────────────────────
      // When a transaction rolls back, NO ProcessedSyncOperation remains in the database.
      const deterministic = isDeterministicError(err);
      const errorMessage =
        err instanceof Error ? err.message : `Unknown error: ${String(err)}`;
      let errorCode = deterministic ? "DETERMINISTIC_FAILURE" : "TRANSIENT_ERROR";
      if (
        err instanceof UnimplementedOperationError ||
        (err instanceof Error && err.name === "UnimplementedOperationError")
      ) {
        errorCode = "UNIMPLEMENTED_OPERATION";
      } else if (
        err instanceof UnsupportedOperationError ||
        (err instanceof Error && err.name === "UnsupportedOperationError")
      ) {
        errorCode = "UNSUPPORTED_OPERATION";
      }

      rejectedOperations.push({
        operationId: operation.operationId,
        error: errorMessage,
        errorCode,
      });
      break; // stop-on-first-error: subsequent operations in batch remain unexecuted
    }
  }

  // ── Update device heartbeat with highest committed sequence ─────────────────
  if (lastCommittedSeq > BigInt(0)) {
    await prisma.syncDevice.update({
      where: { deviceId: device.deviceId },
      data: {
        lastSeenAt: new Date(),
        lastSequence: lastCommittedSeq,
      },
    });
  } else {
    await prisma.syncDevice.update({
      where: { deviceId: device.deviceId },
      data: { lastSeenAt: new Date() },
    });
  }

  const success = rejectedOperations.length === 0;

  return {
    success,
    batchId,
    acknowledgedOperationIds,
    rejectedOperations: rejectedOperations.length > 0 ? rejectedOperations : undefined,
    serverTimestamp: new Date().toISOString(),
  };
}
