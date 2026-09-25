import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { prisma } from "@/lib/prisma";
import { SyncStatusClient } from "./sync-status-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Depot Synchronization & Operations - Pepsi Stock Balance",
};

export default async function SyncStatusPage() {
  const user = await requireDbUser();

  // 1. Fetch Local Sync Outbox (Operations generated locally to push to Cloud)
  const rawOutbox = await prisma.syncOutbox.findMany({
    take: 200,
    orderBy: { clientSequence: "desc" },
  });

  const outboxOperations = rawOutbox.map((op) => ({
    id: op.id,
    operationId: op.operationId,
    clientSequence: op.clientSequence.toString(),
    operationType: op.operationType,
    entityId: op.entityId,
    payload: op.payload as Record<string, unknown>,
    status: op.status,
    retryCount: op.retryCount,
    lastError: op.lastError,
    createdAt: op.createdAt.toISOString(),
    syncedAt: op.syncedAt ? op.syncedAt.toISOString() : null,
  }));

  // 2. Fetch Outbox Metrics
  const totalOutbox = await prisma.syncOutbox.count();
  const unsyncedCount = await prisma.syncOutbox.count({
    where: { status: { in: ["PENDING", "IN_FLIGHT", "FAILED"] } },
  });
  const syncedCount = await prisma.syncOutbox.count({
    where: { status: "SYNCED" },
  });
  const failedCount = await prisma.syncOutbox.count({
    where: { status: "FAILED" },
  });
  const pendingCount = await prisma.syncOutbox.count({
    where: { status: "PENDING" },
  });

  // 3. Fetch Registered Sync Devices (Depot Terminals)
  const rawDevices = await prisma.syncDevice.findMany({
    orderBy: { lastSeenAt: "desc" },
  });

  const devices = rawDevices.map((d) => ({
    deviceId: d.deviceId,
    name: d.name,
    isRevoked: d.isRevoked,
    lastSeenAt: d.lastSeenAt.toISOString(),
    lastSequence: d.lastSequence.toString(),
    createdAt: d.createdAt.toISOString(),
  }));

  // 4. Fetch Sync Cursor
  const rawCursor = await prisma.syncCursor.findFirst();
  const cursor = rawCursor
    ? {
        id: rawCursor.id,
        lastSequence: rawCursor.lastSequence.toString(),
        lastSyncedAt: rawCursor.lastSyncedAt.toISOString(),
      }
    : null;

  // 5. Quarantine Metrics
  const quarantineCount = await prisma.localSyncQuarantine.count({
    where: { status: "QUARANTINED" },
  });

  const rawQuarantines = await prisma.localSyncQuarantine.findMany({
    where: { status: "QUARANTINED" },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  const recentQuarantines = rawQuarantines.map((q) => ({
    id: q.id,
    changeSequence: q.changeSequence.toString(),
    operationId: q.operationId,
    operationType: q.operationType,
    errorCode: q.errorCode,
    errorMessage: q.errorMessage,
    createdAt: q.createdAt.toISOString(),
    sourceDeviceId: q.sourceDeviceId,
  }));

  // 6. Change Log & Processed Operations
  const totalChanges = await prisma.syncChangeLog.count();

  const rawRecentOperations = await prisma.processedSyncOperation.findMany({
    take: 15,
    orderBy: { processedAt: "desc" },
  });

  const recentOperations = rawRecentOperations.map((op) => ({
    id: op.id,
    operationId: op.operationId,
    deviceId: op.deviceId,
    clientSequence: op.clientSequence.toString(),
    operationType: op.operationType,
    entityId: op.entityId,
    status: op.status,
    errorMessage: op.errorMessage,
    processedAt: op.processedAt.toISOString(),
  }));

  // 7. Calculate Health State
  const now = new Date().getTime();
  let onlineDevicesCount = 0;
  let activeWithin24hCount = 0;

  for (const d of rawDevices) {
    if (d.isRevoked) continue;
    const diffMin = (now - d.lastSeenAt.getTime()) / (1000 * 60);
    if (diffMin <= 10) {
      onlineDevicesCount++;
    }
    if (diffMin <= 1440) {
      activeWithin24hCount++;
    }
  }

  let overallHealth: "HEALTHY" | "ATTENTION" | "DEGRADED" = "HEALTHY";
  if (quarantineCount > 0 || failedCount > 0) {
    overallHealth = "ATTENTION";
  } else if (onlineDevicesCount === 0 && rawDevices.length > 0) {
    overallHealth = "DEGRADED";
  }

  // 8. Terminal / Environment metadata
  const terminalInfo = {
    deviceId: process.env.SYNC_DEVICE_ID || "Not configured",
    cloudBaseUrl: (
      process.env.CLOUD_SYNC_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.CLOUD_URL ||
      "http://localhost:3000"
    ).trim(),
    isConfigured: Boolean(process.env.SYNC_DEVICE_ID && process.env.SYNC_DEVICE_TOKEN),
    appEnv: process.env.APP_ENV || process.env.NODE_ENV || "LOCAL",
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <SyncStatusClient
          outboxOperations={outboxOperations}
          outboxCounts={{
            total: totalOutbox,
            unsynced: unsyncedCount,
            synced: syncedCount,
            failed: failedCount,
            pending: pendingCount,
          }}
          terminalInfo={terminalInfo}
          devices={devices}
          cursor={cursor}
          quarantineCount={quarantineCount}
          recentQuarantines={recentQuarantines}
          totalChanges={totalChanges}
          recentOperations={recentOperations}
          health={{
            overallHealth,
            onlineDevicesCount,
            totalDevicesCount: rawDevices.length,
            activeWithin24hCount,
          }}
        />
      </main>
    </div>
  );
}
