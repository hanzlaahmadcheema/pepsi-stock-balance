import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const outbox = await prisma.syncOutbox.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("OUTBOX_STATUS:", JSON.stringify(outbox));

  const failed = await prisma.syncOutbox.findMany({
    where: { status: "FAILED" },
    select: {
      operationId: true,
      clientSequence: true,
      operationType: true,
      entityId: true,
      lastError: true,
      retryCount: true,
    },
  });
  console.log("FAILED_ITEMS:", JSON.stringify(failed, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));

  const pending = await prisma.syncOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { clientSequence: "asc" },
    take: 5,
    select: {
      operationId: true,
      clientSequence: true,
      operationType: true,
    },
  });
  console.log("NEXT_PENDING:", JSON.stringify(pending, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));
}

main().finally(() => prisma.$disconnect());
