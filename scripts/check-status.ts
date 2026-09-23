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
  console.log("SAMPLE_PENDING:", JSON.stringify(pending, null, 2));

  const salesCount = await prisma.sale.count();
  console.log("LOCAL_SALES_COUNT:", salesCount);

  const customersCount = await prisma.customer.count();
  console.log("LOCAL_CUSTOMERS_COUNT:", customersCount);
}

main().finally(() => prisma.$disconnect());
