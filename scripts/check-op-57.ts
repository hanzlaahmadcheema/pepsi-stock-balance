import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const row = await prisma.syncOutbox.findUnique({
    where: { operationId: "5a8e9143-7942-4b5a-b916-5adfda3eba5c" },
  });
  console.log("OP_57:", JSON.stringify(row, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));

  // If Cloud already has it as SUCCESS, update it locally to SYNCED
  if (row && row.status !== "SYNCED") {
    console.log("Marking op 57 as SYNCED because Cloud DB already has it as SUCCESS!");
    await prisma.syncOutbox.update({
      where: { id: row.id },
      data: { status: "SYNCED", syncedAt: new Date(), lastError: null },
    });
    console.log("Done updating op 57 to SYNCED!");
  }
}

main().finally(() => prisma.$disconnect());
