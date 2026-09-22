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

  // 2. Ping cloud Supabase (lightweight: list users with limit 1)
  let cloudOk = false;
  let cloudLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    cloudLatencyMs = Date.now() - t0;
    cloudOk = !error;
  } catch {
    cloudOk = false;
  }

  return NextResponse.json({
    local: { ok: localOk, latencyMs: localLatencyMs },
    cloud: { ok: cloudOk, latencyMs: cloudLatencyMs },
  });
}
