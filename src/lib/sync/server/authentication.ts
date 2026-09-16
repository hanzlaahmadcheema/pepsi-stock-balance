/**
 * Phase 2 Sync — Server-Side Device Authentication
 *
 * Validates incoming push requests by:
 *  1. Extracting `X-Device-Id` header (source of truth — never trust JSON body).
 *  2. Extracting `Authorization: Bearer <raw_token>` header.
 *  3. Hashing the raw token with SHA-256 and doing a constant-time comparison
 *     against `SyncDevice.tokenHash`.
 *  4. Rejecting revoked devices.
 *
 * For dev/testing: seed a SyncDevice row whose `tokenHash` equals
 * `SHA-256(process.env.SYNC_DEV_TOKEN)`.  Never hard-code raw tokens.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SyncDevice } from "@prisma/client";

// ─── Error types ────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    public readonly code:
      | "MISSING_DEVICE_ID"
      | "MISSING_TOKEN"
      | "DEVICE_NOT_FOUND"
      | "TOKEN_MISMATCH"
      | "DEVICE_REVOKED",
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the SHA-256 hex digest of a UTF-8 string.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both values are converted to Buffers of equal length before comparing.
 */
function timingSafeEqual(a: string, b: string): boolean {
  // Pad/truncate to the length of the longer string so timings are identical.
  const maxLen = Math.max(a.length, b.length);
  const bufA = Buffer.alloc(maxLen);
  const bufB = Buffer.alloc(maxLen);
  bufA.write(a, "utf8");
  bufB.write(b, "utf8");
  return crypto.timingSafeEqual(bufA, bufB);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Authenticates an incoming HTTP request for the sync push endpoint.
 *
 * @param request  The incoming `Request` (Web API — works in Next.js Route Handlers).
 * @returns        The matching `SyncDevice` record if authentication succeeds.
 * @throws         `AuthError` with a specific code if authentication fails.
 */
export async function authenticateDevice(request: Request): Promise<SyncDevice> {
  // 1. Extract X-Device-Id — we trust the header, never the JSON body.
  const deviceId = request.headers.get("x-device-id")?.trim() ?? "";
  if (!deviceId) {
    throw new AuthError("MISSING_DEVICE_ID", "X-Device-Id header is required.");
  }

  // 2. Extract Bearer token.
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const rawToken = match ? match[1].trim() : "";
  if (!rawToken) {
    throw new AuthError(
      "MISSING_TOKEN",
      "Authorization: Bearer <token> header is required."
    );
  }

  // 3. Fetch device record.
  const device = await prisma.syncDevice.findUnique({
    where: { deviceId },
  });
  if (!device) {
    throw new AuthError("DEVICE_NOT_FOUND", `Device '${deviceId}' is not registered.`);
  }

  // 4. Verify token with constant-time comparison.
  const computedHash = hashToken(rawToken);
  if (!timingSafeEqual(computedHash, device.tokenHash)) {
    throw new AuthError("TOKEN_MISMATCH", "Invalid device token.");
  }

  // 5. Reject revoked devices (checked AFTER token validation to prevent oracle).
  if (device.isRevoked) {
    throw new AuthError("DEVICE_REVOKED", `Device '${deviceId}' has been revoked.`);
  }

  return device;
}
