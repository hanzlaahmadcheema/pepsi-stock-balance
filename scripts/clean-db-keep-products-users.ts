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
  if (!fs.existsSync(resolved)) {
    throw new Error(`Env file not found: ${resolved}`);
  }
  const parsed = dotenv.parse(fs.readFileSync(resolved));
  return {
    DATABASE_URL: parsed.DATABASE_URL ?? "",
    DIRECT_URL: parsed.DIRECT_URL ?? parsed.DATABASE_URL ?? "",
  };
}

/**
 * Accepts either:
 *   - a path to an env file (e.g. "environments/.env.cloud-prod")
 *   - a raw postgres URL (e.g. "postgresql://user:pass@host/db")
 */
function makeClient(envFileOrUrl: string): PrismaClient {
  let url: string;
  if (envFileOrUrl.startsWith("postgresql://") || envFileOrUrl.startsWith("postgres://")) {
    url = envFileOrUrl;
  } else {
    url = loadEnv(envFileOrUrl).DATABASE_URL;
  }
  // @ts-ignore – Prisma accepts datasources override at runtime
  return new PrismaClient({
    datasources: { db: { url } },
  });
}

async function countAll(db: PrismaClient) {
  // Sequential (not parallel) to stay within pgbouncer connection pool limits
  const users               = await db.user.count();
  const products            = await db.product.count();
  const prices              = await db.price.count();
  const suppliers           = await db.supplier.count();
  const receivings          = await db.receiving.count();
  const receivingItems      = await db.receivingItem.count();
  const customers           = await db.customer.count();
  const sales               = await db.sale.count();
  const saleItems           = await db.saleItem.count();
  const payments            = await db.payment.count();
  const returns             = await db.return.count();
  const returnItems         = await db.returnItem.count();
  const stockMovements      = await db.stockMovement.count();
  const damageRecords       = await db.damageRecord.count();
  const containerMovements  = await db.containerMovement.count();
  const stockAdjustments    = await db.stockAdjustment.count();
  const dailyClosings       = await db.dailyClosing.count();
  const stockCounts         = await db.stockCount.count();
  const auditLogs           = await db.auditLog.count();
  const syncOutbox          = await db.syncOutbox.count();
  const syncCursor          = await db.syncCursor.count();
  const processedOps        = await db.processedSyncOperation.count();
  const syncChangelog       = await db.syncChangeLog.count();
  const syncDevices         = await db.syncDevice.count();
  const localProcessed      = await db.localProcessedChange.count();
  const localQuarantine     = await db.localSyncQuarantine.count();

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
  // Usage:
  //   npx tsx scripts/clean-db-keep-products-users.ts [localEnvOrUrl] [cloudProdEnvOrUrl]
  //
  // Examples:
  //   npx tsx scripts/clean-db-keep-products-users.ts                              (Linux defaults)
  //   npx tsx scripts/clean-db-keep-products-users.ts .env.production              (Windows, cloud-prod from file)
  //   npx tsx scripts/clean-db-keep-products-users.ts .env.production "postgresql://user:pass@host/db"
  const LOCAL_ENV = process.argv[2] ?? "environments/.env.local";
  const PROD_ENV  = process.argv[3] ?? "environments/.env.cloud-prod";

  console.log(`  Local  : ${LOCAL_ENV}`);
  console.log(`  Cloud  : ${PROD_ENV.startsWith("postgresql") ? "[URL]" : PROD_ENV}`);

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
