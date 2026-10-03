import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany();
  const prices = await prisma.price.findMany();
  console.log("PAYLOAD_START");
  console.log(JSON.stringify({ products, prices }));
  console.log("PAYLOAD_END");
}

main().finally(() => prisma.$disconnect());
