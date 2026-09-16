-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'IN_FLIGHT', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncChangeAction" AS ENUM ('UPSERT', 'DELETE');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "deviceId" VARCHAR(64);

-- CreateTable
CREATE TABLE "SyncOutbox" (
    "id" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "clientSequence" BIGSERIAL NOT NULL,
    "operationType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),

    CONSTRAINT "SyncOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" TEXT NOT NULL DEFAULT 'cloud_cursor',
    "lastSequence" BIGINT NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedSyncOperation" (
    "id" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "deviceId" VARCHAR(64) NOT NULL,
    "clientSequence" BIGINT NOT NULL,
    "operationType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "ProcessedSyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncChangeLog" (
    "changeSequence" BIGSERIAL NOT NULL,
    "operationType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "action" "SyncChangeAction" NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceDeviceId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncChangeLog_pkey" PRIMARY KEY ("changeSequence")
);

-- CreateTable
CREATE TABLE "SyncDevice" (
    "deviceId" VARCHAR(64) NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSequence" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncDevice_pkey" PRIMARY KEY ("deviceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncOutbox_operationId_key" ON "SyncOutbox"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOutbox_clientSequence_key" ON "SyncOutbox"("clientSequence");

-- CreateIndex
CREATE INDEX "SyncOutbox_status_clientSequence_idx" ON "SyncOutbox"("status", "clientSequence");

-- CreateIndex
CREATE INDEX "SyncOutbox_operationId_idx" ON "SyncOutbox"("operationId");

-- CreateIndex
CREATE INDEX "SyncOutbox_createdAt_idx" ON "SyncOutbox"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedSyncOperation_operationId_key" ON "ProcessedSyncOperation"("operationId");

-- CreateIndex
CREATE INDEX "ProcessedSyncOperation_operationId_idx" ON "ProcessedSyncOperation"("operationId");

-- CreateIndex
CREATE INDEX "ProcessedSyncOperation_processedAt_idx" ON "ProcessedSyncOperation"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedSyncOperation_deviceId_clientSequence_key" ON "ProcessedSyncOperation"("deviceId", "clientSequence");

-- CreateIndex
CREATE INDEX "SyncChangeLog_changeSequence_idx" ON "SyncChangeLog"("changeSequence");

-- CreateIndex
CREATE INDEX "SyncChangeLog_entityId_idx" ON "SyncChangeLog"("entityId");

-- CreateIndex
CREATE INDEX "SyncChangeLog_createdAt_idx" ON "SyncChangeLog"("createdAt");

-- CreateIndex
CREATE INDEX "SyncChangeLog_sourceDeviceId_idx" ON "SyncChangeLog"("sourceDeviceId");

-- CreateIndex
CREATE INDEX "SyncDevice_isRevoked_idx" ON "SyncDevice"("isRevoked");

-- CreateIndex
CREATE INDEX "AuditLog_deviceId_idx" ON "AuditLog"("deviceId");
