/**
 * Safe Administrative SyncDevice Provisioning Script
 *
 * Generates a cryptographically secure token, hashes it with SHA-256,
 * and registers or updates the SyncDevice record in the database.
 *
 * Usage:
 *   npx tsx scripts/provision-device.ts [--device-id <id>]
 *
 * Invariants:
 * - Only the SHA-256 tokenHash is stored in the database.
 * - Raw token is printed ONCE to stdout for administrative configuration.
 * - Zero secrets are written to disk or source control.
 */

import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

async function main() {
  const args = process.argv.slice(2);
  let deviceId = "depot-staging-01";
  let deviceName = "Staging Windows Depot Server";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--device-id" && args[i + 1]) {
      deviceId = args[i + 1].trim();
      i++;
    } else if (args[i] === "--name" && args[i + 1]) {
      deviceName = args[i + 1].trim();
      i++;
    }
  }

  // Generate 32 bytes (256 bits) of cryptographically secure random bytes
  const rawToken = `tok_${crypto.randomBytes(32).toString("hex")}`;
  const tokenHash = hashToken(rawToken);

  const device = await prisma.syncDevice.upsert({
    where: { deviceId },
    update: {
      tokenHash,
      isRevoked: false,
      name: deviceName,
    },
    create: {
      deviceId,
      name: deviceName,
      tokenHash,
      isRevoked: false,
    },
  });

  console.log("==================================================================");
  console.log(" SYNC DEVICE PROVISIONED SUCCESSFULLY");
  console.log("==================================================================");
  console.log(`Device ID:    ${device.deviceId}`);
  console.log(`Device Name:  ${device.name}`);
  console.log(`Status:       ${device.isRevoked ? "REVOKED" : "ACTIVE"}`);
  console.log(`Created At:   ${device.createdAt.toISOString()}`);
  console.log("------------------------------------------------------------------");
  console.log("IMPORTANT: The raw token below is shown ONCE. Store it in your");
  console.log("depot server's .env.production file. It CANNOT be recovered from the DB.");
  console.log("------------------------------------------------------------------");
  console.log(`SYNC_DEVICE_ID="${device.deviceId}"`);
  console.log(`SYNC_DEVICE_TOKEN="${rawToken}"`);
  console.log("==================================================================");
}

main()
  .catch((err) => {
    console.error("Failed to provision sync device:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
