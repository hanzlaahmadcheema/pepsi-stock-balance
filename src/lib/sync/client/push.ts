/**
 * Phase 2 Sync — Local Depot Push Service
 *
 * Called explicitly (NOT run as a background daemon) to push pending operations
 * from the local SyncOutbox to the cloud sync push endpoint.
 *
 * Sequence Invariant:
 *   A sequence cannot advance past a failed operation until that exact operation
 *   is successfully resolved/retried. If an operation at sequence N is FAILED,
 *   operations N+1... cannot be pushed and remain PENDING.
 *
 * Algorithm:
 *   1. Recover any orphaned IN_FLIGHT records (crash-safe).
 *   2. Check if any FAILED operations block the sequence queue. If so, only
 *      operations with clientSequence < firstFailed.clientSequence can be pushed.
 *      Subsequent operations remain safely blocked in PENDING.
 *   3. Mark the candidate batch as IN_FLIGHT.
 *   4. Send to cloud via HTTP POST.
 *   5. For each ACK'd operationId: mark SYNCED.
 *   6. For each rejected operationId: if DETERMINISTIC → mark FAILED (quarantine).
 *      If TRANSIENT → reset to PENDING and increment retryCount.
 *   7. Return a structured result for the caller to act on.
 *
 * Retrying:
 *   Call `retryFailedOperation(operationId, ...)` to reset a FAILED record back to
 *   PENDING under the exact SAME operationId and clientSequence once the root cause
 *   is resolved.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { SyncOperation, SyncBatchPushPayload, SyncBatchPushResponse } from "@/lib/sync/types";

export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ─── Advisory Lock Constants ──────────────────────────────────────────────────

/**
 * 64-bit PostgreSQL Advisory Lock ID for single-flight push synchronization.
 * Ensures only ONE push cycle operates on this local depot database at any time.
 */
export const SYNC_PUSH_ADVISORY_LOCK_ID = BigInt("88492001");

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of operations to include in a single push batch. */
const BATCH_LIMIT = 20;

/**
 * Operations that have been IN_FLIGHT for longer than this are assumed to be
 * orphaned (process crash mid-push) and reset to PENDING.
 */
const IN_FLIGHT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Maximum number of retry attempts before an operation is permanently quarantined
 * as FAILED even for transient errors.
 */
const MAX_RETRY_COUNT = 10;

const SCHEMA_VERSION = "1.0";

// ─── Result types ─────────────────────────────────────────────────────────────

export interface PushResult {
  /** True if all operations in the batch were acknowledged. */
  success: boolean;
  /** Number of operations ACK'd by the cloud. */
  syncedCount: number;
  /** Number of operations permanently failed (quarantined). */
  failedCount: number;
  /** Number of operations reset for retry (transient error). */
  retryCount: number;
  /** True if the local outbox had no PENDING operations to push. */
  nothingToPush: boolean;
  /** True if another push cycle was already running (advisory lock not acquired). */
  alreadyRunning?: boolean;
  /** Operation ID of a failed operation blocking the queue, if applicable. */
  blockedByFailedOperationId?: string;
  /** Raw server response, if a network call was made. */
  serverResponse?: SyncBatchPushResponse;
  /** Network/auth error message, if the entire push request failed. */
  networkError?: string;
}

// ─── IN_FLIGHT recovery ───────────────────────────────────────────────────────

/**
 * Resets orphaned IN_FLIGHT operations back to PENDING so they are retried.
 * This handles the case where the local process crashed after marking ops
 * IN_FLIGHT but before receiving a response.
 */
async function recoverOrphanedInFlightOps(
  client: TransactionClient | PrismaClient = prisma
): Promise<void> {
  const cutoff = new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS);
  await client.syncOutbox.updateMany({
    where: {
      status: "IN_FLIGHT",
      createdAt: { lt: cutoff },
    },
    data: {
      status: "PENDING",
      lastError: "Recovered from IN_FLIGHT timeout (process crash recovery).",
    },
  });
}

// ─── Outbox Sequence Compaction ───────────────────────────────────────────────

/**
 * Automatically compacts and normalizes clientSequence values for all unapplied outbox records
 * (PENDING, IN_FLIGHT, FAILED) to guarantee they are strictly contiguous starting from (lastSyncedSeq + 1).
 *
 * This prevents SEQUENCE_GAP rejections caused by:
 * 1. Database restarts, resets, or transaction rollbacks that burn PostgreSQL sequence IDs.
 * 2. Unsynced local operations starting at a sequence > 1 on initial terminal push.
 */
async function compactOutboxSequences(tx: TransactionClient): Promise<void> {
  const lastSynced = await tx.syncOutbox.findFirst({
    where: { status: "SYNCED" },
    orderBy: { clientSequence: "desc" },
    select: { clientSequence: true },
  });

  const baseSeq = lastSynced ? lastSynced.clientSequence : BigInt(0);

  const unappliedRows = await tx.syncOutbox.findMany({
    where: { status: { in: ["PENDING", "IN_FLIGHT", "FAILED"] } },
    orderBy: { clientSequence: "asc" },
    select: { id: true, clientSequence: true },
  });

  if (unappliedRows.length === 0) return;

  let needsCompaction = false;
  // Check for internal sequence gaps between unapplied operations (e.g. 1, 3, 4)
  for (let i = 1; i < unappliedRows.length; i++) {
    if (unappliedRows[i].clientSequence !== unappliedRows[i - 1].clientSequence + BigInt(1)) {
      needsCompaction = true;
      break;
    }
  }

  // Check for gap between last SYNCED operation and the first unapplied operation
  if (baseSeq > BigInt(0) && unappliedRows[0].clientSequence !== baseSeq + BigInt(1)) {
    needsCompaction = true;
  }

  if (!needsCompaction) return;

  // Use a temporary high offset to avoid unique constraint collisions during renumbering
  await tx.$executeRaw`
    UPDATE "SyncOutbox"
    SET "clientSequence" = "clientSequence" + 9000000000000000000::bigint
    WHERE status IN ('PENDING', 'IN_FLIGHT', 'FAILED')
  `;

  // Renumber contiguously starting from baseSeq + 1
  await tx.$executeRaw`
    WITH numbered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY "clientSequence" ASC) as rn
      FROM "SyncOutbox"
      WHERE status IN ('PENDING', 'IN_FLIGHT', 'FAILED')
    )
    UPDATE "SyncOutbox" s
    SET "clientSequence" = ${baseSeq} + numbered.rn
    FROM numbered
    WHERE s.id = numbered.id
  `;
}

// ─── Local Catalog Outbox Backfill ──────────────────────────────────────────

/**
 * Ensures all local products, prices, customers, and suppliers have corresponding
 * outbox records enqueued before transactions that reference them are pushed.
 */
async function ensureLocalCatalogEnqueued(tx: TransactionClient): Promise<void> {
  // 1. Products
  const existingProductIds = new Set(
    (
      await tx.syncOutbox.findMany({
        where: { operationType: "UPSERT_PRODUCT" },
        select: { entityId: true },
      })
    ).map((r) => r.entityId)
  );
  const products = await tx.product.findMany();
  for (const p of products) {
    if (!existingProductIds.has(p.id)) {
      await tx.syncOutbox.create({
        data: {
          operationId: crypto.randomUUID(),
          operationType: "UPSERT_PRODUCT",
          entityId: p.id,
          payload: {
            name: p.name,
            brand: p.brand,
            sku: p.sku,
            minimumStockLevel: p.minimumStockLevel,
            latestPurchasePrice: Number(p.latestPurchasePrice),
            isActive: p.isActive,
          },
          status: "PENDING",
        },
      });
      existingProductIds.add(p.id);
    }
  }

  // 2. Active Prices
  const existingPriceIds = new Set(
    (
      await tx.syncOutbox.findMany({
        where: { operationType: "CREATE_PRICE" },
        select: { entityId: true },
      })
    ).map((r) => r.entityId)
  );
  const prices = await tx.price.findMany({
    where: { effectiveTo: null },
  });
  for (const pr of prices) {
    if (!existingPriceIds.has(pr.id)) {
      await tx.syncOutbox.create({
        data: {
          operationId: crypto.randomUUID(),
          operationType: "CREATE_PRICE",
          entityId: pr.id,
          payload: {
            productId: pr.productId,
            tier: pr.tier,
            amount: Number(pr.amount),
            userId: pr.createdById || undefined,
          },
          status: "PENDING",
        },
      });
      existingPriceIds.add(pr.id);
    }
  }

  // 3. Customers
  const existingCustomerIds = new Set(
    (
      await tx.syncOutbox.findMany({
        where: { operationType: "UPSERT_CUSTOMER" },
        select: { entityId: true },
      })
    ).map((r) => r.entityId)
  );
  const customers = await tx.customer.findMany();
  for (const c of customers) {
    if (!existingCustomerIds.has(c.id)) {
      await tx.syncOutbox.create({
        data: {
          operationId: crypto.randomUUID(),
          operationType: "UPSERT_CUSTOMER",
          entityId: c.id,
          payload: {
            name: c.name,
            phone: c.phone,
            address: c.address,
            priceTier: c.priceTier,
            creditAllowed: c.creditAllowed,
            isActive: c.isActive,
          },
          status: "PENDING",
        },
      });
      existingCustomerIds.add(c.id);
    }
  }

  // 4. Suppliers
  const existingSupplierIds = new Set(
    (
      await tx.syncOutbox.findMany({
        where: { operationType: "UPSERT_SUPPLIER" },
        select: { entityId: true },
      })
    ).map((r) => r.entityId)
  );
  const suppliers = await tx.supplier.findMany();
  for (const s of suppliers) {
    if (!existingSupplierIds.has(s.id)) {
      await tx.syncOutbox.create({
        data: {
          operationId: crypto.randomUUID(),
          operationType: "UPSERT_SUPPLIER",
          entityId: s.id,
          payload: {
            id: s.id,
            name: s.name,
            contactPerson: s.contactPerson,
            phone: s.phone,
            address: s.address,
            isActive: s.isActive,
          },
          status: "PENDING",
        },
      });
      existingSupplierIds.add(s.id);
    }
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

/**
 * Builds the `Authorization` header value from the raw device token.
 * The token is never logged or stored — it is passed transiently.
 */
function buildAuthHeaders(deviceId: string, rawToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${rawToken}`,
    "X-Device-Id": deviceId,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Pushes pending local SyncOutbox operations to the cloud sync endpoint.
 *
 * Concurrency Protection:
 *   Uses PostgreSQL non-blocking transaction-level advisory locking (pg_try_advisory_xact_lock)
 *   to guarantee that only ONE push cycle can operate on this local database at any time.
 *   If another worker already holds the lock, returns `{ alreadyRunning: true }` without blocking,
 *   without incrementing retry counters, and without modifying outbox state.
 *
 * @param cloudBaseUrl  Base URL of the cloud deployment (e.g. "https://app.example.com").
 * @param deviceId      The `SyncDevice.deviceId` for this local depot server.
 * @param rawToken      The raw (unhashed) device token. Never persisted here.
 * @param fetchFn       Optional custom fetch implementation (defaults to global fetch).
 * @param dbClient      Optional PrismaClient instance (defaults to prisma singleton).
 * @returns             Structured `PushResult`.
 */
export async function pushPendingOperations(
  cloudBaseUrl: string,
  deviceId: string,
  rawToken: string,
  fetchFn: typeof fetch = fetch,
  dbClient: PrismaClient = prisma
): Promise<PushResult> {
  return await dbClient.$transaction(
    async (tx: TransactionClient) => {
      // 1. Acquire single-flight transaction advisory lock for push
      const lockRows = await tx.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${SYNC_PUSH_ADVISORY_LOCK_ID}) as acquired
      `;

      if (!lockRows[0]?.acquired) {
        return {
          success: true,
          alreadyRunning: true,
          syncedCount: 0,
          failedCount: 0,
          retryCount: 0,
          nothingToPush: false,
        };
      }

      // 2. Recover orphaned IN_FLIGHT operations from a prior crash.
      await recoverOrphanedInFlightOps(tx);

      // 2a. Auto-recover operations that were previously marked FAILED due to transient or recoverable conditions
      await tx.syncOutbox.updateMany({
        where: {
          status: "FAILED",
          OR: [
            { lastError: { contains: "Supplier not found" } },
            { lastError: { contains: "Product not found" } },
            { lastError: { contains: "Customer not found" } },
            { lastError: { contains: "Foreign key constraint" } },
            { lastError: { contains: "already been posted" } },
            { lastError: { contains: "already cancelled" } },
            { lastError: { contains: "Unique constraint failed" } },
            { lastError: { contains: "Max retries" } },
            { lastError: { contains: "Insufficient stock" } },
            { lastError: { contains: "Invoice not found" } },
          ],
        },
        data: {
          status: "PENDING",
          lastError: null,
          retryCount: 0,
        },
      });

      // 2b. Ensure catalog records (products, prices, customers, suppliers) exist in SyncOutbox
      await ensureLocalCatalogEnqueued(tx);

      // 2c. Compact sequences to guarantee strict contiguity
      await compactOutboxSequences(tx);

      // 3. Check if any FAILED operations exist in the outbox.
      // Under strict sequence ordering, no operation at or after a FAILED operation
      // can be pushed until that failed operation is resolved.
      const firstFailed = await tx.syncOutbox.findFirst({
        where: { status: "FAILED" },
        orderBy: { clientSequence: "asc" },
      });

      // 4. Load the next batch of PENDING operations strictly preceding the first failed op.
      const whereClause: { status: "PENDING"; clientSequence?: { lt: bigint } } = {
        status: "PENDING",
      };
      if (firstFailed) {
        whereClause.clientSequence = { lt: firstFailed.clientSequence };
      }

      const pendingRows = await tx.syncOutbox.findMany({
        where: whereClause,
        orderBy: { clientSequence: "asc" },
        take: BATCH_LIMIT,
      });

      if (pendingRows.length === 0) {
        if (firstFailed) {
          return {
            success: false,
            syncedCount: 0,
            failedCount: 0,
            retryCount: 0,
            nothingToPush: false,
            blockedByFailedOperationId: firstFailed.operationId,
            networkError: `Sync queue is blocked by failed operation ${firstFailed.operationId} (sequence ${firstFailed.clientSequence}). Resolve or retry this operation before subsequent operations can push.`,
          };
        }
        return {
          success: true,
          syncedCount: 0,
          failedCount: 0,
          retryCount: 0,
          nothingToPush: true,
        };
      }

      // 5. Mark entire candidate batch as IN_FLIGHT before sending.
      await tx.syncOutbox.updateMany({
        where: {
          id: { in: pendingRows.map((r) => r.id) },
          status: "PENDING", // Guard against races
        },
        data: { status: "IN_FLIGHT" },
      });

      // 6. Build the push payload.
      const batchId = crypto.randomUUID();
      const operations: SyncOperation[] = pendingRows.map((row) => ({
        operationId: row.operationId,
        clientSequence: row.clientSequence.toString(),
        operationType: row.operationType as SyncOperation["operationType"],
        entityId: row.entityId,
        payload: row.payload as Record<string, unknown>,
        clientCreatedAt: row.createdAt.toISOString(),
      }));

      const pushPayload: SyncBatchPushPayload = {
        deviceId,
        batchId,
        schemaVersion: SCHEMA_VERSION,
        operations,
      };

      // 7. Send to cloud.
      let serverResponse: SyncBatchPushResponse;
      try {
        const response = await fetchFn(`${cloudBaseUrl}/api/sync/push`, {
          method: "POST",
          headers: buildAuthHeaders(deviceId, rawToken),
          body: JSON.stringify(pushPayload),
        });

        if (!response.ok && response.status !== 207) {
          // Non-2xx that isn't 207 Multi-Status: treat as transient network error.
          const errorText = await response.text().catch(() => "Unknown body");

          // Check if server rejected due to sequence gap and indicated expected sequence
          const gapMatch = errorText.match(/expected\s+(\d+)/i);
          if (gapMatch && gapMatch[1]) {
            const expSeq = BigInt(gapMatch[1]);
            await tx.$executeRaw`
              UPDATE "SyncOutbox"
              SET "clientSequence" = "clientSequence" + 9000000000000000000::bigint
              WHERE status IN ('IN_FLIGHT', 'PENDING')
            `;
            await tx.$executeRaw`
              WITH numbered AS (
                SELECT id, ROW_NUMBER() OVER (ORDER BY "clientSequence" ASC) as rn
                FROM "SyncOutbox"
                WHERE status IN ('IN_FLIGHT', 'PENDING')
              )
              UPDATE "SyncOutbox" s
              SET "clientSequence" = ${expSeq} + numbered.rn - 1,
                  status = 'PENDING',
                  "lastError" = 'Sequence aligned after server request.'
              FROM numbered
              WHERE s.id = numbered.id
            `;
            return {
              success: false,
              syncedCount: 0,
              failedCount: 0,
              retryCount: pendingRows.length,
              nothingToPush: false,
              networkError: `Aligned outbox sequences to ${expSeq} after server sequence gap detection.`,
            };
          }

          // Reset all IN_FLIGHT back to PENDING for retry.
          await tx.syncOutbox.updateMany({
            where: { id: { in: pendingRows.map((r) => r.id) }, status: "IN_FLIGHT" },
            data: {
              status: "PENDING",
              lastError: `HTTP ${response.status}: ${errorText.slice(0, 500)}`,
              retryCount: { increment: 1 },
            },
          });
          return {
            success: false,
            syncedCount: 0,
            failedCount: 0,
            retryCount: pendingRows.length,
            nothingToPush: false,
            networkError: `HTTP ${response.status}: ${errorText.slice(0, 200)}`,
          };
        }

        serverResponse = (await response.json()) as SyncBatchPushResponse;
      } catch (err) {
        // Network-level failure (DNS, connection refused, timeout, etc.) — transient.
        const errorMessage = err instanceof Error ? err.message : String(err);
        await tx.syncOutbox.updateMany({
          where: { id: { in: pendingRows.map((r) => r.id) }, status: "IN_FLIGHT" },
          data: {
            status: "PENDING",
            lastError: `Network error: ${errorMessage.slice(0, 500)}`,
            retryCount: { increment: 1 },
          },
        });
        return {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          retryCount: pendingRows.length,
          nothingToPush: false,
          networkError: errorMessage,
        };
      }

      // 8. Apply server response to local outbox records.
      const ackedSet = new Set(serverResponse.acknowledgedOperationIds ?? []);
      const rejectedMap = new Map(
        (serverResponse.rejectedOperations ?? []).map((r) => [r.operationId, r])
      );

      let syncedCount = 0;
      let failedCount = 0;
      let retryCount = 0;

      for (const row of pendingRows) {
        if (ackedSet.has(row.operationId)) {
          // Cloud confirmed success.
          await tx.syncOutbox.update({
            where: { id: row.id },
            data: { status: "SYNCED", syncedAt: new Date(), lastError: null },
          });
          syncedCount++;
        } else if (rejectedMap.has(row.operationId)) {
          const rejection = rejectedMap.get(row.operationId)!;

          // Check if rejection was actually due to entity already being recorded/applied
          const isAlreadyApplied =
            rejection.error.includes("already been posted") ||
            rejection.error.includes("already exists") ||
            rejection.error.includes("already cancelled") ||
            rejection.error.includes("already finalized") ||
            rejection.error.includes("already resolved") ||
            rejection.error.includes("Unique constraint failed");

          if (isAlreadyApplied) {
            // The server already processed this record in a prior attempt that dropped connection
            await tx.syncOutbox.update({
              where: { id: row.id },
              data: {
                status: "SYNCED",
                syncedAt: new Date(),
                lastError: null,
              },
            });
            syncedCount++;
            continue;
          }

          if (rejection.errorCode === "SEQUENCE_GAP" && rejection.expectedSequence) {
            // Self-healing sequence alignment:
            // Cloud indicates what sequence it expects next from this device.
            // Re-align unapplied operations to start at expectedSequence and keep as PENDING.
            const expSeq = BigInt(rejection.expectedSequence);
            const tempOffset = BigInt("9000000000000000000");
            const remaining = await tx.syncOutbox.findMany({
              where: { status: { in: ["IN_FLIGHT", "PENDING"] } },
              orderBy: { clientSequence: "asc" },
              select: { id: true },
            });
            for (let i = 0; i < remaining.length; i++) {
              await tx.syncOutbox.update({
                where: { id: remaining[i].id },
                data: { clientSequence: tempOffset + BigInt(i) },
              });
            }
            let s = expSeq;
            for (let i = 0; i < remaining.length; i++) {
              await tx.syncOutbox.update({
                where: { id: remaining[i].id },
                data: {
                  clientSequence: s,
                  status: "PENDING",
                  lastError: `Sequence aligned to ${s} (server requested ${rejection.expectedSequence}).`,
                },
              });
              s += BigInt(1);
            }
            retryCount += remaining.length;
            break;
          }

          const isDeterministic =
            rejection.errorCode !== "TRANSIENT_ERROR" &&
            rejection.errorCode !== undefined;

          // Check if error is missing catalog data which can be backfilled
          const isMissingCatalogData =
            rejection.error.includes("Supplier not found") ||
            rejection.error.includes("Product not found") ||
            rejection.error.includes("Customer not found") ||
            rejection.error.includes("Foreign key constraint");

          if (isDeterministic && !isMissingCatalogData) {
            // Permanent validation failure — quarantine.
            await tx.syncOutbox.update({
              where: { id: row.id },
              data: {
                status: "FAILED",
                lastError: `[${rejection.errorCode}] ${rejection.error}`,
              },
            });
            failedCount++;
          } else {
            // Transient or recoverable catalog error — keep as PENDING for retry.
            // Never permanently fail a transient error due to retry count!
            const newRetryCount = (row.retryCount ?? 0) + 1;
            await tx.syncOutbox.update({
              where: { id: row.id },
              data: {
                status: "PENDING",
                lastError: rejection.error,
                retryCount: newRetryCount,
              },
            });
            retryCount++;
          }
        } else {
          // Not in ACK list and not in rejected list: operation was not processed
          // (batch stopped before reaching it). Reset to PENDING without incrementing retries.
          await tx.syncOutbox.update({
            where: { id: row.id },
            data: { status: "PENDING", lastError: "Batch stopped before this operation was reached." },
          });
        }
      }

      return {
        success: serverResponse.success,
        syncedCount,
        failedCount,
        retryCount,
        nothingToPush: false,
        serverResponse,
      };
    },
    { timeout: 300000, maxWait: 30000 }
  );
}

/**
 * Resets a FAILED SyncOutbox operation back to PENDING so it can be retried.
 * Preserves the exact same operationId and clientSequence.
 *
 * @param operationId            The UUID of the failed operation in SyncOutbox.
 * @param options.updatedPayload Optional corrected payload if fixing invalid data before retry.
 * @param options.updatedOperationType Optional corrected operation type.
 * @returns The updated SyncOutbox record.
 */
export async function retryFailedOperation(
  operationId: string,
  options: {
    updatedPayload?: Prisma.InputJsonValue;
    updatedOperationType?: string;
  } = {}
) {
  const existing = await prisma.syncOutbox.findUnique({
    where: { operationId },
  });

  if (!existing) {
    throw new Error(`SyncOutbox operation with ID '${operationId}' not found.`);
  }

  if (existing.status !== "FAILED") {
    throw new Error(
      `Cannot retry operation '${operationId}': current status is '${existing.status}', expected 'FAILED'.`
    );
  }

  return await prisma.syncOutbox.update({
    where: { operationId },
    data: {
      status: "PENDING",
      lastError: null,
      retryCount: 0,
      ...(options.updatedPayload !== undefined ? { payload: options.updatedPayload } : {}),
      ...(options.updatedOperationType ? { operationType: options.updatedOperationType } : {}),
    },
  });
}
