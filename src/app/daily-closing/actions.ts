"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser, requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  getOrCreateDailyClosing,
  submitDailyClosingForReview,
  finalizeAndCloseDailyClosing,
  reopenDailyClosing,
} from "@/lib/daily-closing/service";

export type ActionState = {
  success?: boolean;
  error?: string;
  closingId?: string;
};

/**
 * Initializes or navigates to a daily closing session for a given business date.
 */
export async function openOrCreateDailyClosingAction(
  dateStr: string
): Promise<{ closingId: string }> {
  const user = await requireDbUser();

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("Valid business date (YYYY-MM-DD) is required.");
  }

  const { closingId } = await getOrCreateDailyClosing(dateStr, user.id);

  revalidatePath("/daily-closing");
  revalidatePath(`/daily-closing/${closingId}`);
  return { closingId };
}

/**
 * Staff or Owner prepares and submits the day's closing for review.
 */
export async function submitDailyClosingAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireDbUser();

    const closingId = formData.get("closingId") as string;
    const physicalCashStr = formData.get("physicalCash") as string;
    const notes = formData.get("notes") as string | null;

    if (!closingId) {
      return { error: "Closing session ID is required." };
    }

    const physicalCash = parseFloat(physicalCashStr);
    if (isNaN(physicalCash) || physicalCash < 0) {
      return { error: "Please enter a valid non-negative physical cash drawer amount." };
    }

    await submitDailyClosingForReview(
      closingId,
      physicalCash,
      notes || undefined,
      user.id
    );

    revalidatePath("/daily-closing");
    revalidatePath(`/daily-closing/${closingId}`);
    return { success: true, closingId };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to submit daily closing.",
    };
  }
}

/**
 * Owner reviews and executes the single final close action for the business day.
 */
export async function finalizeDailyClosingAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireRole(Role.OWNER);

    const closingId = formData.get("closingId") as string;
    const physicalCashStr = formData.get("physicalCash") as string | null;
    const notes = formData.get("notes") as string | null;

    if (!closingId) {
      return { error: "Closing session ID is required." };
    }

    let physicalCash: number | undefined;
    if (physicalCashStr !== null && physicalCashStr !== "") {
      physicalCash = parseFloat(physicalCashStr);
      if (isNaN(physicalCash) || physicalCash < 0) {
        return { error: "Physical cash must be a non-negative amount." };
      }
    }

    await finalizeAndCloseDailyClosing(
      closingId,
      physicalCash,
      notes || undefined,
      user.id
    );

    revalidatePath("/daily-closing");
    revalidatePath(`/daily-closing/${closingId}`);
    return { success: true, closingId };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to finalize daily closing.",
    };
  }
}

/**
 * Owner reopens a closed session with a mandatory reason for administrative corrections.
 */
export async function reopenDailyClosingAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireRole(Role.OWNER);

    const closingId = formData.get("closingId") as string;
    const reason = formData.get("reason") as string | null;

    if (!closingId) {
      return { error: "Closing session ID is required." };
    }

    if (!reason || reason.trim().length < 3) {
      return { error: "A mandatory explanation (at least 3 characters) is required to reopen." };
    }

    await reopenDailyClosing(closingId, reason.trim(), user.id);

    revalidatePath("/daily-closing");
    revalidatePath(`/daily-closing/${closingId}`);
    return { success: true, closingId };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to reopen daily closing.",
    };
  }
}
