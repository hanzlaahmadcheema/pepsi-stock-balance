-- AlterTable
ALTER TABLE "SyncChangeLog" ADD COLUMN "operationId" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SyncChangeLog_operationId_key" ON "SyncChangeLog"("operationId");

-- CreateIndex
CREATE INDEX "SyncChangeLog_operationId_idx" ON "SyncChangeLog"("operationId");
