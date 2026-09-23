/**
 * scripts/reorder-outbox.ts
 *
 * Ensures proper causal ordering in SyncOutbox client sequences:
 * 1. Master data (Customers, Products, Suppliers, Prices)
 * 2. Receivings (Stock in)
 * 3. Sales (Stock out)
 * 4. Payments
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Reordering SyncOutbox for Causal Consistency ===");

  // Reset any FAILED back to PENDING
  await prisma.syncOutbox.updateMany({
    where: { status: "FAILED" },
    data: { status: "PENDING", lastError: null },
  });

  const allPending = await prisma.syncOutbox.findMany({
    where: { status: "PENDING" },
  });

  // Categorize
  const masterOps = allPending.filter((o) =>
    ["UPSERT_CUSTOMER", "UPSERT_PRODUCT", "UPSERT_SUPPLIER", "CREATE_PRICE"].includes(o.operationType)
  );

  const receivingOps = allPending.filter((o) => o.operationType === "POST_RECEIVING");

  const saleOps = allPending.filter((o) =>
    ["CREATE_SALE", "EDIT_SALE", "CANCEL_SALE"].includes(o.operationType)
  );

  const paymentOps = allPending.filter((o) => o.operationType === "RECORD_PAYMENT");

  const otherOps = allPending.filter((o) =>
    !masterOps.includes(o) &&
    !receivingOps.includes(o) &&
    !saleOps.includes(o) &&
    !paymentOps.includes(o)
  );

  const orderedList = [
    ...masterOps,
    ...receivingOps,
    ...saleOps,
    ...paymentOps,
    ...otherOps,
  ];

  console.log(
    `Reordering ${orderedList.length} operations: ` +
    `${masterOps.length} master, ${receivingOps.length} receivings, ` +
    `${saleOps.length} sales, ${paymentOps.length} payments`
  );

  // Re-assign sequences cleanly starting from 100
  let seq = 100n;
  for (const op of orderedList) {
    await prisma.syncOutbox.update({
      where: { id: op.id },
      data: {
        clientSequence: seq,
        status: "PENDING",
      },
    });
    seq += 1n;
  }

  console.log("=== Reordering complete! ===");
}

main()
  .catch((e) => {
    console.error("Reorder failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
