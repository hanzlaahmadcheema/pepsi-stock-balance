import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveScheduler } from "@/lib/sync/daemon/scheduler";

export const dynamic = "force-dynamic";

export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  application: {
    name: string;
    version: string;
    nodeEnv: string;
    uptimeSeconds: number;
  };
  database: {
    status: "connected" | "disconnected";
    latencyMs?: number;
    error?: string;
  };
  sync: {
    currentCursor: string;
    lastSyncedAt: string | null;
    activeQuarantineCount: number;
    pendingOutboxCount: number;
    scheduler: {
      inProcess: boolean;
      running?: boolean;
      isPushing?: boolean;
      isPulling?: boolean;
      pushBackoffIndex?: number;
      pullBackoffIndex?: number;
      lastPushAt?: string | null;
      lastPullAt?: string | null;
      lastPushSuccess?: boolean | null;
      lastPullSuccess?: boolean | null;
    };
  };
}

export async function GET() {
  const startTime = Date.now();
  let dbStatus: "connected" | "disconnected" = "disconnected";
  let dbLatencyMs: number | undefined;
  let dbError: string | undefined;

  let currentCursor = "0";
  let lastSyncedAt: string | null = null;
  let activeQuarantineCount = 0;
  let pendingOutboxCount = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1 as health_check`;
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = "connected";

    // Query sync health metrics
    const cursor = await prisma.syncCursor.findUnique({
      where: { id: "cloud_cursor" },
    });
    if (cursor) {
      currentCursor = cursor.lastSequence.toString();
      lastSyncedAt = cursor.lastSyncedAt.toISOString();
    }

    activeQuarantineCount = await prisma.localSyncQuarantine.count({
      where: { status: "QUARANTINED" },
    });

    pendingOutboxCount = await prisma.syncOutbox.count({
      where: { status: "PENDING" },
    });
  } catch (err: unknown) {
    dbStatus = "disconnected";
    dbError = err instanceof Error ? err.message : String(err);
  }

  // Check in-process scheduler state if running in this process
  const activeScheduler = getActiveScheduler();
  const schedulerStatus = activeScheduler ? activeScheduler.getStatus() : null;

  const isHealthy = dbStatus === "connected" && activeQuarantineCount === 0;
  const isDegraded = dbStatus === "connected" && activeQuarantineCount > 0;
  const overallStatus: "healthy" | "degraded" | "unhealthy" = isHealthy
    ? "healthy"
    : isDegraded
    ? "degraded"
    : "unhealthy";

  const responseBody: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    application: {
      name: "pepsi-stock-balance",
      version: "1.0.0",
      nodeEnv: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.floor(process.uptime()),
    },
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
      ...(dbError ? { error: dbError } : {}),
    },
    sync: {
      currentCursor,
      lastSyncedAt,
      activeQuarantineCount,
      pendingOutboxCount,
      scheduler: schedulerStatus
        ? {
            inProcess: true,
            running: schedulerStatus.running,
            isPushing: schedulerStatus.isPushing,
            isPulling: schedulerStatus.isPulling,
            pushBackoffIndex: schedulerStatus.pushBackoffIndex,
            pullBackoffIndex: schedulerStatus.pullBackoffIndex,
            lastPushAt: schedulerStatus.lastPushAt,
            lastPullAt: schedulerStatus.lastPullAt,
            lastPushSuccess: schedulerStatus.lastPushSuccess,
            lastPullSuccess: schedulerStatus.lastPullSuccess,
          }
        : {
            inProcess: false,
          },
    },
  };

  const httpStatus = overallStatus === "unhealthy" ? 503 : 200;
  return NextResponse.json(responseBody, { status: httpStatus });
}
