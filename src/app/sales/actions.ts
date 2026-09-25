"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { assertNotCloudPortal } from "@/lib/config/portal-mode";
import { SaleType, PaymentMethod, Role } from "@prisma/client";
import {
  createSaleTransaction,
  editSaleTransaction,
  cancelSaleTransaction,
  type SaleItemInput,
} from "@/lib/sales/service";

export type SaleActionState = {
  success?: boolean;
  error?: string;
  saleId?: string;
  invoiceNumber?: string;
} | null;

export async function createSaleAction(
  _prevState: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  try {
    assertNotCloudPortal("Create Sale");
    const user = await requireDbUser();

    const customerId = (formData.get("customerId") as string) || null;
    const saleType = (formData.get("saleType") as SaleType) || SaleType.RETAIL;
    const discountStr = (formData.get("discount") as string) || "0";
    const paymentMethod = (formData.get("paymentMethod") as PaymentMethod) || PaymentMethod.CASH;
    const paidAmountStr = (formData.get("paidAmount") as string) || "0";
    const itemsJson = formData.get("items") as string;
    const plasticCratesStr = (formData.get("plasticCrates") as string) || "0";
    const glassBottlesStr = (formData.get("glassBottles") as string) || "0";

    if (!itemsJson) {
      return { error: "Items payload is missing." };
    }

    let parsedItems: SaleItemInput[] = [];
    try {
      parsedItems = JSON.parse(itemsJson);
    } catch {
      return { error: "Invalid items payload format." };
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return { error: "At least one product item is required." };
    }

    const discount = parseFloat(discountStr) || 0;
    const paidAmount = parseFloat(paidAmountStr) || 0;
    const plasticCrates = Math.max(0, parseInt(plasticCratesStr, 10) || 0);
    const glassBottles = Math.max(0, parseInt(glassBottlesStr, 10) || 0);

    const result = await createSaleTransaction(
      {
        customerId: customerId ? customerId.trim() : null,
        saleType,
        items: parsedItems,
        discount,
        paymentMethod,
        paidAmount,
        containers:
          plasticCrates > 0 || glassBottles > 0
            ? { plasticCrates, glassBottles }
            : undefined,
      },
      user.id
    );

    revalidatePath("/sales");
    revalidatePath("/products");
    if (customerId) {
      revalidatePath(`/customers/${customerId}`);
    }

    return {
      success: true,
      saleId: result.saleId,
      invoiceNumber: result.invoiceNumber,
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to record sale.",
    };
  }
}

export async function editSaleAction(
  _prevState: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  try {
    assertNotCloudPortal("Edit Sale");
    const user = await requireDbUser();

    if (user.role !== Role.OWNER) {
      return { error: "Unauthorized: Only an Owner can modify an existing invoice." };
    }

    const saleId = formData.get("saleId") as string;
    const reason = formData.get("reason") as string;
    const customerId = (formData.get("customerId") as string) || null;
    const saleType = (formData.get("saleType") as SaleType) || SaleType.RETAIL;
    const discountStr = (formData.get("discount") as string) || "0";
    const paymentMethod = (formData.get("paymentMethod") as PaymentMethod) || PaymentMethod.CASH;
    const paidAmountStr = (formData.get("paidAmount") as string) || "0";
    const itemsJson = formData.get("items") as string;

    if (!saleId) {
      return { error: "Sale ID is required." };
    }

    if (!reason?.trim() || reason.trim().length < 3) {
      return { error: "A mandatory non-empty reason is required to edit an invoice." };
    }

    if (!itemsJson) {
      return { error: "Items payload is missing." };
    }

    let parsedItems: SaleItemInput[] = [];
    try {
      parsedItems = JSON.parse(itemsJson);
    } catch {
      return { error: "Invalid items payload format." };
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return { error: "At least one product item is required." };
    }

    const discount = parseFloat(discountStr) || 0;
    const paidAmount = parseFloat(paidAmountStr) || 0;

    const result = await editSaleTransaction(
      saleId,
      {
        reason: reason.trim(),
        customerId: customerId ? customerId.trim() : null,
        saleType,
        items: parsedItems,
        discount,
        paymentMethod,
        paidAmount,
      },
      user.id
    );

    revalidatePath("/sales");
    revalidatePath(`/sales/${saleId}`);
    revalidatePath("/products");
    if (customerId) {
      revalidatePath(`/customers/${customerId}`);
    }

    return {
      success: true,
      saleId: result.saleId,
      invoiceNumber: result.invoiceNumber,
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to edit invoice.",
    };
  }
}

export async function cancelSaleAction(
  _prevState: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  try {
    assertNotCloudPortal("Cancel Sale");
    const user = await requireDbUser();

    if (user.role !== Role.OWNER) {
      return { error: "Unauthorized: Only an Owner can cancel an invoice." };
    }

    const saleId = formData.get("saleId") as string;
    const reason = formData.get("reason") as string;

    if (!saleId) {
      return { error: "Sale ID is required." };
    }

    if (!reason?.trim() || reason.trim().length < 3) {
      return { error: "A mandatory non-empty reason is required to cancel an invoice." };
    }

    const result = await cancelSaleTransaction(saleId, reason.trim(), user.id);

    revalidatePath("/sales");
    revalidatePath(`/sales/${saleId}`);
    revalidatePath("/products");
    revalidatePath("/customers");

    return {
      success: true,
      saleId: result.saleId,
      invoiceNumber: result.invoiceNumber,
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to cancel invoice.",
    };
  }
}
