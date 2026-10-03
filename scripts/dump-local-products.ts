import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const localProducts = await prisma.product.findMany({
    select: { id: true, name: true, brand: true, sku: true, minimumStockLevel: true, latestPurchasePrice: true, isActive: true },
  });
  console.log("LOCAL_PRODUCTS_COUNT:", localProducts.length);

  // Print as JSON so we can read it
  console.log("LOCAL_PRODUCTS_JSON:" + JSON.stringify(localProducts));
}

main().finally(() => prisma.$disconnect());
