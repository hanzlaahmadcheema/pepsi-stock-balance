/**
 * Prisma Safety Guard
 *
 * Wraps Prisma CLI commands to prevent accidental data destruction or schema drift
 * against the Production database (arntflxuoalstwdryykh).
 *
 * Rules:
 * 1. 'prisma migrate dev', 'db push', 'db reset' are BLOCKED in PRODUCTION.
 * 2. 'prisma migrate deploy' requires explicit confirmation (--confirm or CONFIRM_PROD_MIGRATE=true).
 * 3. In LOCAL and CLOUD_DEV, commands run without additional friction.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT_DIR, ".env");

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

function main() {
  const args = process.argv.slice(2);
  const commandStr = args.join(" ");

  const envVars = parseEnvFile(ENV_FILE);
  const appEnv = (envVars.APP_ENV || "").toUpperCase();
  const dbUrl = envVars.DATABASE_URL || "";

  const isProd =
    appEnv === "CLOUD_PROD" ||
    dbUrl.includes("arntflxuoalstwdryykh");

  if (isProd) {
    // Check forbidden destructive commands
    const isDestructive =
      args.includes("dev") ||
      args.includes("reset") ||
      args.includes("push") ||
      commandStr.includes("migrate dev") ||
      commandStr.includes("db push") ||
      commandStr.includes("db reset");

    if (isDestructive) {
      console.error("\n================================================================================");
      console.error("⛔ CRITICAL ACTION BLOCKED BY PRODUCTION SAFETY GUARD");
      console.error("================================================================================");
      console.error(`Attempted Command: prisma ${commandStr}`);
      console.error("Active Target:     CLOUD PRODUCTION (arntflxuoalstwdryykh)");
      console.error("");
      console.error("'prisma migrate dev', 'db push', and 'db reset' are STRICTLY PROHIBITED");
      console.error("against live production to prevent schema drift, downtime, or data loss.");
      console.error("");
      console.error("If you intended to deploy reviewed migrations to production, run:");
      console.error("  npm run prisma:deploy -- --confirm");
      console.error("================================================================================\n");
      process.exit(1);
    }

    // Check migrate deploy confirmation
    const isDeploy = commandStr.includes("migrate deploy");
    if (isDeploy) {
      const isConfirmed =
        args.includes("--confirm") ||
        process.env.CONFIRM_PROD_MIGRATE === "true" ||
        process.env.ALLOW_PROD_MIGRATE === "true";

      if (!isConfirmed) {
        console.error("\n================================================================================");
        console.error("⚠️  PRODUCTION MIGRATION GUARD — CONFIRMATION REQUIRED");
        console.error("================================================================================");
        console.error(`Attempted Command: prisma ${commandStr}`);
        console.error("Active Target:     CLOUD PRODUCTION (arntflxuoalstwdryykh)");
        console.error("");
        console.error("You are about to execute schema migrations against LIVE PRODUCTION.");
        console.error("To proceed deliberately, run with the --confirm flag:");
        console.error("  npm run prisma:deploy -- --confirm");
        console.error("================================================================================\n");
        process.exit(1);
      }
    }

    console.warn("\n================================================================================");
    console.warn("⚠️  WARNING: EXECUTING PRISMA AGAINST LIVE PRODUCTION (arntflxuoalstwdryykh)");
    console.warn(`Command: prisma ${commandStr}`);
    console.warn("================================================================================\n");
  }

  // Filter out internal guard flags like --confirm before forwarding to prisma
  const forwardedArgs = args.filter((arg) => arg !== "--confirm");

  const result = spawnSync("npx", ["prisma", ...forwardedArgs], {
    stdio: "inherit",
    shell: true,
    cwd: ROOT_DIR,
  });

  if (result.status !== null) {
    process.exit(result.status);
  }
}

main();
