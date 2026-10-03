/**
 * clean-db-keep-products-users.ts
 *
 * Wipes ALL transactional data from both LOCAL and CLOUD databases,
 * keeping only Products (+ Prices), real Users, and SyncDevice registrations.
 *
 * Synchronizes users between LOCAL and CLOUD so all real accounts exist on both.
 * Resets sync change logs, outbox, and cursors to 0 for a clean Oct 4 operational start.
 *
 * Run with:
 *   npx tsx scripts/clean-db-keep-products-users.ts [localEnvOrUrl] [cloudProdEnvOrUrl]
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function loadEnv(envFile: string): { DATABASE_URL: string; DIRECT_URL: string } {
  if (envFile.startsWith("postgresql://") || envFile.startsWith("postgres://")) {
    return { DATABASE_URL: envFile, DIRECT_URL: envFile };
  }

  const candidates = [
    path.resolve(process.cwd(), envFile),
    path.resolve(process.cwd(), "environments", envFile),
    path.resolve(process.cwd(), ".env.production"),
    path.resolve(process.cwd(), ".env"),
  ];

  let foundFile: string | null = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      foundFile = c;
      break;
    }
  }

  if (!foundFile) {
    throw new Error(`Env file not found for ${envFile}. Checked:\n${candidates.join("\n")}`);
  }

  console.log(`  Loaded env: ${foundFile}`);
  const parsed = dotenv.parse(fs.readFileSync(foundFile));
  return {
    DATABASE_URL: parsed.DATABASE_URL ?? "",
    DIRECT_URL: parsed.DIRECT_URL ?? parsed.DATABASE_URL ?? "",
  };
}

function makeClient(envFileOrUrl: string): PrismaClient {
  let url: string;
  if (envFileOrUrl.startsWith("postgresql://") || envFileOrUrl.startsWith("postgres://")) {
    url = envFileOrUrl;
  } else {
    const loaded = loadEnv(envFileOrUrl);
    url = loaded.DIRECT_URL || loaded.DATABASE_URL;
  }

  return new PrismaClient({
    datasources: { db: { url } },
  });
}

async function countAll(db: PrismaClient) {
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

  // 1. Sync tables (PRESERVE syncDevice so terminal registration stays active!)
  console.log(`  Clearing sync transaction queues & changelogs (preserving syncDevice)…`);
  await db.localSyncQuarantine.deleteMany({});
  await db.localProcessedChange.deleteMany({});
  await db.syncChangeLog.deleteMany({});
  await db.processedSyncOperation.deleteMany({});
  await db.syncCursor.deleteMany({});
  await db.syncOutbox.deleteMany({});

  // 2. Audit logs
  console.log(`  Clearing audit logs…`);
  await db.auditLog.deleteMany({});

  // 3. Stock counts & Daily closings
  console.log(`  Clearing stock counts & daily closings…`);
  await db.stockCount.deleteMany({});
  await db.dailyClosing.deleteMany({});

  // 4. Container movements
  console.log(`  Clearing container movements…`);
  await db.containerMovement.deleteMany({});

  // 5. Stock adjustments
  console.log(`  Clearing stock adjustments…`);
  await db.stockAdjustment.deleteMany({});

  // 6. Damage records
  console.log(`  Clearing damage records…`);
  await db.damageRecord.deleteMany({});

  // 7. Stock movements
  console.log(`  Clearing stock movements…`);
  await db.stockMovement.deleteMany({});

  // 8. Returns
  console.log(`  Clearing returns…`);
  await db.returnItem.deleteMany({});
  await db.return.deleteMany({});

  // 9. Payments, Sales, Sale Items
  console.log(`  Clearing payments, sales, sale items…`);
  await db.payment.deleteMany({});
  await db.saleItem.deleteMany({});
  await db.sale.deleteMany({});

  // 10. Customers
  console.log(`  Clearing customers…`);
  await db.customer.deleteMany({});

  // 11. Receivings
  console.log(`  Clearing receivings…`);
  await db.receivingItem.deleteMany({});
  await db.receiving.deleteMany({});

  // 12. Suppliers
  console.log(`  Clearing suppliers…`);
  await db.supplier.deleteMany({});

  // Reset sequence counters if applicable
  try {
    await db.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS "SyncChangeLog_changeSequence_seq" RESTART WITH 1;');
  } catch {}
  try {
    await db.$executeRawUnsafe('ALTER SEQUENCE IF EXISTS "SyncOutbox_clientSequence_seq" RESTART WITH 1;');
  } catch {}

  console.log(`[${label}] Transactional data cleared ✓`);
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  const LOCAL_ENV = process.argv[2] ?? (fs.existsSync("environments/.env.local") ? "environments/.env.local" : ".env.production");
  const PROD_ENV  = process.argv[3] ?? (fs.existsSync("environments/.env.cloud-prod") ? "environments/.env.cloud-prod" : "postgresql://postgres.arntflxuoalstwdryykh:%40Faisal123%21@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30");

  console.log("=".repeat(60));
  console.log(" DB CLEANUP — Reset to Day 0 (Keep Products, Prices, Users, Devices)");
  console.log("=".repeat(60));
  console.log(`  Local  : ${LOCAL_ENV}`);
  console.log(`  Cloud  : ${PROD_ENV.startsWith("postgresql") ? "[Direct Cloud URL]" : PROD_ENV}`);

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

  // ── WIPE CLOUD_PROD ────────────────────────
  await wipeTransactionalData(cloudDb, "CLOUD_PROD");

  // ── WIPE LOCAL ────────────────────────────
  await wipeTransactionalData(localDb, "LOCAL");

  // ── RE-INITIALIZE LOCAL SYNC CURSOR ───────
  console.log("\n[LOCAL] Initializing SyncCursor to 0…");
  await localDb.syncCursor.create({
    data: {
      id: "cloud_cursor",
      lastSequence: BigInt(0),
      lastSyncedAt: new Date(),
    },
  });

  // ── MERGE & SYNCHRONIZE USERS ─────────────
  console.log("\n[SYNC] Harmonizing Users between LOCAL and CLOUD…");
  const localUsers = await localDb.user.findMany();
  const cloudUsers = await cloudDb.user.findMany();

  // Upsert all local users into Cloud
  for (const u of localUsers) {
    await cloudDb.user.upsert({
      where: { id: u.id },
      update: {
        name: u.name,
        role: u.role,
        authUserId: u.authUserId,
        pinHash: u.pinHash,
        passwordHash: u.passwordHash,
        isActive: u.isActive,
      },
      create: {
        id: u.id,
        name: u.name,
        role: u.role,
        authUserId: u.authUserId,
        pinHash: u.pinHash,
        passwordHash: u.passwordHash,
        isActive: u.isActive,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
    });
  }

  // Upsert all cloud users into Local
  for (const u of cloudUsers) {
    await localDb.user.upsert({
      where: { id: u.id },
      update: {
        name: u.name,
        role: u.role,
        authUserId: u.authUserId,
        pinHash: u.pinHash,
        passwordHash: u.passwordHash,
        isActive: u.isActive,
      },
      create: {
        id: u.id,
        name: u.name,
        role: u.role,
        authUserId: u.authUserId,
        pinHash: u.pinHash,
        passwordHash: u.passwordHash,
        isActive: u.isActive,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
    });
  }

  const primaryOwner = (await localDb.user.findFirst({ where: { role: "OWNER" } })) ?? localUsers[0];
  if (primaryOwner) {
    console.log(`  Re-linking Price.createdById → ${primaryOwner.name} (${primaryOwner.id})`);
    await localDb.price.updateMany({
      data: { createdById: primaryOwner.id },
    });
    await cloudDb.price.updateMany({
      data: { createdById: primaryOwner.id },
    });
  }

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
    { name: "LOCAL users == CLOUD users", ok: localAfter.users === cloudAfter.users && localAfter.users > 0 },
    { name: "LOCAL products == CLOUD products", ok: localAfter.products === cloudAfter.products && localAfter.products > 0 },
    { name: "LOCAL prices == CLOUD prices", ok: localAfter.prices === cloudAfter.prices && localAfter.prices > 0 },
    { name: "Sync Devices preserved", ok: localAfter.syncDevices >= 0 && cloudAfter.syncDevices > 0 },
    { name: "LOCAL suppliers == 0", ok: localAfter.suppliers === 0 },
    { name: "CLOUD suppliers == 0", ok: cloudAfter.suppliers === 0 },
    { name: "LOCAL customers == 0", ok: localAfter.customers === 0 },
    { name: "CLOUD customers == 0", ok: cloudAfter.customers === 0 },
    { name: "LOCAL sales == 0", ok: localAfter.sales === 0 },
    { name: "CLOUD sales == 0", ok: cloudAfter.sales === 0 },
    { name: "LOCAL receivings == 0", ok: localAfter.receivings === 0 },
    { name: "CLOUD receivings == 0", ok: cloudAfter.receivings === 0 },
    { name: "LOCAL stockMovements == 0", ok: localAfter.stockMovements === 0 },
    { name: "CLOUD stockMovements == 0", ok: cloudAfter.stockMovements === 0 },
    { name: "LOCAL damageRecords == 0", ok: localAfter.damageRecords === 0 },
    { name: "CLOUD damageRecords == 0", ok: cloudAfter.damageRecords === 0 },
    { name: "LOCAL dailyClosings == 0", ok: localAfter.dailyClosings === 0 },
    { name: "CLOUD dailyClosings == 0", ok: cloudAfter.dailyClosings === 0 },
    { name: "LOCAL stockCounts == 0", ok: localAfter.stockCounts === 0 },
    { name: "CLOUD stockCounts == 0", ok: cloudAfter.stockCounts === 0 },
    { name: "LOCAL auditLogs == 0", ok: localAfter.auditLogs === 0 },
    { name: "CLOUD auditLogs == 0", ok: cloudAfter.auditLogs === 0 },
    { name: "LOCAL syncOutbox == 0", ok: localAfter.syncOutbox === 0 },
    { name: "CLOUD syncChangeLog == 0", ok: cloudAfter.syncChangelog === 0 },
  ];

  let allGood = true;
  for (const c of checks) {
    const icon = c.ok ? "✅" : "❌";
    console.log(`  ${icon} ${c.name}`);
    if (!c.ok) allGood = false;
  }

  if (allGood) {
    console.log("\n✅ All checks passed. Both databases are completely zeroed and ready for Day 1 operations.");
  } else {
    console.log("\n⚠️ Some checks failed — please review the counts above.");
  }

  await localDb.$disconnect();
  await cloudDb.$disconnect();
}

main().catch((e) => {
  console.error("Fatal error during cleanup:", e);
  process.exit(1);
});
