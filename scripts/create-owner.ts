/**
 * Safe Administrative Owner / Admin Account Creation Script
 *
 * Supports both interactive prompts and optional CLI flags:
 *   - Interactively prompts for Full Name / Username, Email, and Password (masked).
 *   - Provisions the account in Central Supabase Auth (email_confirm = true, role = OWNER).
 *   - Upserts the User record with Role.OWNER in PostgreSQL.
 *   - Creates an immutable AuditLog entry.
 *
 * Usage:
 *   npm run create:owner
 *   npx tsx scripts/create-owner.ts
 *   npx tsx scripts/create-owner.ts --name "Owner Name" --email "owner@depot.com" --password "Secret123!"
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { PrismaClient, Role } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const ROOT_DIR = path.resolve(__dirname, "..");

function loadEnvFile(filePath: string): Record<string, string> {
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
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.substring(1, val.length - 1);
      }
      result[key] = val;
    }
  }
  return result;
}

function resolveEnvConfig(): {
  supabaseUrl: string;
  supabaseServiceKey: string;
  databaseUrls: { label: string; url: string }[];
} {
  const envMain = loadEnvFile(path.join(ROOT_DIR, ".env"));
  const envCloudProd = loadEnvFile(path.join(ROOT_DIR, "environments", ".env.cloud-prod"));
  const envLocal = loadEnvFile(path.join(ROOT_DIR, "environments", ".env.local"));

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    envMain.NEXT_PUBLIC_SUPABASE_URL ||
    envCloudProd.NEXT_PUBLIC_SUPABASE_URL ||
    "https://arntflxuoalstwdryykh.supabase.co";

  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    envMain.SUPABASE_SERVICE_ROLE_KEY ||
    envCloudProd.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    console.error("❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is not configured in .env or environment.");
    process.exit(1);
  }

  const databaseUrls: { label: string; url: string }[] = [];
  const seenUrls = new Set<string>();

  const addTarget = (label: string, url?: string) => {
    if (url && !seenUrls.has(url) && !url.includes("REPLACE_WITH")) {
      seenUrls.add(url);
      databaseUrls.push({ label, url });
    }
  };

  // 1. Active database from .env
  addTarget("Active Environment Database (.env)", process.env.DATABASE_URL || envMain.DATABASE_URL);

  // 2. Cloud Supabase Direct URL (for migrations / direct writes)
  addTarget("Cloud Supabase Direct (arntflxuoalstwdryykh)", envCloudProd.DIRECT_URL);

  // 3. Local depot URL if distinct
  addTarget("Local Workstation / Depot DB", envLocal.DATABASE_URL);

  if (databaseUrls.length === 0) {
    console.error("❌ ERROR: No valid database connection URL found in .env or environments/ files.");
    process.exit(1);
  }

  return { supabaseUrl, supabaseServiceKey, databaseUrls };
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function askPassword(query: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(query);
    const stdin = process.stdin;

    if (stdin.isTTY && stdin.setRawMode) {
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding("utf8");

      let password = "";

      const onData = (chunk: string) => {
        for (const ch of chunk) {
          const code = ch.charCodeAt(0);

          if (code === 3) {
            // Ctrl+C
            if (stdin.setRawMode) stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener("data", onData);
            process.stdout.write("\n\nAborted by user.\n");
            process.exit(1);
          } else if (code === 13 || ch === "\n" || ch === "\r") {
            // Enter key
            if (stdin.setRawMode) stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener("data", onData);
            process.stdout.write("\n");
            resolve(password);
            return;
          } else if (code === 8 || code === 127) {
            // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write("\b \b");
            }
          } else if (code >= 32) {
            // Normal printable character
            password += ch;
            process.stdout.write("*");
          }
        }
      };

      stdin.on("data", onData);
    } else {
      // Non-interactive fallback
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question("", (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

function maskSecret(val: string): string {
  if (!val || val.length <= 6) return "******";
  return val.substring(0, 3) + "..." + val.substring(val.length - 3);
}

async function main() {
  console.log("\n==============================================================================");
  console.log("            PEPSI STOCK & SALES — CREATE OWNER / ADMIN ACCOUNT");
  console.log("==============================================================================");
  console.log("This utility provisions an OWNER account with full administrative authority.");
  console.log("------------------------------------------------------------------------------\n");

  const config = resolveEnvConfig();
  const args = process.argv.slice(2);

  let nameArg: string | undefined;
  let emailArg: string | undefined;
  let passwordArg: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--name" && args[i + 1]) {
      nameArg = args[i + 1].trim();
      i++;
    } else if (args[i] === "--email" && args[i + 1]) {
      emailArg = args[i + 1].trim();
      i++;
    } else if (args[i] === "--password" && args[i + 1]) {
      passwordArg = args[i + 1];
      i++;
    }
  }

  // 1. Prompt for Username / Full Name
  let name = nameArg || "";
  while (!name || name.length < 2) {
    name = await askQuestion("Enter Full Name or Username (min 2 chars): ");
    if (name.length < 2) {
      console.log("⚠️  Name must be at least 2 characters long. Please try again.");
    }
  }

  // 2. Prompt for Email Address
  let email = emailArg || "";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  while (!email || !emailRegex.test(email)) {
    email = (await askQuestion("Enter Email Address: ")).toLowerCase();
    if (!emailRegex.test(email)) {
      console.log("⚠️  Invalid email address format. Please enter a valid email (e.g. owner@depot.com).");
    }
  }

  // 3. Prompt for Password securely (with masked display)
  let password = passwordArg || "";
  if (!password) {
    while (!password || password.length < 8) {
      password = await askPassword("Enter Strong Password (min 8 chars): ");
      if (password.length < 8) {
        console.log("⚠️  Password must be at least 8 characters long. Please try again.");
      }
    }

    // Confirm password
    const confirmPassword = await askPassword("Confirm Password: ");
    if (password !== confirmPassword) {
      console.error("\n❌ ERROR: Passwords do not match. Aborting account creation.\n");
      process.exit(1);
    }
  }

  console.log("\n------------------------------------------------------------------------------");
  console.log("Provisioning account with Central Supabase Auth...");

  const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Step 1: Query or create user in Supabase Auth
  let authUserId: string;

  const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 200,
  });

  if (listError) {
    console.error("❌ Failed to query Supabase Auth service:", listError.message);
    process.exit(1);
  }

  const existingAuthUser = (userList?.users as any[])?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingAuthUser) {
    console.log(`ℹ️  Found existing auth account (${existingAuthUser.id}). Updating password and metadata...`);
    const { data: updatedAuth, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingAuthUser.id,
      {
        password,
        email_confirm: true,
        user_metadata: { name },
        app_metadata: { role: Role.OWNER },
      }
    );

    if (updateError || !updatedAuth?.user) {
      console.error("❌ Failed to update Supabase Auth user:", updateError?.message);
      process.exit(1);
    }
    authUserId = updatedAuth.user.id;
    console.log("✅ Supabase Auth user credentials updated successfully.");
  } else {
    const { data: newAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { role: Role.OWNER },
    });

    if (createError || !newAuth?.user) {
      console.error("❌ Failed to create Supabase Auth user:", createError?.message);
      process.exit(1);
    }
    authUserId = newAuth.user.id;
    console.log(`✅ Created new user in Supabase Auth (Auth ID: ${authUserId}).`);
  }

  // Step 2: Upsert into Target PostgreSQL Databases
  console.log("\n------------------------------------------------------------------------------");
  console.log("Upserting User record into database targets...");

  for (const target of config.databaseUrls) {
    process.stdout.write(`  Connecting to: ${target.label}... `);

    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: target.url,
        },
      },
    });

    try {
      const dbUser = await prisma.user.upsert({
        where: { authUserId },
        update: {
          name,
          role: Role.OWNER,
          isActive: true,
        },
        create: {
          authUserId,
          name,
          role: Role.OWNER,
          isActive: true,
        },
      });

      // Record AuditLog entry
      await prisma.auditLog.create({
        data: {
          userId: dbUser.id,
          action: "PROVISION_OWNER",
          entityType: "User",
          entityId: dbUser.id,
          newValues: {
            name,
            email,
            role: Role.OWNER,
            authUserId,
          },
          reason: `Administrative Owner account provisioned for "${name}" (${email})`,
        },
      });

      console.log(`✅ OK (User ID: ${dbUser.id})`);
    } catch (dbErr: any) {
      console.log(`⚠️  Could not reach or update (${dbErr.message?.split("\n")[0] || "Skipped"})`);
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  }

  console.log("\n==============================================================================");
  console.log("                   OWNER ACCOUNT SUCCESSFULLY PROVISIONED");
  console.log("==============================================================================");
  console.log(`Full Name:      ${name}`);
  console.log(`Email Address:  ${email}`);
  console.log(`Role:           OWNER (Administrator)`);
  console.log(`Auth User ID:   ${authUserId}`);
  console.log(`Status:         ACTIVE`);
  console.log("------------------------------------------------------------------------------");
  console.log("You can now sign in immediately at:");
  console.log("  - Depot Local Server:  http://100.66.192.71:3000/login (or http://localhost:3000/login)");
  console.log("  - Cloud Production:    https://pepsi-stock-management.vercel.app/login");
  console.log("==============================================================================\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
