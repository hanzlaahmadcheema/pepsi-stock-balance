import { prisma } from "../src/lib/prisma";
import { recalculateAllSalesFifo } from "../src/lib/inventory/fifo";

async function main() {
  console.log("=== Recalculating FIFO acquisition costs for all completed sales ===");

  const startTime = Date.now();
  const result = await prisma.$transaction(async (tx) => {
    return recalculateAllSalesFifo(tx);
  }, { timeout: 30000, maxWait: 10000 });

  const durationMs = Date.now() - startTime;
  console.log(`Successfully reconciled sales FIFO costs in ${durationMs}ms.`);
  console.log(`Updated sale items count: ${result.updatedCount}`);

  // Print summary of completed sales
  const sales = await prisma.sale.findMany({
    where: { status: "COMPLETED" },
    orderBy: [{ soldAt: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        include: {
          product: {
            select: { name: true, brand: true },
          },
        },
      },
    },
  });

  console.log(`\n=== Current Completed Sales (${sales.length} total) ===`);
  for (const s of sales) {
    let totalCost = 0;
    for (const item of s.items) {
      totalCost += item.quantity * Number(item.purchaseCostAtSale);
    }
    const revenue = Number(s.totalAmount);
    const profit = Math.round((revenue - totalCost) * 100) / 100;
    console.log(`Invoice ${s.invoiceNumber} (${s.soldAt.toISOString()}):`);
    console.log(`  Revenue: ${revenue}, Total COGS: ${totalCost.toFixed(2)}, Profit: ${profit.toFixed(2)}`);
    for (const item of s.items) {
      console.log(
        `    - ${item.product.name}: Qty ${item.quantity} @ SalePrice ${Number(item.unitPrice).toFixed(2)} | Unit COGS ${Number(item.purchaseCostAtSale).toFixed(2)}`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error("Error during FIFO recalculation:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
