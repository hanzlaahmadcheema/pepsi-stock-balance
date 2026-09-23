import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const resetRes = await prisma.syncOutbox.updateMany({
    where: { status: "FAILED" },
    data: { status: "PENDING", lastError: null },
  });
  if (resetRes.count > 0) {
    console.log(`Reset ${resetRes.count} failed outbox items back to PENDING.`);
  }

  const outbox = await prisma.syncOutbox.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("OUTBOX_STATUS:", JSON.stringify(outbox));

  const failed = await prisma.syncOutbox.findMany({
    where: { status: "FAILED" },
    select: {
      operationId: true,
      operationType: true,
      entityId: true,
      lastError: true,
      retryCount: true,
    },
  });
  console.log("FAILED_ITEMS:", JSON.stringify(failed, null, 2));

  const pending = await prisma.syncOutbox.findMany({
    where: { status: "PENDING" },
    take: 5,
    select: {
      operationId: true,
      operationType: true,
      entityId: true,
      clientSequence: true,
    },
  });
  console.log("SAMPLE_PENDING:", JSON.stringify(pending, (key, value) =>
    typeof value === "bigint" ? value.toString() : value, 2));

  const localUsers = await prisma.user.findMany({
    select: { id: true, name: true, role: true, authUserId: true },
  });
  console.log("LOCAL_USERS:", JSON.stringify(localUsers, null, 2));

  const salesCount = await prisma.sale.count();
  console.log("LOCAL_SALES_COUNT:", salesCount);

  const customersCount = await prisma.customer.count();
  console.log("LOCAL_CUSTOMERS_COUNT:", customersCount);
}

main().finally(() => prisma.$disconnect());
