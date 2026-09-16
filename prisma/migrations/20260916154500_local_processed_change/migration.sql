-- CreateTable
CREATE TABLE "LocalProcessedChange" (
    "id" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "changeSequence" BIGINT NOT NULL,
    "operationType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "sourceDeviceId" VARCHAR(64),
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalProcessedChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalProcessedChange_operationId_key" ON "LocalProcessedChange"("operationId");

-- CreateIndex
CREATE UNIQUE INDEX "LocalProcessedChange_changeSequence_key" ON "LocalProcessedChange"("changeSequence");

-- CreateIndex
CREATE INDEX "LocalProcessedChange_operationId_idx" ON "LocalProcessedChange"("operationId");

-- CreateIndex
CREATE INDEX "LocalProcessedChange_changeSequence_idx" ON "LocalProcessedChange"("changeSequence");
