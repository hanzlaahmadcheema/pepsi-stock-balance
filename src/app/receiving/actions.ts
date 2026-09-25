"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireDbUser } from "@/lib/auth";
import { assertNotCloudPortal } from "@/lib/config/portal-mode";
import {
  createReceivingTransaction,
  postReceivingTransaction,
  deleteDraftReceiving,
} from "@/lib/receiving/service";

export type ReceivingActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  receivingId?: string;
};

/**
 * Server action to create a new receiving delivery.
 * Can be saved as DRAFT or POSTED immediately.
 */
export async function createReceivingAction(
  _prevState: ReceivingActionState | null,
  formData: FormData
): Promise<ReceivingActionState> {
  assertNotCloudPortal("Create Receiving");
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return { error: "Authentication required to record goods receiving." };
  }

  const supplierId = formData.get("supplierId") as string;
  const referenceNumber = (formData.get("referenceNumber") as string)?.trim() || null;
  const receivedAtRaw = formData.get("receivedAt") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const postImmediately = formData.get("postImmediately") === "true";
  const itemsJson = formData.get("items") as string;

  if (!supplierId) {
    return { error: "Supplier is required." };
  }

  // Verify supplier is active
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });

  if (!supplier || !supplier.isActive) {
    return { error: "Selected supplier is invalid or inactive." };
  }

  let items: { productId: string; quantity: number; purchasePrice: number }[] = [];
  try {
    items = JSON.parse(itemsJson || "[]");
  } catch {
    return { error: "Invalid line items payload." };
  }

  if (!items || items.length === 0) {
    return { error: "At least one product line item is required." };
  }

  // Validate items
  const productIds = items.map((i) => i.productId);
  const uniqueProductIds = new Set(productIds);
  if (uniqueProductIds.size !== productIds.length) {
    return { error: "Duplicate products found in line items. Please combine them into a single line." };
  }

  const activeProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, isActive: true },
  });

  const activeProductMap = new Map(activeProducts.map((p) => [p.id, p]));

  for (const item of items) {
    const prod = activeProductMap.get(item.productId);
    if (!prod) {
      return { error: `Product ID "${item.productId}" was not found.` };
    }
    if (!prod.isActive) {
      return { error: `Product "${prod.name}" is inactive. Inactive products cannot be received.` };
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return { error: `Crate quantity for "${prod.name}" must be a positive integer (full crates only).` };
    }

    if (isNaN(item.purchasePrice) || item.purchasePrice < 0) {
      return { error: `Purchase cost for "${prod.name}" must be a non-negative number.` };
    }
  }

  const receivedAt = receivedAtRaw ? new Date(receivedAtRaw) : new Date();

  let createdReceiving;
  try {
    createdReceiving = await createReceivingTransaction({
      supplierId,
      referenceNumber,
      receivedAt,
      notes,
      items,
      postImmediately,
      userId: user.id,
    });
  } catch (err: unknown) {
    console.error("Failed to create receiving:", err);
    return { error: err instanceof Error ? err.message : "Database error while saving receiving." };
  }

  revalidatePath("/receiving");
  revalidatePath("/products");
  redirect(`/receiving/${createdReceiving.id}`);
}

/**
 * Server action to post an existing draft receiving to the stock ledger.
 */
export async function postReceivingAction(
  receivingId: string
): Promise<{ error?: string; success?: boolean }> {
  assertNotCloudPortal("Post Receiving");
  let user;
  try {
    user = await requireDbUser();
  } catch {
    return { error: "Authentication required." };
  }

  try {
    await postReceivingTransaction(receivingId, user.id);
  } catch (err: unknown) {
    console.error("Failed to post receiving:", err);
    return { error: err instanceof Error ? err.message : "Failed to post receiving to stock ledger." };
  }

  revalidatePath("/receiving");
  revalidatePath(`/receiving/${receivingId}`);
  revalidatePath("/products");
  return { success: true };
}

/**
 * Server action to delete a draft receiving.
 * Strictly forbidden if receiving has already been posted to stock.
 */
export async function deleteReceivingAction(
  receivingId: string
): Promise<{ error?: string; success?: boolean }> {
  assertNotCloudPortal("Delete Receiving");
  try {
    await requireDbUser();
  } catch {
    return { error: "Authentication required." };
  }

  try {
    await deleteDraftReceiving(receivingId);
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete receiving." };
  }

  revalidatePath("/receiving");
  redirect("/receiving");
}
