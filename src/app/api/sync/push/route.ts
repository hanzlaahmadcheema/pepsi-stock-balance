/**
 * Phase 2 Sync — POST /api/sync/push Route Handler
 *
 * Accepts an authenticated push batch from a Local Depot server and processes
 * it through the cloud push pipeline.
 *
 * Security:
 *  - Device identity comes ONLY from the `X-Device-Id` header (never from the body).
 *  - Bearer token is validated against SHA-256(tokenHash) stored in SyncDevice.
 *  - Body size is capped at 1 MB to prevent abuse (Vercel default is 4.5 MB).
 *  - Operations per batch are capped at 50.
 *
 * This route is intentionally NOT cached (Next.js does not cache POST handlers).
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice, AuthError } from "@/lib/sync/server/authentication";
import { processDevicePushBatch } from "@/lib/sync/server/push";
import type { SyncBatchPushPayload } from "@/lib/sync/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_OPERATIONS_PER_BATCH = 50;
const SCHEMA_VERSION = "1.0";

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest | Request): Promise<NextResponse> {
  // 1. Enforce body size limit before parsing JSON.
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: "Request body exceeds 1 MB limit." },
      { status: 413 }
    );
  }

  // 2. Authenticate device BEFORE reading the body (fail fast on bad auth).
  let device;
  try {
    device = await authenticateDevice(request);
  } catch (err) {
    if (err instanceof AuthError) {
      const statusMap: Record<AuthError["code"], number> = {
        MISSING_DEVICE_ID: 400,
        MISSING_TOKEN: 400,
        DEVICE_NOT_FOUND: 401,
        TOKEN_MISMATCH: 401,
        DEVICE_REVOKED: 403,
      };
      return NextResponse.json(
        { success: false, error: err.message, errorCode: err.code },
        { status: statusMap[err.code] ?? 401 }
      );
    }
    // Unexpected auth error — treat as server error.
    console.error("[sync/push] Unexpected auth error:", err);
    return NextResponse.json(
      { success: false, error: "Internal authentication error." },
      { status: 500 }
    );
  }

  // 3. Parse request body.
  let body: SyncBatchPushPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body is not valid JSON." },
      { status: 400 }
    );
  }

  // 4. Validate top-level payload structure.
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  // 4a. Schema version check.
  if (body.schemaVersion !== SCHEMA_VERSION) {
    return NextResponse.json(
      {
        success: false,
        error: `Unsupported schema version: '${body.schemaVersion}'. Expected '${SCHEMA_VERSION}'.`,
        errorCode: "SCHEMA_VERSION_MISMATCH",
      },
      { status: 422 }
    );
  }

  // 4b. deviceId in body must match the authenticated device.
  if (body.deviceId !== device.deviceId) {
    return NextResponse.json(
      {
        success: false,
        error: "Body deviceId does not match authenticated device.",
        errorCode: "DEVICE_ID_MISMATCH",
      },
      { status: 400 }
    );
  }

  // 4c. batchId must be present.
  if (!body.batchId || typeof body.batchId !== "string") {
    return NextResponse.json(
      { success: false, error: "batchId is required and must be a string." },
      { status: 400 }
    );
  }

  // 4d. Operations must be a non-empty array.
  if (!Array.isArray(body.operations)) {
    return NextResponse.json(
      { success: false, error: "operations must be an array." },
      { status: 400 }
    );
  }

  if (body.operations.length === 0) {
    return NextResponse.json(
      { success: false, error: "operations array must not be empty." },
      { status: 400 }
    );
  }

  if (body.operations.length > MAX_OPERATIONS_PER_BATCH) {
    return NextResponse.json(
      {
        success: false,
        error: `Batch exceeds maximum of ${MAX_OPERATIONS_PER_BATCH} operations.`,
        errorCode: "BATCH_TOO_LARGE",
      },
      { status: 422 }
    );
  }

  // 4e. Per-operation basic field validation.
  for (let i = 0; i < body.operations.length; i++) {
    const op = body.operations[i];
    const prefix = `operations[${i}]`;

    if (!op || typeof op !== "object") {
      return NextResponse.json(
        { success: false, error: `${prefix}: must be an object.` },
        { status: 400 }
      );
    }
    if (!op.operationId || typeof op.operationId !== "string") {
      return NextResponse.json(
        { success: false, error: `${prefix}.operationId: required string.` },
        { status: 400 }
      );
    }
    if (!op.clientSequence || typeof op.clientSequence !== "string") {
      return NextResponse.json(
        { success: false, error: `${prefix}.clientSequence: required string (serialized BigInt).` },
        { status: 400 }
      );
    }
    if (!op.operationType || typeof op.operationType !== "string") {
      return NextResponse.json(
        { success: false, error: `${prefix}.operationType: required string.` },
        { status: 400 }
      );
    }
    if (!op.entityId || typeof op.entityId !== "string") {
      return NextResponse.json(
        { success: false, error: `${prefix}.entityId: required string (UUID).` },
        { status: 400 }
      );
    }
    if (!op.payload || typeof op.payload !== "object" || Array.isArray(op.payload)) {
      return NextResponse.json(
        { success: false, error: `${prefix}.payload: required object.` },
        { status: 400 }
      );
    }
    if (!op.clientCreatedAt || typeof op.clientCreatedAt !== "string") {
      return NextResponse.json(
        { success: false, error: `${prefix}.clientCreatedAt: required ISO 8601 string.` },
        { status: 400 }
      );
    }
    // clientSequence must parse as a non-negative BigInt.
    try {
      const seq = BigInt(op.clientSequence);
      if (seq <= BigInt(0)) throw new Error("non-positive");
    } catch {
      return NextResponse.json(
        { success: false, error: `${prefix}.clientSequence: must be a positive integer string.` },
        { status: 400 }
      );
    }
  }

  // 5. Sort operations by clientSequence ASC (defensive — client should pre-sort).
  const sortedOps = [...body.operations].sort((a, b) => {
    const seqA = BigInt(a.clientSequence);
    const seqB = BigInt(b.clientSequence);
    return seqA < seqB ? -1 : seqA > seqB ? 1 : 0;
  });

  // 6. Process the batch.
  try {
    const result = await processDevicePushBatch(device, body.batchId, sortedOps);
    const httpStatus = result.success ? 200 : 207; // 207 Multi-Status for partial success
    return NextResponse.json(result, { status: httpStatus });
  } catch (err) {
    console.error("[sync/push] Unhandled batch processing error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error during batch processing." },
      { status: 500 }
    );
  }
}
