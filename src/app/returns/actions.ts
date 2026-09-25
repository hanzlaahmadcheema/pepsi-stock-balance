"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser, requireRole } from "@/lib/auth";
import { assertNotCloudPortal } from "@/lib/config/portal-mode";
import { Role } from "@prisma/client";
import {
  createReturnTransaction,
  inspectReturnTransaction,
  type ReturnItemInput,
  type InspectItemDecision,
} from "@/lib/returns/service";

export type ReturnActionState = {
  success?: boolean;
  error?: string;
  returnId?: string;
} | null;

export async function createReturnAction(
  _prevState: ReturnActionState,
  formData: FormData
): Promise<ReturnActionState> {
  try {
    assertNotCloudPortal("Create Return");
    const user = await requireDbUser(); // Both STAFF and OWNER can create returns

    const saleId = formData.get("saleId") as string;
    const reason = formData.get("reason") as string;
    const notes = (formData.get("notes") as string) || undefined;
    const itemsJson = formData.get("items") as string;

    const plasticCratesStr = formData.get("plasticCrates") as string;
    const glassBottlesStr = formData.get("glassBottles") as string;

    if (!saleId) {
      return { error: "Sale reference is required." };
    }

    if (!itemsJson) {
      return { error: "Return items payload is missing." };
    }

    let parsedItems: ReturnItemInput[] = [];
    try {
      parsedItems = JSON.parse(itemsJson);
    } catch {
      return { error: "Invalid items format." };
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return { error: "At least one product item is required for return." };
    }

    const plasticCrates = parseInt(plasticCratesStr, 10) || 0;
    const glassBottles = parseInt(glassBottlesStr, 10) || 0;

    const result = await createReturnTransaction(
      {
        saleId,
        reason,
        notes,
        items: parsedItems,
        containers:
          plasticCrates > 0 || glassBottles > 0
            ? {
                plasticCrates: plasticCrates > 0 ? plasticCrates : undefined,
                glassBottles: glassBottles > 0 ? glassBottles : undefined,
              }
            : undefined,
      },
      user.id
    );

    revalidatePath("/returns");
    revalidatePath(`/sales/${saleId}`);

    return {
      success: true,
      returnId: result.returnId,
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to create return.",
    };
  }
}

export async function inspectReturnAction(
  _prevState: ReturnActionState,
  formData: FormData
): Promise<ReturnActionState> {
  try {
    assertNotCloudPortal("Inspect Return");
    const user = await requireDbUser();

    const returnId = formData.get("returnId") as string;
    const decisionsJson = formData.get("decisions") as string;
    const generalNotes = (formData.get("generalNotes") as string) || undefined;

    if (!returnId) {
      return { error: "Return ID is required." };
    }

    if (!decisionsJson) {
      return { error: "Inspection decisions payload is missing." };
    }

    let decisions: InspectItemDecision[] = [];
    try {
      decisions = JSON.parse(decisionsJson);
    } catch {
      return { error: "Invalid decisions payload format." };
    }

    const result = await inspectReturnTransaction(
      {
        returnId,
        decisions,
        generalNotes,
      },
      user.id
    );

    revalidatePath("/returns");
    revalidatePath(`/returns/${returnId}`);
    revalidatePath("/products");

    return {
      success: true,
      returnId: result.returnId,
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to process inspection.",
    };
  }
}
