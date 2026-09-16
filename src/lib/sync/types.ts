/**
 * Phase 1 Sync Foundation: Domain Types & Interfaces
 *
 * Defines the canonical synchronization contracts, domain operation types,
 * and data transfer objects for the offline-first sync engine.
 */

export type SyncStatus = "PENDING" | "IN_FLIGHT" | "SYNCED" | "FAILED";
export type SyncChangeAction = "UPSERT" | "DELETE";

/**
 * Supported Domain Aggregate Operation types.
 * Each operation represents a bounded business transaction.
 */
export type SyncOperationType =
  | "CREATE_SALE"
  | "EDIT_SALE"
  | "CANCEL_SALE"
  | "POST_RECEIVING"
  | "DELETE_DRAFT_RECEIVING"
  | "RECORD_PAYMENT"
  | "CREATE_RETURN"
  | "INSPECT_RETURN"
  | "RECORD_DAMAGE"
  | "SUBMIT_STOCK_COUNT"
  | "RESOLVE_STOCK_ADJUSTMENT"
  | "UPSERT_CUSTOMER"
  | "UPSERT_PRODUCT"
  | "CREATE_PRICE"
  | "UPSERT_SUPPLIER"
  | "UPDATE_USER"
  | "TEST_PING";

/**
 * Canonical unit of synchronization sent from Local Depot to Cloud.
 */
export interface SyncOperation<TPayload = Record<string, unknown>> {
  operationId: string; // UUID v4 idempotency key
  clientSequence: string; // Serialized BigInt from local sequence
  operationType: SyncOperationType;
  entityId: string; // Target entity UUID
  payload: TPayload; // Complete aggregate domain payload
  clientCreatedAt: string; // ISO 8601 timestamp
}

/**
 * PUSH Request payload: Local Depot -> Cloud
 */
export interface SyncBatchPushPayload {
  deviceId: string;
  batchId: string;
  schemaVersion: string;
  operations: SyncOperation[];
}

/**
 * PUSH Response: Cloud -> Local Depot
 */
export interface SyncBatchPushResponse {
  success: boolean;
  batchId: string;
  acknowledgedOperationIds: string[];
  rejectedOperations?: Array<{
    operationId: string;
    error: string;
    errorCode?: string;
    expectedSequence?: string;
  }>;
  serverTimestamp: string;
}

/**
 * Canonical Change Log record sent from Cloud to Local Depot during PULL.
 */
export interface SyncChangeRecord<TPayload = Record<string, unknown>> {
  changeSequence: string; // Serialized BigInt from global sequence
  operationId: string; // Originating domain operation UUID
  operationType: SyncOperationType;
  entityId: string;
  action: SyncChangeAction;
  payload: TPayload;
  sourceDeviceId: string | null;
  createdAt: string;
}

/**
 * PULL Request payload: Local Depot -> Cloud
 */
export interface SyncBatchPullPayload {
  deviceId: string;
  cursor?: string; // Serialized BigInt from local SyncCursor.lastSequence
  lastSequence?: string; // Alias for cursor
  schemaVersion: string; // "1.0"
  batchSize?: number; // Bounded (default 50, max 100)
}

/**
 * PULL Response: Cloud -> Local Depot
 */
export interface SyncBatchPullResponse {
  success: boolean;
  deviceId: string;
  fromSequence: string; // Serialized BigInt starting cursor
  toSequence: string; // Serialized BigInt ending sequence of returned batch
  changes: SyncChangeRecord[];
  hasMore: boolean;
  serverTimestamp: string;
  error?: string;
  errorCode?: string;
}

/**
 * Legacy/compact alias for SyncBatchPullResponse
 */
export type SyncPullResponse = SyncBatchPullResponse;

