import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { prisma } from "@/lib/prisma";
import { SyncStatusClient } from "./sync-status-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Depot Synchronization Status - Pepsi Stock Balance",
};

export default async function SyncStatusPage() {
  const user = await requireDbUser();

  // 1. Fetch Registered Sync Devices (Depot Terminals)
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

  // 2. Fetch Sync Cursor
  const rawCursor = await prisma.syncCursor.findFirst();
  const cursor = rawCursor
    ? {
        id: rawCursor.id,
        lastSequence: rawCursor.lastSequence.toString(),
        lastSyncedAt: rawCursor.lastSyncedAt.toISOString(),
      }
    : null;

  // 3. Quarantine Metrics
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

  // 4. Change Log & Processed Operations
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

  // 5. Calculate Health State
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
  if (quarantineCount > 0) {
    overallHealth = "ATTENTION";
  } else if (onlineDevicesCount === 0 && rawDevices.length > 0) {
    overallHealth = "DEGRADED";
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <SyncStatusClient
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
