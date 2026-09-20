/**
 * Linux Development Environment Selector & Status Utility
 *
 * Supports safe switching between:
 *   1. LOCAL       (Local PostgreSQL: localhost:5433 / pepsi_local)
 *   2. CLOUD_DEV   (Dev / UAT Supabase: obtoonfhcwwhanvqtkio)
 *   3. CLOUD_PROD  (Production Supabase: arntflxuoalstwdryykh)
 *
 * Invariants:
 * - Production selection requires deliberate --confirm flag.
 * - Local & Dev can NEVER point to Production database.
 * - Password and secrets are NEVER printed in status or stdout.
 * - Active configuration is written to root .env (which is strictly git-ignored).
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { PrismaClient } from "@prisma/client";

const ROOT_DIR = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT_DIR, ".env");
const ENVIRONMENTS_DIR = path.join(ROOT_DIR, "environments");

export type EnvType = "LOCAL" | "CLOUD_DEV" | "CLOUD_PROD";

interface EnvConfig {
  name: EnvType;
  displayName: string;
  sourceFile: string;
  exampleFile: string;
  expectedDbPattern: RegExp;
  expectedSupabaseRef?: string;
  forbiddenDbPattern?: RegExp;
}

const ENVIRONMENTS: Record<EnvType, EnvConfig> = {
  LOCAL: {
    name: "LOCAL",
    displayName: "Local Workstation (PostgreSQL)",
    sourceFile: path.join(ENVIRONMENTS_DIR, ".env.local"),
    exampleFile: path.join(ROOT_DIR, ".env.local.example"),
    expectedDbPattern: /localhost|127\.0\.0\.1/,
    forbiddenDbPattern: /arntflxuoalstwdryykh|aws-.*pooler\.supabase\.com/,
  },
  CLOUD_DEV: {
    name: "CLOUD_DEV",
    displayName: "Cloud Dev / UAT (Supabase obtoonfhcwwhanvqtkio)",
    sourceFile: path.join(ENVIRONMENTS_DIR, ".env.cloud-dev"),
    exampleFile: path.join(ROOT_DIR, ".env.cloud-dev.example"),
    expectedDbPattern: /obtoonfhcwwhanvqtkio/,
    expectedSupabaseRef: "obtoonfhcwwhanvqtkio",
    forbiddenDbPattern: /arntflxuoalstwdryykh/,
  },
  CLOUD_PROD: {
    name: "CLOUD_PROD",
    displayName: "Cloud Live Production (Supabase arntflxuoalstwdryykh)",
    sourceFile: path.join(ENVIRONMENTS_DIR, ".env.cloud-prod"),
    exampleFile: path.join(ROOT_DIR, ".env.cloud-prod.example"),
    expectedDbPattern: /arntflxuoalstwdryykh/,
    expectedSupabaseRef: "arntflxuoalstwdryykh",
    forbiddenDbPattern: /obtoonfhcwwhanvqtkio/,
  },
};

function maskDatabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return "NOT CONFIGURED";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) {
      parsed.password = "********";
    }
    return parsed.toString();
  } catch {
    // If regex fallback needed
    return rawUrl.replace(/:([^:@]+)@/, ":********@");
  }
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      result[key] = val;
    }
  }
  return result;
}

function extractSupabaseRef(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/);
  return match ? match[1] : undefined;
}

async function testDbConnectivity(databaseUrl?: string): Promise<{ connected: boolean; message: string }> {
  if (!databaseUrl || databaseUrl.includes("YOUR_") || databaseUrl.includes("REPLACE_WITH_")) {
    return { connected: false, message: "Credentials not configured (placeholders present)" };
  }
  const testClient = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    const timer = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Connection timeout (3s)")), 3000)
    );
    await Promise.race([testClient.$queryRaw`SELECT 1 as ping;`, timer]);
    await testClient.$disconnect();
    return { connected: true, message: "Connected successfully (read-only ping OK)" };
  } catch (err: any) {
    await testClient.$disconnect().catch(() => {});
    return { connected: false, message: err.message?.split("\n")[0] || "Connection failed" };
  }
}

async function printStatus() {
  console.log("\n================================================================================");
  console.log("             PEPSI STOCK & SALES — ACTIVE ENVIRONMENT STATUS");
  console.log("================================================================================");

  if (!fs.existsSync(ENV_FILE)) {
    console.log("Status: NO ACTIVE .env FILE DETECTED");
    console.log("Run one of the following to select an environment:");
    console.log("  npm run env:local");
    console.log("  npm run env:dev");
    console.log("  npm run env:prod -- --confirm");
    console.log("================================================================================\n");
    return;
  }

  const envVars = parseEnvFile(ENV_FILE);
  const appEnv = (envVars.APP_ENV || "UNKNOWN").toUpperCase() as EnvType | "UNKNOWN";
  const dbUrl = envVars.DATABASE_URL;
  const directUrl = envVars.DIRECT_URL;
  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseRef = extractSupabaseRef(supabaseUrl);
  const cloudSyncBaseUrl = envVars.CLOUD_SYNC_BASE_URL || "NOT CONFIGURED";
  const syncDeviceId = envVars.SYNC_DEVICE_ID || "NOT CONFIGURED";

  let roleLabel = "DEVELOPMENT";
  let isProduction = false;

  if (appEnv === "LOCAL") {
    roleLabel = "LOCAL WORKSTATION DEVELOPMENT";
  } else if (appEnv === "CLOUD_DEV") {
    roleLabel = "DEV / STAGING / UAT";
  } else if (appEnv === "CLOUD_PROD") {
    roleLabel = "LIVE PRODUCTION";
    isProduction = true;
  } else {
    roleLabel = "UNKNOWN / CUSTOM";
  }

  if (isProduction) {
    console.log("⚠️  ⚠️  ⚠️  WARNING: LIVE PRODUCTION ENVIRONMENT IS CURRENTLY ACTIVE!  ⚠️  ⚠️  ⚠️");
    console.log("================================================================================");
  }

  console.log(`Environment:           ${appEnv} (${roleLabel})`);
  console.log(`Database (Masked):     ${maskDatabaseUrl(dbUrl)}`);
  console.log(`Direct URL (Masked):   ${maskDatabaseUrl(directUrl)}`);
  console.log(`Supabase URL:          ${supabaseUrl || "NOT CONFIGURED"}`);
  console.log(`Supabase Project Ref:  ${supabaseRef || "N/A"}`);
  console.log(`Cloud Sync Base URL:   ${cloudSyncBaseUrl}`);
  console.log(`Sync Device ID:        ${syncDeviceId}`);

  // Safety checks
  console.log("--------------------------------------------------------------------------------");
  console.log("Safety Audits:");

  if (appEnv === "LOCAL") {
    if (dbUrl && /arntflxuoalstwdryykh/.test(dbUrl)) {
      console.log("❌ CRITICAL MISMATCH: Environment is LOCAL but DATABASE_URL points to PRODUCTION!");
    } else if (dbUrl && /localhost|127\.0\.0\.1/.test(dbUrl)) {
      console.log("✅ Local Database Isolation: Target verified as local host.");
    } else {
      console.log("⚠️  Notice: Database host is neither localhost nor production.");
    }
  } else if (appEnv === "CLOUD_DEV") {
    if (dbUrl && /arntflxuoalstwdryykh/.test(dbUrl)) {
      console.log("❌ CRITICAL MISMATCH: Environment is CLOUD_DEV but DATABASE_URL points to PRODUCTION!");
    } else if (dbUrl && /obtoonfhcwwhanvqtkio/.test(dbUrl)) {
      console.log("✅ Cloud Dev Isolation: Target verified as Dev/UAT (obtoonfhcwwhanvqtkio).");
    }
  } else if (appEnv === "CLOUD_PROD") {
    if (dbUrl && /arntflxuoalstwdryykh/.test(dbUrl)) {
      console.log("⚠️  Production Target Verified: Connecting to arntflxuoalstwdryykh.");
    } else {
      console.log("❌ CRITICAL MISMATCH: Environment is CLOUD_PROD but DATABASE_URL is not production ref!");
    }
  }

  // Check connectivity
  console.log("--------------------------------------------------------------------------------");
  process.stdout.write("Testing Database Connectivity (read-only)... ");
  const connResult = await testDbConnectivity(dbUrl);
  if (connResult.connected) {
    console.log("✅ " + connResult.message);
  } else {
    console.log("ℹ️  " + connResult.message);
  }

  console.log("================================================================================\n");
}

async function switchEnvironment(targetEnv: EnvType, args: string[]) {
  const config = ENVIRONMENTS[targetEnv];
  if (!config) {
    console.error(`Error: Unknown environment '${targetEnv}'. Valid options: LOCAL, CLOUD_DEV, CLOUD_PROD`);
    process.exit(1);
  }

  // Guard for PRODUCTION
  if (targetEnv === "CLOUD_PROD") {
    const isConfirmed =
      args.includes("--confirm") ||
      args.includes("--force") ||
      process.env.CONFIRM_PROD === "true";

    if (!isConfirmed) {
      console.log("\n================================================================================");
      console.log("⚠️  PRODUCTION SAFETY GUARD — CONFIRMATION REQUIRED");
      console.log("================================================================================");
      console.log("You are attempting to activate the CLOUD PRODUCTION environment:");
      console.log("  Supabase Project: arntflxuoalstwdryykh (pepsi-stock-balance-prod)");
      console.log("  Vercel Target:    https://pepsi-stock-management.vercel.app");
      console.log("");
      console.log("All application commands, tests, and scripts will point to LIVE production data.");
      console.log("");
      console.log("To confirm and proceed, run with the --confirm flag:");
      console.log("  npm run env:prod -- --confirm");
      console.log("================================================================================\n");
      process.exit(1);
    }
  }

  // Determine source file (prefer private environments/ file, fallback to .example)
  let sourcePath = config.sourceFile;
  if (!fs.existsSync(sourcePath)) {
    if (fs.existsSync(config.exampleFile)) {
      console.log(`Notice: ${sourcePath} not found. Creating from template ${config.exampleFile}`);
      fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
      fs.copyFileSync(config.exampleFile, sourcePath);
    } else {
      console.error(`Error: Neither ${sourcePath} nor ${config.exampleFile} exists.`);
      process.exit(1);
    }
  }

  const content = fs.readFileSync(sourcePath, "utf8");
  const parsed = parseEnvFile(sourcePath);

  // Validate that source file matches target invariants
  const dbUrl = parsed.DATABASE_URL || "";
  if (config.forbiddenDbPattern && config.forbiddenDbPattern.test(dbUrl)) {
    console.error(`\n❌ SAFETY VIOLATION: ${sourcePath} contains forbidden database pattern (${config.forbiddenDbPattern})!`);
    console.error("Aborting switch to prevent environment corruption.\n");
    process.exit(1);
  }

  // Copy to .env
  fs.writeFileSync(ENV_FILE, content, "utf8");

  // Check if a root .env.local exists that might override .env in Next.js
  const rootEnvLocal = path.join(ROOT_DIR, ".env.local");
  if (fs.existsSync(rootEnvLocal)) {
    console.log(`Notice: Removing lingering root .env.local to ensure Next.js respects the active .env.`);
    fs.unlinkSync(rootEnvLocal);
  }

  console.log("\n================================================================================");
  if (targetEnv === "CLOUD_PROD") {
    console.log("⚠️  SUCCESSFULLY SWITCHED TO LIVE CLOUD PRODUCTION");
    console.log("================================================================================");
    console.log(`Target:           ${config.displayName}`);
    console.log(`Configuration:    .env updated from ${path.relative(ROOT_DIR, sourcePath)}`);
    console.log("CAUTION:          All subsequent operations will target LIVE Production!");
  } else {
    console.log(`✅ SUCCESSFULLY SWITCHED TO ${targetEnv}`);
    console.log("================================================================================");
    console.log(`Target:           ${config.displayName}`);
    console.log(`Configuration:    .env updated from ${path.relative(ROOT_DIR, sourcePath)}`);
  }
  console.log("================================================================================\n");

  await printStatus();
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  switch (command) {
    case "switch":
    case "select": {
      const target = args[1]?.toUpperCase();
      if (target === "LOCAL") {
        await switchEnvironment("LOCAL", args);
      } else if (target === "DEV" || target === "CLOUD_DEV") {
        await switchEnvironment("CLOUD_DEV", args);
      } else if (target === "PROD" || target === "CLOUD_PROD") {
        await switchEnvironment("CLOUD_PROD", args);
      } else {
        console.error("Usage: tsx scripts/env-manager.ts switch <local|dev|prod> [--confirm]");
        process.exit(1);
      }
      break;
    }
    case "status":
      await printStatus();
      break;
    default:
      console.log("Pepsi Environment Manager");
      console.log("Usage:");
      console.log("  npm run env:local           Switch to Local PostgreSQL");
      console.log("  npm run env:dev             Switch to Dev / UAT Supabase (obtoonfhcwwhanvqtkio)");
      console.log("  npm run env:prod -- --confirm Switch to Production Supabase (arntflxuoalstwdryykh)");
      console.log("  npm run env:status          Check active environment and database target");
      break;
  }
}

main().catch((err) => {
  console.error("Fatal error in env-manager:", err);
  process.exit(1);
});
