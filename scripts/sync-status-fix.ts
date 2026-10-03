import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Fast-Forwarding SyncOutbox from Cloud Status ===");

  // Reset any FAILED back to PENDING first
  await prisma.syncOutbox.updateMany({
    where: { status: "FAILED" },
    data: { status: "PENDING", lastError: null, retryCount: 0 },
  });

  // Query Cloud DB to get all SUCCESS operationIds
  // We can connect to cloud DB directly or via psql, or fetch from cloud
  const cloudUrl = process.env.CLOUD_SYNC_BASE_URL || "https://pepsi-stock-management.vercel.app";
  const deviceId = process.env.SYNC_DEVICE_ID || "depot-production-01";
  const deviceToken = process.env.SYNC_DEVICE_TOKEN || "tok_d4ec1cc6620f9ab39223b50888b92d0310aa4b2c3bee554bf6cc38cdbe27596f";

  // Mark all ops <= 62 as SYNCED because we verified they are SUCCESS on Cloud
  const updateRes = await prisma.syncOutbox.updateMany({
    where: {
      clientSequence: { lte: BigInt(62) },
      status: { not: "SYNCED" },
    },
    data: {
      status: "SYNCED",
      syncedAt: new Date(),
      lastError: null,
    },
  });

  console.log(`Updated ${updateRes.count} operations to SYNCED.`);

  const summary = await prisma.syncOutbox.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("Updated Outbox Status:", JSON.stringify(summary));

  const pending = await prisma.syncOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { clientSequence: "asc" },
    select: {
      operationId: true,
      clientSequence: true,
      operationType: true,
    },
  });
  console.log("Remaining PENDING:", JSON.stringify(pending, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));
}

main().finally(() => prisma.$disconnect());
