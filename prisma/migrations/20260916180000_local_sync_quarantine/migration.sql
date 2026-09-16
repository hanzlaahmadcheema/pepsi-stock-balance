-- CreateEnum
CREATE TYPE "QuarantineStatus" AS ENUM ('QUARANTINED', 'RESOLVED');

-- CreateTable
CREATE TABLE "LocalSyncQuarantine" (
    "id" UUID NOT NULL,
    "changeSequence" BIGINT NOT NULL,
    "operationId" UUID NOT NULL,
    "operationType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" "SyncChangeAction" NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceDeviceId" VARCHAR(64),
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "status" "QuarantineStatus" NOT NULL DEFAULT 'QUARANTINED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionAction" TEXT,
    "resolutionReason" TEXT,
    "resolvedByUserId" UUID,

    CONSTRAINT "LocalSyncQuarantine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalSyncQuarantine_changeSequence_key" ON "LocalSyncQuarantine"("changeSequence");

-- CreateIndex
CREATE UNIQUE INDEX "LocalSyncQuarantine_operationId_key" ON "LocalSyncQuarantine"("operationId");

-- CreateIndex
CREATE INDEX "LocalSyncQuarantine_status_idx" ON "LocalSyncQuarantine"("status");

-- CreateIndex
CREATE INDEX "LocalSyncQuarantine_changeSequence_idx" ON "LocalSyncQuarantine"("changeSequence");

-- CreateIndex
CREATE INDEX "LocalSyncQuarantine_operationId_idx" ON "LocalSyncQuarantine"("operationId");

-- CreateIndex
CREATE INDEX "LocalSyncQuarantine_createdAt_idx" ON "LocalSyncQuarantine"("createdAt");
