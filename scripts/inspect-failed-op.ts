import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const op = await prisma.syncOutbox.findUnique({
    where: { operationId: "d4b7b7d8-57dc-4678-aec1-2eb484187540" },
  });
  console.log("FAILED_OP:", JSON.stringify(op, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));

  if (op && (op.payload as any)?.items) {
    const items = (op.payload as any).items;
    for (const item of items) {
      const prod = await prisma.product.findUnique({
        where: { id: item.productId },
      });
      console.log(`Product in local DB for item productId ${item.productId}:`, prod ? `${prod.name} (${prod.id})` : "NOT FOUND");
    }
  }
}

main().finally(() => prisma.$disconnect());
