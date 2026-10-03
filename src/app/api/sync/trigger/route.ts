import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushPendingOperations } from "@/lib/sync/client/push";
import { executePullCycle } from "@/lib/sync/client/pull";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const cloudBaseUrl = (
    process.env.CLOUD_SYNC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.CLOUD_URL ||
    ""
  ).trim();

  const deviceId = process.env.SYNC_DEVICE_ID?.trim();
  const deviceToken = process.env.SYNC_DEVICE_TOKEN?.trim();

  if (!deviceId || !deviceToken || !cloudBaseUrl) {
    return NextResponse.json({
      ok: false,
      message: "Sync is only enabled on local depot runtime with device credentials.",
    });
  }

  try {
    // 1. Push local pending operations (safe single-flight advisory lock protected)
    const pushResult = await pushPendingOperations(
      cloudBaseUrl,
      deviceId,
      deviceToken,
      fetch,
      prisma
    );

    // 2. Pull latest cloud changes (safe single-flight advisory lock protected)
    const pullResult = await executePullCycle({
      localDeviceId: deviceId,
      serverUrl: cloudBaseUrl,
      deviceToken,
      fetchFn: fetch,
      dbClient: prisma,
    });

    return NextResponse.json({
      ok: true,
      push: pushResult,
      pull: pullResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      error: message,
    });
  }
}

export async function GET() {
  return POST();
}
