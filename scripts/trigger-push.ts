import { pushPendingOperations } from "@/lib/sync/client/push";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cloudUrl = process.env.CLOUD_SYNC_BASE_URL || "https://pepsi-stock-management.vercel.app";
  const deviceId = process.env.SYNC_DEVICE_ID || "depot-production-01";
  const deviceToken = process.env.SYNC_DEVICE_TOKEN || "tok_d4ec1cc6620f9ab39223b50888b92d0310aa4b2c3bee554bf6cc38cdbe27596f";

  console.log("Triggering pushPendingOperations to:", cloudUrl);

  // First reset any FAILED to PENDING
  await prisma.syncOutbox.updateMany({
    where: { status: "FAILED" },
    data: { status: "PENDING", lastError: null },
  });

  const res = await pushPendingOperations(cloudUrl, deviceId, deviceToken, fetch, prisma);
  console.log("PUSH_RESULT:", JSON.stringify(res, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));

  const outbox = await prisma.syncOutbox.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("UPDATED_OUTBOX_STATUS:", JSON.stringify(outbox));
}

main().finally(() => prisma.$disconnect());
