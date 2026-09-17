/**
 * Verification script for Phase 6 Step 6.1: Cloud Sync Endpoints & Authentication
 *
 * Verifies:
 *  1. Valid staging device credentials are accepted on /api/sync/pull
 *  2. Valid staging device credentials are accepted on /api/sync/push
 *  3. Invalid token is rejected with 401 (TOKEN_MISMATCH)
 *  4. Revoked device is rejected with 403 (DEVICE_REVOKED)
 *  5. Missing device ID is rejected with 400 (MISSING_DEVICE_ID)
 *  6. Missing token is rejected with 400 (MISSING_TOKEN)
 *  7. Non-existent device is rejected with 401 (DEVICE_NOT_FOUND)
 *  8. Production isolation: non-provisioned devices cannot access sync API
 */

import crypto from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { POST as pushHandler } from "../src/app/api/sync/push/route";
import { POST as pullHandler } from "../src/app/api/sync/pull/route";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

async function runVerification() {
  console.log("=== PHASE 6 STEP 6.1: CLOUD SYNC API & AUTH VERIFICATION ===");

  const deviceId = "depot-staging-01";
  // Generate an ephemeral test token for verification
  const testToken = `tok_test_${crypto.randomBytes(24).toString("hex")}`;
  const tokenHash = hashToken(testToken);

  // Ensure staging device exists with active status and test tokenHash
  await prisma.syncDevice.upsert({
    where: { deviceId },
    update: {
      tokenHash,
      isRevoked: false,
      name: "Staging Windows Depot Server",
    },
    create: {
      deviceId,
      name: "Staging Windows Depot Server",
      tokenHash,
      isRevoked: false,
    },
  });

  let passed = 0;
  let failed = 0;

  function assertTest(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✘ FAIL: ${name} - ${detail || "Condition not met"}`);
      failed++;
    }
  }

  // 1. Test Valid Staging Credentials on /api/sync/pull
  {
    const pullReq = new Request("http://localhost:3000/api/sync/pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": deviceId,
        "Authorization": `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        schemaVersion: "1.0",
        deviceId,
        cursor: "0",
        limit: 10,
      }),
    });

    const res = await pullHandler(pullReq);
    const data = await res.json();
    assertTest(
      "Valid staging device accepted on /api/sync/pull (status 200)",
      res.status === 200 && data.success === true,
      `Status: ${res.status}, success: ${data.success}`
    );
    assertTest(
      "Pull returns changes array and sequence metadata",
      Array.isArray(data.changes) && typeof data.toSequence === "string",
      `changes: ${typeof data.changes}, toSequence: ${data.toSequence}`
    );
  }

  // 2. Test Valid Staging Credentials on /api/sync/push
  {
    // Verification that authentication passes before body processing
    const pushReq = new Request("http://localhost:3000/api/sync/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": deviceId,
        "Authorization": `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        schemaVersion: "1.0",
        deviceId,
        batchId: crypto.randomUUID(),
        operations: [],
      }),
    });

    const res = await pushHandler(pushReq);
    const data = await res.json();
    // Since auth passed, it reaches operations check and returns 400 "operations array must not be empty"
    // (distinct from 401 TOKEN_MISMATCH or 403 DEVICE_REVOKED)
    assertTest(
      "Valid staging device authenticated on /api/sync/push (passed auth step)",
      res.status === 400 && data.error === "operations array must not be empty.",
      `Status: ${res.status}, error: ${data.error}`
    );
  }

  // 3. Test Invalid Token Rejected (TOKEN_MISMATCH -> 401)
  {
    const badTokenReq = new Request("http://localhost:3000/api/sync/pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": deviceId,
        "Authorization": "Bearer tok_completely_invalid_secret",
      },
      body: JSON.stringify({ cursorSequence: "0" }),
    });

    const res = await pullHandler(badTokenReq);
    const data = await res.json();
    assertTest(
      "Invalid token rejected with 401 TOKEN_MISMATCH",
      res.status === 401 && data.errorCode === "TOKEN_MISMATCH",
      `Status: ${res.status}, code: ${data.errorCode}`
    );
  }

  // 4. Test Revoked Device Rejected (DEVICE_REVOKED -> 403)
  {
    // Temporarily mark device revoked
    await prisma.syncDevice.update({
      where: { deviceId },
      data: { isRevoked: true },
    });

    const revokedReq = new Request("http://localhost:3000/api/sync/pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": deviceId,
        "Authorization": `Bearer ${testToken}`,
      },
      body: JSON.stringify({ cursorSequence: "0" }),
    });

    const res = await pullHandler(revokedReq);
    const data = await res.json();
    assertTest(
      "Revoked device rejected with 403 DEVICE_REVOKED",
      res.status === 403 && data.errorCode === "DEVICE_REVOKED",
      `Status: ${res.status}, code: ${data.errorCode}`
    );

    // Restore device to active
    await prisma.syncDevice.update({
      where: { deviceId },
      data: { isRevoked: false },
    });
  }

  // 5. Test Missing Device ID (MISSING_DEVICE_ID -> 400)
  {
    const missingIdReq = new Request("http://localhost:3000/api/sync/pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${testToken}`,
      },
      body: JSON.stringify({ cursorSequence: "0" }),
    });

    const res = await pullHandler(missingIdReq);
    const data = await res.json();
    assertTest(
      "Missing X-Device-Id header rejected with 400 MISSING_DEVICE_ID",
      res.status === 400 && data.errorCode === "MISSING_DEVICE_ID",
      `Status: ${res.status}, code: ${data.errorCode}`
    );
  }

  // 6. Test Missing Token (MISSING_TOKEN -> 400)
  {
    const missingTokReq = new Request("http://localhost:3000/api/sync/pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": deviceId,
      },
      body: JSON.stringify({ cursorSequence: "0" }),
    });

    const res = await pullHandler(missingTokReq);
    const data = await res.json();
    assertTest(
      "Missing Authorization header rejected with 400 MISSING_TOKEN",
      res.status === 400 && data.errorCode === "MISSING_TOKEN",
      `Status: ${res.status}, code: ${data.errorCode}`
    );
  }

  // 7. Test Non-Existent Device (DEVICE_NOT_FOUND -> 401)
  {
    const nonExistentReq = new Request("http://localhost:3000/api/sync/pull", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-Id": "depot-non-existent-device-xyz",
        "Authorization": `Bearer ${testToken}`,
      },
      body: JSON.stringify({ cursorSequence: "0" }),
    });

    const res = await pullHandler(nonExistentReq);
    const data = await res.json();
    assertTest(
      "Non-existent device rejected with 401 DEVICE_NOT_FOUND",
      res.status === 401 && data.errorCode === "DEVICE_NOT_FOUND",
      `Status: ${res.status}, code: ${data.errorCode}`
    );
  }

  console.log("------------------------------------------------------------------");
  console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification()
  .catch((err) => {
    console.error("Verification execution error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
