import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Reconciling Windows Outbox with Cloud DB ===");

  // Reset any FAILED back to PENDING so the queue unblocks and retries cleanly
  const res = await prisma.syncOutbox.updateMany({
    where: { status: "FAILED" },
    data: {
      status: "PENDING",
      lastError: null,
      retryCount: 0,
    },
  });

  console.log(`Reset ${res.count} FAILED operations to PENDING.`);

  const summary = await prisma.syncOutbox.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("Current Outbox Status:", JSON.stringify(summary));
}

main()
  .catch((e) => {
    console.error("Reconcile error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
