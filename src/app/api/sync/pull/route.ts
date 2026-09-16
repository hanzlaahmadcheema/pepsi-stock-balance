/**
 * Phase 4 Sync — POST /api/sync/pull Route Handler
 *
 * Incremental change-log pull endpoint for authenticated local depot devices.
 *
 * Security:
 *  - Device identity comes from X-Device-Id header.
 *  - Bearer token is validated against SHA-256(tokenHash) in SyncDevice.
 *  - Revoked devices are rejected with 403.
 *  - Request body size capped at 1 MB.
 *  - Changes returned strictly after client's cursorSequence in ASC order.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice, AuthError } from "@/lib/sync/server/authentication";
import { fetchDevicePullBatch, PullError } from "@/lib/sync/server/pull";
import type { SyncBatchPullPayload } from "@/lib/sync/types";

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB

export async function POST(request: NextRequest | Request): Promise<NextResponse> {
  // 1. Enforce body size limit
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: "Request body exceeds 1 MB limit." },
      { status: 413 }
    );
  }

  // 2. Authenticate device before reading body
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
    console.error("[sync/pull] Unexpected auth error:", err);
    return NextResponse.json(
      { success: false, error: "Internal authentication error." },
      { status: 500 }
    );
  }

  // 3. Parse request body
  let body: SyncBatchPullPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body is not valid JSON." },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  // 4. Fetch incremental batch
  try {
    const result = await fetchDevicePullBatch(device, body);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof PullError) {
      return NextResponse.json(
        { success: false, error: err.message, errorCode: err.code },
        { status: err.statusCode }
      );
    }
    console.error("[sync/pull] Unhandled pull error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error during pull processing." },
      { status: 500 }
    );
  }
}
