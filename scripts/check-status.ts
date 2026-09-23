import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const outbox = await prisma.syncOutbox.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("OUTBOX_STATUS:", JSON.stringify(outbox));

  const salesCount = await prisma.sale.count();
  console.log("LOCAL_SALES_COUNT:", salesCount);

  const customersCount = await prisma.customer.count();
  console.log("LOCAL_CUSTOMERS_COUNT:", customersCount);
}

main().finally(() => prisma.$disconnect());
