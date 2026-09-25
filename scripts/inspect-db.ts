import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [
    users,
    productsCount,
    pricesCount,
    suppliersCount,
    customersCount,
    salesCount,
    saleItemsCount,
    receivingsCount,
    receivingItemsCount,
    paymentsCount,
    stockMovementsCount,
    containerMovementsCount,
    productsSample,
  ] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, role: true, isActive: true } }),
    prisma.product.count(),
    prisma.price.count(),
    prisma.supplier.count(),
    prisma.customer.count(),
    prisma.sale.count(),
    prisma.saleItem.count(),
    prisma.receiving.count(),
    prisma.receivingItem.count(),
    prisma.payment.count(),
    prisma.stockMovement.count(),
    prisma.containerMovement.count(),
    prisma.product.findMany({
      take: 5,
      select: { id: true, name: true, sku: true, latestPurchasePrice: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const summary = {
    users,
    counts: {
      products: productsCount,
      prices: pricesCount,
      suppliers: suppliersCount,
      customers: customersCount,
      sales: salesCount,
      saleItems: saleItemsCount,
      receivings: receivingsCount,
      receivingItems: receivingItemsCount,
      payments: paymentsCount,
      stockMovements: stockMovementsCount,
      containerMovements: containerMovementsCount,
    },
    sampleProducts: productsSample.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      costPrice: p.latestPurchasePrice ? p.latestPurchasePrice.toString() : "0",
    })),
  };

  console.log("=== DB INSPECTION SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error("Inspection error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
