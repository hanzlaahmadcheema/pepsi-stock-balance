/**
 * Phase 4 Sync — Local Pull Engine (Client Service)
 *
 * Implements Cloud -> Local incremental pull synchronization with deterministic
 * quarantine / block semantics:
 *  1. Retrieves local SyncCursor (high-water mark).
 *  2. Requests incremental changes from Cloud (POST /api/sync/pull).
 *  3. Validates sequence continuity and detects gaps (first change must be lastSequence + 1).
 *  4. Enforces authority partition:
 *     - CLOUD-AUTHORITATIVE: Product, Price, Supplier, User permissions/status
 *     - DEPOT-AUTHORITATIVE: Sale, SaleItem, Payment, ContainerMovement, Receiving delivery intake
 *       (Cloud cannot mutate depot-authoritative data; self-originated changes are reconciled safely)
 *     - CUSTOMER: Halts with CUSTOMER_AUTHORITY_DECISION_REQUIRED if external cloud change arrives
 *  5. Replay Protection: Tracks operationId via LocalProcessedChange to prevent duplicate execution.
 *  6. Deterministic Quarantine & Head-of-Line Protection:
 *     - If a deterministic error occurs on change N (e.g. AUTHORITY_VIOLATION,
 *       CUSTOMER_AUTHORITY_DECISION_REQUIRED, INVALID_PAYLOAD, UNSUPPORTED_OPERATION),
 *       all valid changes before N (1..N-1) are safely applied.
 *     - Change N is persistently recorded in LocalSyncQuarantine with status QUARANTINED.
 *     - SyncCursor advances ONLY to the last successfully applied change (N-1).
 *     - Processing halts: changes after N are NOT applied until N is resolved.
 *     - On future pull attempts, the engine recognizes N is QUARANTINED and returns
 *       a blocked status rather than entering an infinite retry/crash loop.
 *  7. Service-Level Resolution:
 *     - Quarantined changes can be resolved via resolveQuarantineChange() (RETRY or DISCARD).
 *     - Once resolved, LocalSyncQuarantine is updated (audit log retained),
 *       LocalProcessedChange is recorded, and SyncCursor advances to N, unblocking subsequent pulls.
 *  8. Transient Error Handling:
 *     - Network failures, DB disconnects, and lock timeouts throw and roll back without
 *       creating quarantine records, allowing standard retry.
 */

import {
  PriceTier,
  Role,
  Prisma,
  QuarantineStatus,
  type PrismaClient,
  type LocalSyncQuarantine,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  SyncBatchPullPayload,
  SyncBatchPullResponse,
  SyncChangeRecord,
} from "@/lib/sync/types";

export class PullApplyError extends Error {
  code: string;
  sequence?: string;
  operationId?: string;

  constructor(
    message: string,
    code: string,
    details?: { sequence?: string; operationId?: string }
  ) {
    super(message);
    this.name = "PullApplyError";
    this.code = code;
    this.sequence = details?.sequence;
    this.operationId = details?.operationId;
  }
}

export type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Set of Cloud-Authoritative operations allowed to be applied from Cloud to Local
export const CLOUD_AUTHORITATIVE_OPS = new Set<string>([
  "UPSERT_PRODUCT",
  "CREATE_PRICE",
  "UPSERT_SUPPLIER",
  "UPDATE_USER",
  "DELETE_DRAFT_RECEIVING",
]);

// Set of Depot-Authoritative operations where Cloud CANNOT mutate depot state
export const DEPOT_AUTHORITATIVE_OPS = new Set<string>([
  "CREATE_SALE",
  "EDIT_SALE",
  "CANCEL_SALE",
  "POST_RECEIVING",
  "RECORD_PAYMENT",
  "CREATE_RETURN",
  "INSPECT_RETURN",
  "RECORD_DAMAGE",
  "SUBMIT_STOCK_COUNT",
  "RESOLVE_STOCK_ADJUSTMENT",
]);

// Set of error codes representing deterministic errors that warrant quarantine
export const DETERMINISTIC_ERROR_CODES = new Set<string>([
  "AUTHORITY_VIOLATION",
  "CUSTOMER_AUTHORITY_DECISION_REQUIRED",
  "UNSUPPORTED_OPERATION",
  "INVALID_PAYLOAD",
  "CANNOT_DELETE_POSTED_RECEIVING",
  "PRODUCT_NOT_FOUND",
  "NO_ACTIVE_USER",
]);

export function isDeterministicPullError(err: unknown): err is PullApplyError {
  if (err instanceof PullApplyError) {
    return DETERMINISTIC_ERROR_CODES.has(err.code);
  }
  return false;
}

export interface LocalPullApplyResult {
  appliedCount: number;
  newCursor: string;
  hasMore: boolean;
  blocked?: boolean;
  blockedSequence?: string;
  quarantineId?: string;
  quarantineReason?: string;
  quarantineErrorCode?: string;
}

/**
 * Gets or initializes the local SyncCursor.
 */
export async function getLocalSyncCursor(
  client: TransactionClient | PrismaClient = prisma
): Promise<bigint> {
  const cursor = await client.syncCursor.findUnique({
    where: { id: "cloud_cursor" },
  });
  return cursor ? cursor.lastSequence : BigInt(0);
}

/**
 * Applies a received Cloud pull batch to the local database.
 *
 * Guarantees:
 *  - Crash-safe & Atomicity: Changes applied up to any deterministic block are committed atomically.
 *  - Replay-safe: Idempotent against duplicate changes or retried batches.
 *  - Cursor-safe: SyncCursor advances only to the last successfully applied sequence.
 *  - Deterministic Block Protection: Identifies deterministic errors, commits previous valid changes,
 *    records the failure in LocalSyncQuarantine, halts subsequent batch processing, and prevents
 *    infinite retry loops.
 */
export async function applyLocalPullBatch(
  localDeviceId: string,
  batch: SyncBatchPullResponse,
  dbClient: PrismaClient = prisma
): Promise<LocalPullApplyResult> {
  if (!batch.success) {
    throw new PullApplyError(
      batch.error || "Batch indicates failure from server.",
      batch.errorCode || "PULL_BATCH_FAILED"
    );
  }

  // If batch has no changes, nothing to mutate
  if (!batch.changes || batch.changes.length === 0) {
    const currentCursor = await getLocalSyncCursor(dbClient);
    return {
      appliedCount: 0,
      newCursor: currentCursor.toString(),
      hasMore: batch.hasMore,
      blocked: false,
    };
  }

  // Execute batch processing inside an interactive transaction
  return await dbClient.$transaction(
    async (tx) => {
      // 1. Fetch current local cursor inside the transaction
      const currentCursor = await getLocalSyncCursor(tx);

      // 2. Validate Sequence Continuity & Gap Protection
      const firstChangeSeq = BigInt(batch.changes[0].changeSequence);
      const expectedFirstSeq = currentCursor + BigInt(1);

      // If the batch starts past our expected sequence, a gap occurred!
      if (firstChangeSeq > expectedFirstSeq) {
        throw new PullApplyError(
          `Cursor gap detected: expected changeSequence ${expectedFirstSeq.toString()}, but received ${firstChangeSeq.toString()}.`,
          "CURSOR_GAP_DETECTED",
          { sequence: batch.changes[0].changeSequence }
        );
      }

      // Changes inside the batch must be strictly sequential (no internal gaps or disorder)
      for (let i = 0; i < batch.changes.length; i++) {
        const c = batch.changes[i];
        const currentSeq = BigInt(c.changeSequence);

        if (i > 0) {
          const prevSeq = BigInt(batch.changes[i - 1].changeSequence);
          if (currentSeq !== prevSeq + BigInt(1)) {
            throw new PullApplyError(
              `Internal batch sequence disorder: sequence jumped from ${prevSeq.toString()} to ${currentSeq.toString()}.`,
              "BATCH_SEQUENCE_DISORDER",
              { sequence: c.changeSequence }
            );
          }
        }
      }

      let appliedCount = 0;
      let lastAppliedSeq = currentCursor;

      // 3. Process each change in sequence order
      for (const change of batch.changes) {
        const changeSeq = BigInt(change.changeSequence);

        // A. If changeSequence is at or below cursor, it was already committed in a previous batch.
        const existingProcessed = await tx.localProcessedChange.findUnique({
          where: { operationId: change.operationId },
        });

        if (existingProcessed || changeSeq <= currentCursor) {
          // Already applied locally — skip mutation safely (idempotent replay)
          continue;
        }

        // B. Check if this change is ALREADY in LocalSyncQuarantine with status QUARANTINED
        const existingQuarantine = await tx.localSyncQuarantine.findUnique({
          where: { operationId: change.operationId },
        });

        if (
          existingQuarantine &&
          existingQuarantine.status === QuarantineStatus.QUARANTINED
        ) {
          // Change is currently quarantined and unresolved.
          // Stop processing immediately without blind retries or errors.
          return {
            appliedCount,
            newCursor: lastAppliedSeq.toString(),
            hasMore: false,
            blocked: true,
            blockedSequence: change.changeSequence,
            quarantineId: existingQuarantine.id,
            quarantineReason: existingQuarantine.errorMessage,
            quarantineErrorCode: existingQuarantine.errorCode,
          };
        }

        // C. Check if this change was self-originated by this depot device
        const isSelfOriginated =
          change.sourceDeviceId === localDeviceId ||
          Boolean(
            await tx.syncOutbox.findUnique({
              where: { operationId: change.operationId },
            })
          );

        if (isSelfOriginated) {
          // SELF-ORIGINATED CHANGE RECONCILIATION:
          // The local depot already executed this mutation locally before pushing it to Cloud.
          // Reconcile safely: do NOT overwrite or re-execute local data.
          await tx.localProcessedChange.create({
            data: {
              operationId: change.operationId,
              changeSequence: changeSeq,
              operationType: change.operationType,
              entityId: change.entityId,
              sourceDeviceId: change.sourceDeviceId,
            },
          });
          appliedCount++;
          lastAppliedSeq = changeSeq;
          continue;
        }

        // D. Attempt mutation with deterministic error quarantine protection
        try {
          // Validate basic sanity of change record
          if (!change.operationId || typeof change.operationId !== "string") {
            throw new PullApplyError(
              `Change at sequence ${change.changeSequence} is missing a valid operationId.`,
              "INVALID_PAYLOAD",
              { sequence: change.changeSequence }
            );
          }
          if (!change.entityId || typeof change.entityId !== "string") {
            throw new PullApplyError(
              `Change at sequence ${change.changeSequence} is missing a valid entityId.`,
              "INVALID_PAYLOAD",
              { sequence: change.changeSequence, operationId: change.operationId }
            );
          }
          if (!change.payload || typeof change.payload !== "object") {
            throw new PullApplyError(
              `Change at sequence ${change.changeSequence} contains invalid payload.`,
              "INVALID_PAYLOAD",
              { sequence: change.changeSequence, operationId: change.operationId }
            );
          }

          // Authority Partition Verification
          if (DEPOT_AUTHORITATIVE_OPS.has(change.operationType)) {
            throw new PullApplyError(
              `Authority violation: Cloud cannot overwrite depot-authoritative data for operation '${change.operationType}' on entity '${change.entityId}'.`,
              "AUTHORITY_VIOLATION",
              { sequence: change.changeSequence, operationId: change.operationId }
            );
          }

          if (change.operationType === "UPSERT_CUSTOMER") {
            throw new PullApplyError(
              `CUSTOMER AUTHORITY DECISION REQUIRED: Customer authority is ambiguous between Cloud and Depot in frozen architecture. Cloud change '${change.operationId}' held.`,
              "CUSTOMER_AUTHORITY_DECISION_REQUIRED",
              { sequence: change.changeSequence, operationId: change.operationId }
            );
          }

          if (!CLOUD_AUTHORITATIVE_OPS.has(change.operationType)) {
            throw new PullApplyError(
              `Unsupported operation type '${change.operationType}' at sequence ${change.changeSequence}. Client upgrade required.`,
              "UNSUPPORTED_OPERATION",
              { sequence: change.changeSequence, operationId: change.operationId }
            );
          }

          // Apply Cloud-Authoritative Mutation
          await applyCloudAuthoritativeMutation(tx, change);

          // Record in LocalProcessedChange for replay protection
          await tx.localProcessedChange.create({
            data: {
              operationId: change.operationId,
              changeSequence: changeSeq,
              operationType: change.operationType,
              entityId: change.entityId,
              sourceDeviceId: change.sourceDeviceId,
            },
          });

          appliedCount++;
          lastAppliedSeq = changeSeq;
        } catch (err: any) {
          if (isDeterministicPullError(err)) {
            // DETERMINISTIC FAILURE DETECTED:
            // 1. Persist to LocalSyncQuarantine
            const existingQ = await tx.localSyncQuarantine.findFirst({
              where: {
                OR: [
                  { operationId: change.operationId },
                  { changeSequence: changeSeq },
                ],
              },
            });

            let quarantineRecord: LocalSyncQuarantine;
            if (existingQ) {
              quarantineRecord = await tx.localSyncQuarantine.update({
                where: { id: existingQ.id },
                data: {
                  operationId: change.operationId,
                  changeSequence: changeSeq,
                  operationType: change.operationType,
                  entityId: change.entityId,
                  action: (change.action as any) || "UPSERT",
                  payload: (change.payload ?? {}) as any,
                  sourceDeviceId: change.sourceDeviceId,
                  errorCode: err.code || "DETERMINISTIC_ERROR",
                  errorMessage: err.message || "Deterministic pull error",
                  status: QuarantineStatus.QUARANTINED,
                },
              });
            } else {
              quarantineRecord = await tx.localSyncQuarantine.create({
                data: {
                  changeSequence: changeSeq,
                  operationId: change.operationId,
                  operationType: change.operationType,
                  entityId: change.entityId,
                  action: (change.action as any) || "UPSERT",
                  payload: (change.payload ?? {}) as any,
                  sourceDeviceId: change.sourceDeviceId,
                  errorCode: err.code || "DETERMINISTIC_ERROR",
                  errorMessage: err.message || "Deterministic pull error",
                  status: QuarantineStatus.QUARANTINED,
                },
              });
            }

            // 2. Advance cursor ONLY to lastAppliedSeq (changes successfully applied before this one)
            if (lastAppliedSeq > currentCursor) {
              await tx.syncCursor.upsert({
                where: { id: "cloud_cursor" },
                update: {
                  lastSequence: lastAppliedSeq,
                  lastSyncedAt: new Date(),
                },
                create: {
                  id: "cloud_cursor",
                  lastSequence: lastAppliedSeq,
                  lastSyncedAt: new Date(),
                },
              });
            }

            // 3. Halt batch processing: later changes MUST NOT be applied while N is blocked.
            return {
              appliedCount,
              newCursor: lastAppliedSeq.toString(),
              hasMore: false,
              blocked: true,
              blockedSequence: change.changeSequence,
              quarantineId: quarantineRecord.id,
              quarantineReason: err.message,
              quarantineErrorCode: err.code,
            };
          }

          // Transient or unexpected error -> re-throw to trigger full rollback
          throw err;
        }
      }

      // If all changes in batch were processed, advance SyncCursor to lastAppliedSeq
      if (lastAppliedSeq > currentCursor) {
        await tx.syncCursor.upsert({
          where: { id: "cloud_cursor" },
          update: {
            lastSequence: lastAppliedSeq,
            lastSyncedAt: new Date(),
          },
          create: {
            id: "cloud_cursor",
            lastSequence: lastAppliedSeq,
            lastSyncedAt: new Date(),
          },
        });
      }

      return {
        appliedCount,
        newCursor: lastAppliedSeq.toString(),
        hasMore: batch.hasMore,
        blocked: false,
      };
    },
    { timeout: 60000, maxWait: 20000 }
  );
}

/**
 * Dispatches and applies a verified cloud-authoritative mutation to local PostgreSQL.
 */
export async function applyCloudAuthoritativeMutation(
  tx: TransactionClient,
  change: SyncChangeRecord
): Promise<void> {
  const payload = change.payload;

  switch (change.operationType) {
    case "UPSERT_PRODUCT": {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      const brand = typeof payload.brand === "string" ? payload.brand.trim() : "";
      const sku = typeof payload.sku === "string" && payload.sku.trim() ? payload.sku.trim() : null;

      if (change.action === "DELETE") {
        // Soft delete: Product has historical sales/stock movements; cannot be hard deleted
        await tx.product.updateMany({
          where: { id: change.entityId },
          data: { isActive: false },
        });
        return;
      }

      if (!name || !brand) {
        throw new PullApplyError(
          `UPSERT_PRODUCT payload missing required name or brand.`,
          "INVALID_PAYLOAD",
          { sequence: change.changeSequence, operationId: change.operationId }
        );
      }

      const minStock = Number.isInteger(payload.minimumStockLevel)
        ? Math.max(0, payload.minimumStockLevel as number)
        : 0;
      const purchasePrice =
        typeof payload.latestPurchasePrice === "number"
          ? Math.max(0, payload.latestPurchasePrice)
          : 0;

      await tx.product.upsert({
        where: { id: change.entityId },
        update: {
          name,
          brand,
          sku,
          minimumStockLevel: minStock,
          latestPurchasePrice: new Prisma.Decimal(purchasePrice),
          ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
        },
        create: {
          id: change.entityId,
          name,
          brand,
          sku,
          minimumStockLevel: minStock,
          latestPurchasePrice: new Prisma.Decimal(purchasePrice),
          isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
        },
      });
      break;
    }

    case "CREATE_PRICE": {
      if (change.action === "DELETE") {
        // Price history is immutable; mark effectiveTo if deleting
        await tx.price.updateMany({
          where: { id: change.entityId, effectiveTo: null },
          data: { effectiveTo: new Date() },
        });
        return;
      }

      const productId = payload.productId as string;
      const tier = payload.tier as PriceTier;
      const amount = payload.amount;

      if (!productId || !tier || typeof amount !== "number" || amount < 0) {
        throw new PullApplyError(
          "CREATE_PRICE missing productId, valid tier, or positive amount.",
          "INVALID_PAYLOAD",
          { sequence: change.changeSequence, operationId: change.operationId }
        );
      }

      // Check if product exists locally
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });
      if (!product) {
        throw new PullApplyError(
          `Cannot create price: Product '${productId}' does not exist locally.`,
          "PRODUCT_NOT_FOUND",
          { sequence: change.changeSequence, operationId: change.operationId }
        );
      }

      // Check if this exact price row already exists
      const existingPrice = await tx.price.findUnique({
        where: { id: change.entityId },
        select: { id: true },
      });
      if (existingPrice) {
        return;
      }

      const now = payload.effectiveFrom ? new Date(payload.effectiveFrom as string) : new Date();

      // Close previous active price for product + tier
      await tx.price.updateMany({
        where: {
          productId,
          tier,
          effectiveTo: null,
        },
        data: {
          effectiveTo: now,
        },
      });

      // Find an active user to attribute local creation to
      let creatorId = (payload.userId || payload.createdById) as string | undefined;
      if (creatorId) {
        const user = await tx.user.findUnique({
          where: { id: creatorId },
          select: { id: true },
        });
        if (!user) creatorId = undefined;
      }
      if (!creatorId) {
        const fallbackUser = await tx.user.findFirst({
          where: { isActive: true },
          select: { id: true },
        });
        creatorId = fallbackUser?.id;
      }

      if (!creatorId) {
        throw new PullApplyError(
          "Cannot record price locally: No active user available for attribution.",
          "NO_ACTIVE_USER",
          { sequence: change.changeSequence, operationId: change.operationId }
        );
      }

      await tx.price.create({
        data: {
          id: change.entityId,
          productId,
          tier,
          amount: new Prisma.Decimal(amount),
          effectiveFrom: now,
          effectiveTo: payload.effectiveTo ? new Date(payload.effectiveTo as string) : null,
          createdById: creatorId,
        },
      });
      break;
    }

    case "UPSERT_SUPPLIER": {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      const contactPerson =
        typeof payload.contactPerson === "string" ? payload.contactPerson.trim() : null;
      const phone = typeof payload.phone === "string" ? payload.phone.trim() : null;
      const address = typeof payload.address === "string" ? payload.address.trim() : null;

      if (change.action === "DELETE") {
        await tx.supplier.updateMany({
          where: { id: change.entityId },
          data: { isActive: false },
        });
        return;
      }

      if (!name) {
        throw new PullApplyError(
          "UPSERT_SUPPLIER missing required supplier name.",
          "INVALID_PAYLOAD",
          { sequence: change.changeSequence, operationId: change.operationId }
        );
      }

      await tx.supplier.upsert({
        where: { id: change.entityId },
        update: {
          name,
          contactPerson,
          phone,
          address,
          ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
        },
        create: {
          id: change.entityId,
          name,
          contactPerson,
          phone,
          address,
          isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
        },
      });
      break;
    }

    case "UPDATE_USER": {
      if (change.action === "DELETE") {
        await tx.user.updateMany({
          where: { id: change.entityId },
          data: { isActive: false },
        });
        return;
      }

      const name = typeof payload.name === "string" ? payload.name.trim() : undefined;
      const role = payload.role as Role | undefined;
      const isActive = payload.isActive !== undefined ? Boolean(payload.isActive) : undefined;
      const pinHash = typeof payload.pinHash === "string" ? payload.pinHash : undefined;
      const authUserId = (payload.authUserId as string) || `auth-${change.entityId}`;

      await tx.user.upsert({
        where: { id: change.entityId },
        update: {
          ...(name ? { name } : {}),
          ...(role ? { role } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(pinHash !== undefined ? { pinHash } : {}),
        },
        create: {
          id: change.entityId,
          authUserId,
          name: name || "Synced User",
          role: role || Role.STAFF,
          isActive: isActive !== undefined ? isActive : true,
          pinHash: pinHash || null,
        },
      });
      break;
    }

    case "DELETE_DRAFT_RECEIVING": {
      // Posted receiving cannot be deleted as it is recorded in the stock ledger.
      const movements = await tx.stockMovement.count({
        where: { referenceType: "Receiving", referenceId: change.entityId },
      });
      if (movements > 0) {
        throw new PullApplyError(
          "Security rule: Posted receiving cannot be deleted as it is recorded in the stock ledger.",
          "CANNOT_DELETE_POSTED_RECEIVING",
          { sequence: change.changeSequence, operationId: change.operationId }
        );
      }

      await tx.receivingItem.deleteMany({
        where: { receivingId: change.entityId },
      });
      await tx.receiving.deleteMany({
        where: { id: change.entityId },
      });
      break;
    }

    case "UPSERT_CUSTOMER": {
      // Applied only during explicit resolution of quarantined customer changes
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!name) {
        throw new PullApplyError(
          "UPSERT_CUSTOMER missing required name.",
          "INVALID_PAYLOAD",
          { sequence: change.changeSequence, operationId: change.operationId }
        );
      }
      await tx.customer.upsert({
        where: { id: change.entityId },
        update: {
          name,
          phone: (payload.phone as string) || null,
          address: (payload.address as string) || null,
          priceTier: (payload.priceTier as any) || PriceTier.RETAIL,
          creditAllowed: Boolean(payload.creditAllowed),
          isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
        },
        create: {
          id: change.entityId,
          name,
          phone: (payload.phone as string) || null,
          address: (payload.address as string) || null,
          priceTier: (payload.priceTier as any) || PriceTier.RETAIL,
          creditAllowed: Boolean(payload.creditAllowed),
          isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
        },
      });
      break;
    }

    default:
      throw new PullApplyError(
        `Unhandled cloud authoritative operation '${change.operationType}'.`,
        "UNHANDLED_OPERATION",
        { sequence: change.changeSequence, operationId: change.operationId }
      );
  }
}

export interface ResolveQuarantineParams {
  quarantineId: string;
  action: "RETRY" | "DISCARD";
  reason: string;
  resolvedByUserId?: string;
  overridePayload?: Record<string, unknown>;
}

/**
 * Service-level resolution for a persistently quarantined change.
 *
 * Actions:
 *  - RETRY: Re-attempts the change mutation (with optional overridePayload). If successful,
 *    records in LocalProcessedChange, marks quarantine RESOLVED (RETRY_APPLIED), and advances
 *    SyncCursor to the change's sequence.
 *  - DISCARD: Explicitly rejects/discards the quarantined change with an auditable reason.
 *    Records the discarded operation in LocalProcessedChange to prevent duplicate replay,
 *    marks quarantine RESOLVED (DISCARDED), and advances SyncCursor to the change's sequence.
 */
export async function resolveQuarantineChange(
  params: ResolveQuarantineParams,
  dbClient: PrismaClient = prisma
): Promise<{
  success: boolean;
  action: "RETRY_APPLIED" | "DISCARDED";
  newCursor: string;
  quarantineId: string;
}> {
  if (!params.reason || !params.reason.trim()) {
    throw new PullApplyError(
      "A valid auditable resolution reason is required.",
      "INVALID_RESOLUTION_REASON"
    );
  }

  return await dbClient.$transaction(
    async (tx) => {
      // 1. Fetch the quarantine record
      const item = await tx.localSyncQuarantine.findUnique({
        where: { id: params.quarantineId },
      });

      if (!item) {
        throw new PullApplyError(
          `Quarantine record '${params.quarantineId}' not found.`,
          "QUARANTINE_NOT_FOUND"
        );
      }

      if (item.status === QuarantineStatus.RESOLVED) {
        throw new PullApplyError(
          `Quarantine record '${params.quarantineId}' is already resolved (${item.resolutionAction}).`,
          "ALREADY_RESOLVED"
        );
      }

      // 2. Verify sequence continuity
      // Must resolve in strict prefix order (item sequence must be currentCursor + 1)
      const currentCursor = await getLocalSyncCursor(tx);
      const changeSeq = item.changeSequence;

      if (changeSeq !== currentCursor + BigInt(1)) {
        throw new PullApplyError(
          `Cannot resolve quarantine sequence ${changeSeq.toString()}: current cursor is ${currentCursor.toString()}. Quarantined changes must be resolved in strict sequence order.`,
          "RESOLUTION_SEQUENCE_MISMATCH"
        );
      }

      // 3. Execute Resolution
      let resolutionAction: "RETRY_APPLIED" | "DISCARDED";

      if (params.action === "RETRY") {
        const changeRecord: SyncChangeRecord = {
          changeSequence: item.changeSequence.toString(),
          operationId: item.operationId,
          operationType: item.operationType as any,
          entityId: item.entityId,
          action: item.action as any,
          payload: (params.overridePayload || item.payload) as Record<string, unknown>,
          sourceDeviceId: item.sourceDeviceId,
          createdAt: item.createdAt.toISOString(),
        };

        // Re-attempt mutation
        await applyCloudAuthoritativeMutation(tx, changeRecord);

        // Record in LocalProcessedChange
        await tx.localProcessedChange.create({
          data: {
            operationId: item.operationId,
            changeSequence: item.changeSequence,
            operationType: item.operationType,
            entityId: item.entityId,
            sourceDeviceId: item.sourceDeviceId,
          },
        });

        resolutionAction = "RETRY_APPLIED";
      } else if (params.action === "DISCARD") {
        // Record in LocalProcessedChange to prevent duplicate replay
        await tx.localProcessedChange.create({
          data: {
            operationId: item.operationId,
            changeSequence: item.changeSequence,
            operationType: `DISCARDED_${item.operationType}`,
            entityId: item.entityId,
            sourceDeviceId: item.sourceDeviceId,
          },
        });

        resolutionAction = "DISCARDED";
      } else {
        throw new PullApplyError(
          `Unsupported resolution action '${params.action}'.`,
          "INVALID_RESOLUTION_ACTION"
        );
      }

      // 4. Update LocalSyncQuarantine record
      await tx.localSyncQuarantine.update({
        where: { id: item.id },
        data: {
          status: QuarantineStatus.RESOLVED,
          resolvedAt: new Date(),
          resolutionAction,
          resolutionReason: params.reason.trim(),
          resolvedByUserId: params.resolvedByUserId ?? null,
        },
      });

      // 5. Advance SyncCursor to changeSeq
      await tx.syncCursor.upsert({
        where: { id: "cloud_cursor" },
        update: {
          lastSequence: changeSeq,
          lastSyncedAt: new Date(),
        },
        create: {
          id: "cloud_cursor",
          lastSequence: changeSeq,
          lastSyncedAt: new Date(),
        },
      });

      return {
        success: true,
        action: resolutionAction,
        newCursor: changeSeq.toString(),
        quarantineId: item.id,
      };
    },
    { timeout: 60000, maxWait: 20000 }
  );
}

/**
 * Retrieves all currently active (unresolved) quarantined changes.
 */
export async function getActiveQuarantinedChanges(
  dbClient: PrismaClient = prisma
): Promise<LocalSyncQuarantine[]> {
  return await dbClient.localSyncQuarantine.findMany({
    where: { status: QuarantineStatus.QUARANTINED },
    orderBy: { changeSequence: "asc" },
  });
}

/**
 * Client helper to perform a complete incremental pull cycle over HTTP.
 */
export async function executePullCycle(params: {
  localDeviceId: string;
  serverUrl: string;
  deviceToken: string;
  batchSize?: number;
}): Promise<LocalPullApplyResult> {
  const currentCursor = await getLocalSyncCursor();

  const payload: SyncBatchPullPayload = {
    deviceId: params.localDeviceId,
    cursor: currentCursor.toString(),
    schemaVersion: "1.0",
    batchSize: params.batchSize ?? 50,
  };

  const res = await fetch(`${params.serverUrl}/api/sync/pull`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Device-Id": params.localDeviceId,
      Authorization: `Bearer ${params.deviceToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errBody: any;
    try {
      errBody = await res.json();
    } catch {
      throw new PullApplyError(
        `HTTP pull error ${res.status}: ${res.statusText}`,
        "HTTP_ERROR"
      );
    }
    throw new PullApplyError(
      errBody.error || `HTTP ${res.status} error during pull`,
      errBody.errorCode || "HTTP_ERROR"
    );
  }

  const batchResponse: SyncBatchPullResponse = await res.json();
  return await applyLocalPullBatch(params.localDeviceId, batchResponse);
}
