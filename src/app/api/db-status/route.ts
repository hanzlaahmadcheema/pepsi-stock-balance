import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // 1. Ping local Prisma DB
  let localOk = false;
  let localLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    localLatencyMs = Date.now() - t0;
    localOk = true;
  } catch {
    localOk = false;
  }

  // 2. Ping cloud Supabase with 2000ms timeout
  let cloudOk = false;
  let cloudLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    const pingCloud = async () => {
      const supabase = createAdminClient();
      const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
      return !error;
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Cloud ping timeout")), 2000)
    );

    const isOk = await Promise.race([pingCloud(), timeoutPromise]);
    cloudLatencyMs = Date.now() - t0;
    cloudOk = isOk;
  } catch {
    cloudOk = false;
  }

  // 3. Count pending sync operations in SyncOutbox
  let pendingOutboxCount = 0;
  if (localOk) {
    try {
      pendingOutboxCount = await prisma.syncOutbox.count({
        where: { status: "PENDING" },
      });
    } catch {
      pendingOutboxCount = 0;
    }
  }

  return NextResponse.json({
    local: { ok: localOk, latencyMs: localLatencyMs },
    cloud: { ok: cloudOk, latencyMs: cloudLatencyMs },
    sync: { pendingCount: pendingOutboxCount },
  });
}
