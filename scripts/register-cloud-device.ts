import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");
}

async function main() {
  const envPath = path.resolve(process.cwd(), "environments/.env.cloud-prod");
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  const url = parsed.DIRECT_URL || parsed.DATABASE_URL;

  console.log("Connecting to Cloud DB...");
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  const deviceId = "depot-production-01";
  const deviceName = "Production Windows Depot Server";
  const rawToken = "tok_d4ec1cc6620f9ab39223b50888b92d0310aa4b2c3bee554bf6cc38cdbe27596f";
  const tokenHash = hashToken(rawToken);

  console.log(`Device ID: ${deviceId}`);
  console.log(`Raw Token: ${rawToken}`);
  console.log(`Token Hash: ${tokenHash}`);

  const existingDevices = await prisma.syncDevice.findMany();
  console.log("Current devices in Cloud DB:", existingDevices);

  const device = await prisma.syncDevice.upsert({
    where: { deviceId },
    update: {
      name: deviceName,
      tokenHash,
      isRevoked: false,
    },
    create: {
      deviceId,
      name: deviceName,
      tokenHash,
      isRevoked: false,
    },
  });

  console.log("Successfully registered device in Cloud DB:", device);

  const allDevices = await prisma.syncDevice.findMany();
  console.log("All devices in Cloud DB now:", allDevices);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
