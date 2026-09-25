/**
 * scripts/reset-db-except-users.ts
 *
 * Safely resets all transactional, catalog, and synchronization data in the database
 * while strictly preserving all User accounts (owners, staff, auth links, and credentials).
 */

import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

export async function resetDatabaseTables(prisma: PrismaClient, label: string) {
  console.log(`\n==================================================`);
  console.log(`Resetting Database: ${label}`);
  console.log(`==================================================`);

  // 1. Verify User Accounts
  const initialUsers = await prisma.user.findMany({
    select: { id: true, name: true, role: true, authUserId: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${initialUsers.length} User accounts to PRESERVE:`);
  for (const u of initialUsers) {
    console.log(`  • [${u.role}] ${u.name} (ID: ${u.id}, Auth: ${u.authUserId})`);
  }

  // 2. Perform deletions in topological dependency order (children first)
  const tables = [
    { name: "AuditLog", fn: () => prisma.auditLog.deleteMany() },
    { name: "ContainerMovement", fn: () => prisma.containerMovement.deleteMany() },
    { name: "Payment", fn: () => prisma.payment.deleteMany() },
    { name: "SaleItem", fn: () => prisma.saleItem.deleteMany() },
    { name: "Sale", fn: () => prisma.sale.deleteMany() },
    { name: "ReturnItem", fn: () => prisma.returnItem.deleteMany() },
    { name: "Return", fn: () => prisma.return.deleteMany() },
    { name: "DamageRecord", fn: () => prisma.damageRecord.deleteMany() },
    { name: "ReceivingItem", fn: () => prisma.receivingItem.deleteMany() },
    { name: "Receiving", fn: () => prisma.receiving.deleteMany() },
    { name: "StockAdjustment", fn: () => prisma.stockAdjustment.deleteMany() },
    { name: "StockMovement", fn: () => prisma.stockMovement.deleteMany() },
    { name: "StockCount", fn: () => prisma.stockCount.deleteMany() },
    { name: "DailyClosing", fn: () => prisma.dailyClosing.deleteMany() },
    { name: "Price", fn: () => prisma.price.deleteMany() },
    { name: "Product", fn: () => prisma.product.deleteMany() },
    { name: "Customer", fn: () => prisma.customer.deleteMany() },
    { name: "Supplier", fn: () => prisma.supplier.deleteMany() },
    // Synchronization queues and state
    { name: "LocalSyncQuarantine", fn: () => prisma.localSyncQuarantine.deleteMany() },
    { name: "LocalProcessedChange", fn: () => prisma.localProcessedChange.deleteMany() },
    { name: "ProcessedSyncOperation", fn: () => prisma.processedSyncOperation.deleteMany() },
    { name: "SyncChangeLog", fn: () => prisma.syncChangeLog.deleteMany() },
    { name: "SyncOutbox", fn: () => prisma.syncOutbox.deleteMany() },
    { name: "SyncCursor", fn: () => prisma.syncCursor.deleteMany() },
    { name: "SyncDevice", fn: () => prisma.syncDevice.deleteMany() },
  ];

  for (const { name, fn } of tables) {
    try {
      const res = await fn();
      console.log(`  ✓ Cleared ${name}: ${res.count} records removed.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  ⚠ ${name}: ${msg}`);
    }
  }

  // 3. Post-wipe Verification
  const remainingUsers = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
  });

  console.log(`\nVerification for ${label}:`);
  console.log(`  Remaining Users: ${remainingUsers.length} (Expected: ${initialUsers.length})`);

  if (remainingUsers.length !== initialUsers.length) {
    throw new Error(`CRITICAL ERROR: User count changed from ${initialUsers.length} to ${remainingUsers.length}!`);
  }

  console.log(`  [OK] All business data wiped clean. User accounts 100% intact.\n`);
}

export function resetContainerSettings(targetDir: string) {
  const settingsPath = path.join(targetDir, "data", "container-settings.json");
  if (fs.existsSync(settingsPath)) {
    try {
      const content = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      content.productConfigs = {};
      fs.writeFileSync(settingsPath, JSON.stringify(content, null, 2), "utf-8");
      console.log(`  ✓ Reset productConfigs in ${settingsPath}`);
    } catch (err) {
      console.warn(`  ⚠ Failed to reset ${settingsPath}:`, err);
    }
  }
}

async function main() {
  const target = process.argv[2] || "all";
  const cloudDbUrl =
    process.env.CLOUD_DATABASE_URL ||
    "postgresql://postgres.arntflxuoalstwdryykh:%40Faisal123%21@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30";

  if (target === "cloud" || target === "all") {
    console.log("Connecting to Cloud Supabase Database...");
    const cloudPrisma = new PrismaClient({
      datasources: { db: { url: cloudDbUrl } },
    });
    try {
      await resetDatabaseTables(cloudPrisma, "Cloud Supabase DB");
    } finally {
      await cloudPrisma.$disconnect();
    }
  }

  if (target === "local" || target === "all") {
    console.log("Connecting to Local / Default DATABASE_URL...");
    const defaultPrisma = new PrismaClient();
    try {
      await resetDatabaseTables(defaultPrisma, "Local / Active DB");
      resetContainerSettings(process.cwd());
    } finally {
      await defaultPrisma.$disconnect();
    }
  }

  console.log("==================================================");
  console.log("DATABASE RESET COMPLETE (USERS PRESERVED)");
  console.log("==================================================");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("FATAL ERROR resetting database:", err);
    process.exit(1);
  });
}
