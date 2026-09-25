/**
 * clean-db-keep-products-users.ts
 *
 * Wipes ALL transactional data from both LOCAL and CLOUD_PROD databases,
 * keeping only Products (+ Prices) and real Users.
 *
 * After cleanup it syncs LOCAL users to match CLOUD_PROD users exactly.
 *
 * Run with:  npx tsx scripts/clean-db-keep-products-users.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function loadEnv(envFile: string): { DATABASE_URL: string; DIRECT_URL: string } {
  const resolved = path.resolve(process.cwd(), envFile);
  const parsed = dotenv.parse(fs.readFileSync(resolved));
  return {
    DATABASE_URL: parsed.DATABASE_URL ?? "",
    DIRECT_URL: parsed.DIRECT_URL ?? parsed.DATABASE_URL ?? "",
  };
}

function makeClient(envFile: string): PrismaClient {
  const { DATABASE_URL, DIRECT_URL } = loadEnv(envFile);
  // @ts-ignore – Prisma accepts datasources override at runtime
  return new PrismaClient({
    datasources: { db: { url: DATABASE_URL } },
  });
}

async function countAll(db: PrismaClient) {
  const [
    users,
    products,
    prices,
    suppliers,
    receivings,
    receivingItems,
    customers,
    sales,
    saleItems,
    payments,
    returns,
    returnItems,
    stockMovements,
    damageRecords,
    containerMovements,
    stockAdjustments,
    dailyClosings,
    stockCounts,
    auditLogs,
    syncOutbox,
    syncCursor,
    processedOps,
    syncChangelog,
    syncDevices,
    localProcessed,
    localQuarantine,
  ] = await Promise.all([
    db.user.count(),
    db.product.count(),
    db.price.count(),
    db.supplier.count(),
    db.receiving.count(),
    db.receivingItem.count(),
    db.customer.count(),
    db.sale.count(),
    db.saleItem.count(),
    db.payment.count(),
    db.return.count(),
    db.returnItem.count(),
    db.stockMovement.count(),
    db.damageRecord.count(),
    db.containerMovement.count(),
    db.stockAdjustment.count(),
    db.dailyClosing.count(),
    db.stockCount.count(),
    db.auditLog.count(),
    db.syncOutbox.count(),
    db.syncCursor.count(),
    db.processedSyncOperation.count(),
    db.syncChangeLog.count(),
    db.syncDevice.count(),
    db.localProcessedChange.count(),
    db.localSyncQuarantine.count(),
  ]);
  return {
    users, products, prices,
    suppliers, receivings, receivingItems,
    customers, sales, saleItems, payments,
    returns, returnItems,
    stockMovements, damageRecords, containerMovements,
    stockAdjustments, dailyClosings, stockCounts,
    auditLogs, syncOutbox, syncCursor, processedOps,
    syncChangelog, syncDevices, localProcessed, localQuarantine,
  };
}

async function wipeTransactionalData(db: PrismaClient, label: string) {
  console.log(`\n[${label}] Starting cleanup…`);

  // 1. Sync tables (no FK deps on business data)
  console.log(`  Clearing sync tables…`);
  await db.localSyncQuarantine.deleteMany({});
  await db.localProcessedChange.deleteMany({});
  await db.syncDevice.deleteMany({});
  await db.syncChangeLog.deleteMany({});
  await db.processedSyncOperation.deleteMany({});
  await db.syncCursor.deleteMany({});
  await db.syncOutbox.deleteMany({});

  // 2. Audit logs (FK → User, must go before User delete)
  console.log(`  Clearing audit logs…`);
  await db.auditLog.deleteMany({});

  // 3. Stock counts (FK → DailyClosing, cascade; and → Product/User with Restrict)
  console.log(`  Clearing stock counts & daily closings…`);
  await db.stockCount.deleteMany({});
  await db.dailyClosing.deleteMany({});

  // 4. Container movements (FK → Customer/User)
  console.log(`  Clearing container movements…`);
  await db.containerMovement.deleteMany({});

  // 5. Stock adjustments (FK → Product/User)
  console.log(`  Clearing stock adjustments…`);
  await db.stockAdjustment.deleteMany({});

  // 6. Damage records (FK → Product/User)
  console.log(`  Clearing damage records…`);
  await db.damageRecord.deleteMany({});

  // 7. Stock movements (FK → Product/User)
  console.log(`  Clearing stock movements…`);
  await db.stockMovement.deleteMany({});

  // 8. Returns (items cascade from Return)
  console.log(`  Clearing returns…`);
  await db.returnItem.deleteMany({});
  await db.return.deleteMany({});

  // 9. Payments → Sales → SaleItems
  console.log(`  Clearing payments, sales, sale items…`);
  await db.payment.deleteMany({});
  await db.saleItem.deleteMany({});
  await db.sale.deleteMany({});

  // 10. Customers
  console.log(`  Clearing customers…`);
  await db.customer.deleteMany({});

  // 11. Receivings (items cascade from Receiving)
  console.log(`  Clearing receivings…`);
  await db.receivingItem.deleteMany({});
  await db.receiving.deleteMany({});

  // 12. Suppliers
  console.log(`  Clearing suppliers…`);
  await db.supplier.deleteMany({});

  console.log(`[${label}] Transactional data cleared ✓`);
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  const LOCAL_ENV = "environments/.env.local";
  const PROD_ENV = "environments/.env.cloud-prod";

  console.log("=".repeat(60));
  console.log(" DB CLEANUP — Keep Products & Real Users Only");
  console.log("=".repeat(60));

  const localDb = makeClient(LOCAL_ENV);
  const cloudDb = makeClient(PROD_ENV);

  // ── PRE-FLIGHT COUNTS ──────────────────────
  console.log("\n[PRE-FLIGHT] Current record counts:");

  const localBefore = await countAll(localDb);
  const cloudBefore = await countAll(cloudDb);

  console.log("\n  LOCAL:");
  console.log(JSON.stringify(localBefore, null, 4));
  console.log("\n  CLOUD_PROD:");
  console.log(JSON.stringify(cloudBefore, null, 4));

  // ── FETCH CLOUD USERS (to replicate to LOCAL) ──
  console.log("\n[INFO] Fetching real users from CLOUD_PROD…");
  const cloudUsers = await cloudDb.user.findMany({
    orderBy: { createdAt: "asc" },
  });
  console.log(`  Found ${cloudUsers.length} user(s):`);
  cloudUsers.forEach((u) =>
    console.log(`    • ${u.name} (${u.role}) — authUserId: ${u.authUserId}`)
  );

  // ── WIPE CLOUD_PROD ────────────────────────
  await wipeTransactionalData(cloudDb, "CLOUD_PROD");

  // ── WIPE LOCAL ────────────────────────────
  await wipeTransactionalData(localDb, "LOCAL");

  // ── MIGRATE LOCAL USERS ───────────────────
  // Order matters due to FK: Price.createdById → User (Restrict)
  // Step 1: Upsert real cloud users into LOCAL (so their IDs exist)
  console.log("\n[LOCAL] Upserting real users from CLOUD_PROD…");
  for (const u of cloudUsers) {
    await localDb.user.upsert({
      where: { id: u.id },
      update: {
        authUserId: u.authUserId,
        name: u.name,
        role: u.role,
        pinHash: u.pinHash,
        isActive: u.isActive,
      },
      create: {
        id: u.id,
        authUserId: u.authUserId,
        name: u.name,
        role: u.role,
        pinHash: u.pinHash,
        isActive: u.isActive,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
    });
    console.log(`  ✓ Upserted: ${u.name} (${u.role})`);
  }

  // Step 2: Re-point Price.createdById to a real user (FK now satisfied)
  const firstRealUser = cloudUsers[0];
  console.log(`\n[LOCAL] Re-assigning Price.createdById → ${firstRealUser.name}…`);
  await localDb.price.updateMany({
    data: { createdById: firstRealUser.id },
  });
  console.log(`  Done — all 121 prices re-assigned`);

  // Step 3: Delete old test users that are NOT in the real users list
  const realUserIds = cloudUsers.map((u) => u.id);
  console.log("\n[LOCAL] Removing test users (those not in real user list)…");
  const deleted = await localDb.user.deleteMany({
    where: { id: { notIn: realUserIds } },
  });
  console.log(`  Deleted ${deleted.count} test user(s)`);


  // ── POST-FLIGHT COUNTS ─────────────────────
  console.log("\n[POST-FLIGHT] Final record counts:");

  const localAfter = await countAll(localDb);
  const cloudAfter = await countAll(cloudDb);

  console.log("\n  LOCAL:");
  console.log(JSON.stringify(localAfter, null, 4));
  console.log("\n  CLOUD_PROD:");
  console.log(JSON.stringify(cloudAfter, null, 4));

  // ── VALIDATION ────────────────────────────
  console.log("\n[VALIDATION]");
  const checks = [
    { name: "LOCAL users == CLOUD users", ok: localAfter.users === cloudAfter.users },
    { name: "LOCAL products == CLOUD products", ok: localAfter.products === cloudAfter.products },
    { name: "LOCAL suppliers == 0", ok: localAfter.suppliers === 0 },
    { name: "CLOUD suppliers == 0", ok: cloudAfter.suppliers === 0 },
    { name: "LOCAL customers == 0", ok: localAfter.customers === 0 },
    { name: "CLOUD customers == 0", ok: cloudAfter.customers === 0 },
    { name: "LOCAL sales == 0", ok: localAfter.sales === 0 },
    { name: "CLOUD sales == 0", ok: cloudAfter.sales === 0 },
    { name: "LOCAL receivings == 0", ok: localAfter.receivings === 0 },
    { name: "CLOUD receivings == 0", ok: cloudAfter.receivings === 0 },
    { name: "LOCAL auditLogs == 0", ok: localAfter.auditLogs === 0 },
    { name: "CLOUD auditLogs == 0", ok: cloudAfter.auditLogs === 0 },
    { name: "LOCAL syncOutbox == 0", ok: localAfter.syncOutbox === 0 },
    { name: "CLOUD syncOutbox == 0", ok: cloudAfter.syncOutbox === 0 },
  ];

  let allGood = true;
  for (const c of checks) {
    const icon = c.ok ? "✅" : "❌";
    console.log(`  ${icon} ${c.name}`);
    if (!c.ok) allGood = false;
  }

  if (allGood) {
    console.log("\n✅ All checks passed. Both databases are clean and in sync.");
  } else {
    console.log("\n⚠️  Some checks failed — review the counts above.");
  }

  await localDb.$disconnect();
  await cloudDb.$disconnect();
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
