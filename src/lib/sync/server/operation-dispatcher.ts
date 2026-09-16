/**
 * Phase 2 Sync — Server-Side Operation Dispatcher
 *
 * PHASE 2 CONTRACT:
 *   Distinguishes between:
 *   1. IMPLEMENTED operations: Currently only the controlled infrastructure test
 *      operation `TEST_PING`. Its handler returns APPLIED.
 *   2. REGISTERED-FOR-FUTURE operations: The 16 business domain operations
 *      (CREATE_SALE, EDIT_SALE, RECORD_PAYMENT, etc.). Because their real business
 *      handlers belong to Phase 3+, any attempt to push them in Phase 2 throws
 *      `UnimplementedOperationError`, which is rejected DETERMINISTICALLY.
 *      They CANNOT receive a false SUCCESS or create a ProcessedSyncOperation row.
 *   3. UNKNOWN / UNSUPPORTED operations: Any type not on the allowlist throws
 *      `UnsupportedOperationError`, which is rejected DETERMINISTICALLY.
 *
 * ADDING BUSINESS LOGIC (Phase 3+):
 *   When a business handler (e.g. createSaleTransaction) is implemented in Phase 3+,
 *   move its type from REGISTERED_FUTURE_OPERATION_TYPES into IMPLEMENTED_OPERATION_TYPES
 *   and wire its transaction call inside `dispatchDomainOperation`.
 */

import type { SyncDevice } from "@prisma/client";
import type { SyncOperation, SyncOperationType } from "@/lib/sync/types";
import type { PrismaClient } from "@prisma/client";

// ─── Error types ─────────────────────────────────────────────────────────────

export class UnsupportedOperationError extends Error {
  constructor(public readonly operationType: string) {
    super(`Unsupported operation type: '${operationType}'`);
    this.name = "UnsupportedOperationError";
  }
}

export class UnimplementedOperationError extends Error {
  constructor(public readonly operationType: string) {
    super(
      `Operation '${operationType}' is registered for a future phase, but its business handler is not implemented yet. It cannot be acknowledged without applying mutations.`
    );
    this.name = "UnimplementedOperationError";
  }
}

export class OperationProcessingError extends Error {
  constructor(
    public readonly operationType: string,
    public readonly cause: unknown
  ) {
    super(
      `Failed to process operation '${operationType}': ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
    this.name = "OperationProcessingError";
  }
}

// ─── Dispatch result ─────────────────────────────────────────────────────────

export interface DispatchResult {
  /** Short human-readable status returned in the ACK response. */
  status: "APPLIED";
  /** Optional metadata returned to the caller. */
  meta?: Record<string, unknown>;
}

import {
  handleCreateSale,
  handleEditSale,
  handleCancelSale,
  handlePostReceiving,
  handleDeleteDraftReceiving,
  handleRecordPayment,
  handleCreateReturn,
  handleInspectReturn,
  handleRecordDamage,
  handleSubmitStockCount,
  handleResolveStockAdjustment,
  handleUpsertCustomer,
  handleUpsertProduct,
  handleCreatePrice,
  handleUpsertSupplier,
  handleUpdateUser,
} from "./handlers";

// ─── Operation type categorization ──────────────────────────────────────────

/**
 * Operations registered for future phases (Phase 4+).
 * Currently all 16 canonical business operations have been promoted to IMPLEMENTED.
 */
export const REGISTERED_FUTURE_OPERATION_TYPES: ReadonlySet<SyncOperationType> = new Set<SyncOperationType>([]);

/**
 * Operations with an actual executed handler in this deployment.
 * In Phase 3, this includes TEST_PING plus all 16 canonical business operations.
 */
export const IMPLEMENTED_OPERATION_TYPES: ReadonlySet<SyncOperationType> = new Set<SyncOperationType>([
  "TEST_PING",
  "CREATE_SALE",
  "EDIT_SALE",
  "CANCEL_SALE",
  "POST_RECEIVING",
  "DELETE_DRAFT_RECEIVING",
  "RECORD_PAYMENT",
  "CREATE_RETURN",
  "INSPECT_RETURN",
  "RECORD_DAMAGE",
  "SUBMIT_STOCK_COUNT",
  "RESOLVE_STOCK_ADJUSTMENT",
  "UPSERT_CUSTOMER",
  "UPSERT_PRODUCT",
  "CREATE_PRICE",
  "UPSERT_SUPPLIER",
  "UPDATE_USER",
]);

/**
 * Full allowlist of recognized operations (both implemented and future-registered).
 */
export const SUPPORTED_OPERATION_TYPES: ReadonlySet<SyncOperationType> = new Set<SyncOperationType>([
  ...REGISTERED_FUTURE_OPERATION_TYPES,
  ...IMPLEMENTED_OPERATION_TYPES,
]);

// ─── Type alias for a Prisma Interactive Transaction client ──────────────────

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Dispatches a single domain operation inside an already-open Prisma transaction.
 *
 * The caller is responsible for:
 *  - Starting the transaction.
 *  - Inserting the `ProcessedSyncOperation` record inside the same transaction.
 *  - Committing or rolling back.
 *
 * @param tx        Prisma interactive-transaction client.
 * @param operation The validated `SyncOperation` from the push batch.
 * @param device    The authenticated `SyncDevice`.
 * @returns         `DispatchResult` on success.
 * @throws          `UnsupportedOperationError`    — type is completely unrecognized.
 * @throws          `UnimplementedOperationError`  — type is registered for Phase 4+, not yet implemented.
 * @throws          `OperationProcessingError`     — mutation failed during execution.
 */
export async function dispatchDomainOperation(
  tx: TransactionClient,
  operation: SyncOperation,
  device: SyncDevice
): Promise<DispatchResult> {
  const opType = operation.operationType as SyncOperationType;

  // 1. Check if type is recognized at all.
  if (!SUPPORTED_OPERATION_TYPES.has(opType)) {
    throw new UnsupportedOperationError(operation.operationType);
  }

  // 2. Reject registered future operations whose handlers are not yet wired.
  if (REGISTERED_FUTURE_OPERATION_TYPES.has(opType)) {
    throw new UnimplementedOperationError(operation.operationType);
  }

  // 3. Dispatch implemented operations.
  try {
    switch (opType) {
      case "TEST_PING":
        return {
          status: "APPLIED",
          meta: { phase: 2, testOnly: true, deviceId: device.deviceId },
        };

      case "CREATE_SALE":
        await handleCreateSale(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "EDIT_SALE":
        await handleEditSale(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "CANCEL_SALE":
        await handleCancelSale(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "POST_RECEIVING":
        await handlePostReceiving(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "DELETE_DRAFT_RECEIVING":
        await handleDeleteDraftReceiving(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "RECORD_PAYMENT":
        await handleRecordPayment(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "CREATE_RETURN":
        await handleCreateReturn(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "INSPECT_RETURN":
        await handleInspectReturn(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "RECORD_DAMAGE":
        await handleRecordDamage(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "SUBMIT_STOCK_COUNT":
        await handleSubmitStockCount(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "RESOLVE_STOCK_ADJUSTMENT":
        await handleResolveStockAdjustment(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "UPSERT_CUSTOMER":
        await handleUpsertCustomer(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "UPSERT_PRODUCT":
        await handleUpsertProduct(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "CREATE_PRICE":
        await handleCreatePrice(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "UPSERT_SUPPLIER":
        await handleUpsertSupplier(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      case "UPDATE_USER":
        await handleUpdateUser(tx, operation, device);
        return { status: "APPLIED", meta: { entityId: operation.entityId } };

      default: {
        throw new UnsupportedOperationError(opType);
      }
    }
  } catch (err) {
    if (err instanceof UnsupportedOperationError || err instanceof UnimplementedOperationError) {
      throw err;
    }
    throw err;
  }
}
