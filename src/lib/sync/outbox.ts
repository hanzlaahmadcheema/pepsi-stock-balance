import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { SyncOperationType } from "./types";

type TxClient = PrismaClient | Prisma.TransactionClient;

/**
 * Enqueues a local aggregate mutation into the SyncOutbox ledger.
 * This ensures all offline sales, edits, cancellations, customer mutations,
 * and receiving postings are safely queued and automatically pushed to Cloud
 * as soon as connectivity is present.
 */
export async function enqueueOutbox(
  tx: TxClient,
  operationType: SyncOperationType,
  entityId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const operationId = crypto.randomUUID();

  await tx.syncOutbox.create({
    data: {
      operationId,
      operationType,
      entityId,
      payload: payload as unknown as Prisma.InputJsonValue,
      status: "PENDING",
    },
  });
}
