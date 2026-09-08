"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  submitStockCountTransaction,
  resolveAdjustmentTransaction,
  type StockCountItemInput,
} from "@/lib/stock-counts/service";

export type StockCountActionState = {
  success?: boolean;
  error?: string;
  closingId?: string;
  adjustmentId?: string;
} | null;

export async function submitStockCountAction(
  _prevState: StockCountActionState,
  formData: FormData
): Promise<StockCountActionState> {
  try {
    const user = await requireDbUser();

    const businessDate = formData.get("businessDate") as string;
    const notes = (formData.get("notes") as string) || undefined;
    const countsJson = formData.get("counts") as string;

    if (!businessDate) {
      return { error: "Business date is required." };
    }

    if (!countsJson) {
      return { error: "Counts payload is missing." };
    }

    let parsedCounts: StockCountItemInput[] = [];
    try {
      parsedCounts = JSON.parse(countsJson);
    } catch {
      return { error: "Invalid counts payload format." };
    }

    if (!Array.isArray(parsedCounts) || parsedCounts.length === 0) {
      return { error: "At least one product count is required." };
    }

    const result = await submitStockCountTransaction(
      {
        businessDate,
        counts: parsedCounts,
        notes,
      },
      user.id
    );

    revalidatePath("/stock-counts");
    revalidatePath(`/stock-counts/${result.closingId}`);
    revalidatePath("/products");

    return { success: true, closingId: result.closingId };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to submit stock count.",
    };
  }
}

export async function resolveAdjustmentAction(
  _prevState: StockCountActionState,
  formData: FormData
): Promise<StockCountActionState> {
  try {
    // Strictly enforce OWNER role server-side
    const ownerUser = await requireRole(Role.OWNER);

    const adjustmentId = formData.get("adjustmentId") as string;
    const decision = formData.get("decision") as "APPROVE" | "REJECT";
    const reason = formData.get("reason") as string;

    if (!adjustmentId) {
      return { error: "Adjustment ID is required." };
    }

    if (decision !== "APPROVE" && decision !== "REJECT") {
      return { error: "Invalid decision. Must be APPROVE or REJECT." };
    }

    if (!reason?.trim() || reason.trim().length < 3) {
      return {
        error: "A mandatory non-empty explanation reason is required for your decision.",
      };
    }

    const result = await resolveAdjustmentTransaction(
      adjustmentId,
      decision,
      reason.trim(),
      ownerUser.id
    );

    revalidatePath("/stock-counts");
    revalidatePath("/products");

    return { success: true, adjustmentId: result.adjustmentId };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to resolve adjustment.",
    };
  }
}
