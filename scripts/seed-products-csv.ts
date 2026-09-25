/**
 * scripts/seed-products-csv.ts
 *
 * Imports products from data/products.csv into the database with deterministic UUIDs,
 * sets initial prices, updates container settings (returnable glass crates),
 * and optionally registers change-log operations on Cloud for automatic client pull synchronization.
 */

import { PrismaClient, PriceTier, Prisma } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getContainerSettings, updateContainerSettings } from "../src/lib/containers/settings-service";

export interface CsvProductRow {
  name: string;
  brand: string;
  costPrice: number;
  retailPrice: number;
  sku: string;
  lowStockAlert: number;
  glassCrate: boolean;
}

export function deterministicUuid(seed: string): string {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  const part1 = hash.substring(0, 8);
  const part2 = hash.substring(8, 12);
  const part3 = "4" + hash.substring(13, 16);
  const part4 =
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80)
      .toString(16)
      .padStart(2, "0") + hash.substring(18, 20);
  const part5 = hash.substring(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export function parseProductsCsv(csvPath: string): CsvProductRow[] {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }

  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV file is empty or missing data rows.");
  }

  // Header: Name,Brand,CostPrice,RetailPrice,SKU,LowStockAlert,GlassCrate
  const products: CsvProductRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < 7) {
      console.warn(`Line ${i + 1} has insufficient columns, skipping: ${lines[i]}`);
      continue;
    }

    const [name, brand, costRaw, retailRaw, sku, alertRaw, glassRaw] = cols;
    const costPrice = Math.max(0, parseFloat(costRaw) || 0);
    const retailPrice = Math.max(0, parseFloat(retailRaw) || 0);
    const lowStockAlert = Math.max(0, parseInt(alertRaw, 10) || 5);
    const glassCrate = glassRaw.toUpperCase() === "TRUE";

    products.push({
      name,
      brand,
      costPrice,
      retailPrice,
      sku,
      lowStockAlert,
      glassCrate,
    });
  }

  return products;
}

export async function seedProductsToDatabase(
  prisma: PrismaClient,
  label: string,
  products: CsvProductRow[],
  recordCloudSyncChangeLog = false
) {
  console.log(`\n==================================================`);
  console.log(`Seeding Products into: ${label}`);
  console.log(`==================================================`);

  // 1. Find active user for Price attribution
  const user = await prisma.user.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!user) {
    throw new Error(`Cannot seed prices: No active user found in ${label}!`);
  }

  console.log(`Using user [${user.role}] ${user.name} (${user.id}) for price creation.`);

  let createdProducts = 0;
  let updatedProducts = 0;
  let createdPrices = 0;
  let changelogCount = 0;

  for (const item of products) {
    const productId = deterministicUuid(`pepsi:product:${item.sku}`);
    const priceId = deterministicUuid(`pepsi:price:retail:${item.sku}`);

    // Upsert Product
    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          name: item.name,
          brand: item.brand,
          sku: item.sku,
          minimumStockLevel: item.lowStockAlert,
          latestPurchasePrice: new Prisma.Decimal(item.costPrice.toFixed(2)),
          isActive: true,
        },
      });
      updatedProducts++;
    } else {
      await prisma.product.create({
        data: {
          id: productId,
          name: item.name,
          brand: item.brand,
          sku: item.sku,
          minimumStockLevel: item.lowStockAlert,
          latestPurchasePrice: new Prisma.Decimal(item.costPrice.toFixed(2)),
          isActive: true,
        },
      });
      createdProducts++;
    }

    // Upsert Price (Retail Tier)
    const activePrice = await prisma.price.findFirst({
      where: {
        productId,
        tier: PriceTier.RETAIL,
        effectiveTo: null,
      },
    });

    if (activePrice) {
      await prisma.price.update({
        where: { id: activePrice.id },
        data: {
          amount: new Prisma.Decimal(item.retailPrice.toFixed(2)),
        },
      });
    } else {
      await prisma.price.create({
        data: {
          id: priceId,
          productId,
          tier: PriceTier.RETAIL,
          amount: new Prisma.Decimal(item.retailPrice.toFixed(2)),
          createdById: user.id,
          effectiveFrom: new Date(),
          effectiveTo: null,
        },
      });
      createdPrices++;
    }

    // If Cloud DB, record SyncChangeLog operations so client devices pull changes
    if (recordCloudSyncChangeLog) {
      const syncProductOpId = deterministicUuid(`pepsi:sync:upsert-product:${item.sku}`);
      const syncPriceOpId = deterministicUuid(`pepsi:sync:create-price:${item.sku}`);

      await prisma.syncChangeLog.upsert({
        where: { operationId: syncProductOpId },
        update: {
          payload: {
            name: item.name,
            brand: item.brand,
            sku: item.sku,
            minimumStockLevel: item.lowStockAlert,
            latestPurchasePrice: item.costPrice,
            isActive: true,
          } as Prisma.InputJsonValue,
        },
        create: {
          operationId: syncProductOpId,
          operationType: "UPSERT_PRODUCT",
          entityId: productId,
          action: "UPSERT",
          payload: {
            name: item.name,
            brand: item.brand,
            sku: item.sku,
            minimumStockLevel: item.lowStockAlert,
            latestPurchasePrice: item.costPrice,
            isActive: true,
          } as Prisma.InputJsonValue,
          sourceDeviceId: null,
        },
      });
      changelogCount++;

      await prisma.syncChangeLog.upsert({
        where: { operationId: syncPriceOpId },
        update: {
          payload: {
            productId,
            tier: PriceTier.RETAIL,
            amount: item.retailPrice,
          } as Prisma.InputJsonValue,
        },
        create: {
          operationId: syncPriceOpId,
          operationType: "CREATE_PRICE",
          entityId: priceId,
          action: "UPSERT",
          payload: {
            productId,
            tier: PriceTier.RETAIL,
            amount: item.retailPrice,
          } as Prisma.InputJsonValue,
          sourceDeviceId: null,
        },
      });
      changelogCount++;
    }
  }

  console.log(`  ✓ Products: ${createdProducts} created, ${updatedProducts} updated (Total: ${products.length})`);
  console.log(`  ✓ Prices (Retail): ${createdPrices} created`);
  if (recordCloudSyncChangeLog) {
    console.log(`  ✓ Cloud SyncChangeLog: ${changelogCount} change operations recorded`);
  }
}

export function syncContainerSettingsWithCsv(
  products: CsvProductRow[],
  targetDir: string
) {
  const settingsPath = path.join(targetDir, "data", "container-settings.json");
  const settings = getContainerSettings();
  const productConfigs: Record<string, { hasGlassCrate: boolean; bottlesPerCrate: number }> = {
    ...settings.productConfigs,
  };

  let glassCount = 0;
  let nonGlassCount = 0;

  for (const item of products) {
    const productId = deterministicUuid(`pepsi:product:${item.sku}`);
    const config = {
      hasGlassCrate: item.glassCrate,
      bottlesPerCrate: 24,
    };

    // Store by both ID and Name to ensure immediate lookup compatibility
    productConfigs[productId] = config;
    productConfigs[item.name] = config;

    if (item.glassCrate) {
      glassCount++;
    } else {
      nonGlassCount++;
    }
  }

  updateContainerSettings({ productConfigs });
  console.log(`\nUpdated Container Settings at ${settingsPath}:`);
  console.log(`  ✓ ${glassCount} returnable glass crate products`);
  console.log(`  ✓ ${nonGlassCount} non-returnable products`);
}

async function main() {
  const target = process.argv[2] || "all";
  const csvPath = path.join(process.cwd(), "data", "products.csv");

  console.log(`Reading products from: ${csvPath}`);
  const products = parseProductsCsv(csvPath);
  console.log(`Parsed ${products.length} products successfully.`);

  // 1. Update container settings JSON on disk
  syncContainerSettingsWithCsv(products, process.cwd());

  const cloudDbUrl =
    process.env.CLOUD_DATABASE_URL ||
    "postgresql://postgres.arntflxuoalstwdryykh:%40Faisal123%21@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30";

  if (target === "cloud" || target === "all") {
    console.log("\nConnecting to Cloud Supabase Database...");
    const cloudPrisma = new PrismaClient({
      datasources: { db: { url: cloudDbUrl } },
    });
    try {
      await seedProductsToDatabase(cloudPrisma, "Cloud Supabase DB", products, true);
    } finally {
      await cloudPrisma.$disconnect();
    }
  }

  if (target === "local" || target === "all") {
    console.log("\nConnecting to Local / Default DATABASE_URL...");
    const defaultPrisma = new PrismaClient();
    try {
      await seedProductsToDatabase(defaultPrisma, "Local / Active DB", products, false);
    } finally {
      await defaultPrisma.$disconnect();
    }
  }

  console.log("\n==================================================");
  console.log("PRODUCT SEEDING COMPLETED SUCCESSFULLY");
  console.log("==================================================");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("FATAL ERROR seeding products:", err);
    process.exit(1);
  });
}
