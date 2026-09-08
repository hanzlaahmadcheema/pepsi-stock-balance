"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser, requireRole } from "@/lib/auth";
import { Role, PriceTier, PaymentMethod } from "@prisma/client";
import {
  createCustomer,
  updateCustomer,
  setCustomerActive,
  recordAccountPayment,
} from "@/lib/customers/service";

export type ActionState = {
  success?: boolean;
  error?: string;
  customerId?: string;
} | null;

export async function createCustomerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireDbUser(); // Both OWNER and STAFF can create customers

    const name = formData.get("name") as string;
    const phone = (formData.get("phone") as string) || undefined;
    const address = (formData.get("address") as string) || undefined;
    const priceTier = (formData.get("priceTier") as PriceTier) || PriceTier.RETAIL;
    const creditAllowed = formData.get("creditAllowed") === "on" || formData.get("creditAllowed") === "true";

    if (!name?.trim()) {
      return { error: "Customer name is required." };
    }

    if (!Object.values(PriceTier).includes(priceTier)) {
      return { error: "Invalid price tier." };
    }

    const customer = await createCustomer({
      name,
      phone,
      address,
      priceTier,
      creditAllowed,
    });

    revalidatePath("/customers");
    revalidatePath("/sales/new");

    return { success: true, customerId: customer.id };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to create customer.",
    };
  }
}

export async function updateCustomerAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireRole(Role.OWNER); // Owner only

    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const phone = (formData.get("phone") as string) || undefined;
    const address = (formData.get("address") as string) || undefined;
    const priceTier = (formData.get("priceTier") as PriceTier) || PriceTier.RETAIL;
    const creditAllowed = formData.get("creditAllowed") === "on" || formData.get("creditAllowed") === "true";

    if (!id) {
      return { error: "Customer ID is required." };
    }

    if (!name?.trim()) {
      return { error: "Customer name is required." };
    }

    await updateCustomer(id, {
      name,
      phone,
      address,
      priceTier,
      creditAllowed,
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    revalidatePath("/sales/new");

    return { success: true, customerId: id };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to update customer.",
    };
  }
}

export async function toggleCustomerActiveAction(
  customerId: string,
  isActive: boolean
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireRole(Role.OWNER); // Owner only

    if (!customerId) {
      return { error: "Customer ID is required." };
    }

    await setCustomerActive(customerId, isActive);

    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/sales/new");

    return { success: true };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to toggle customer status.",
    };
  }
}

export async function recordAccountPaymentAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const user = await requireDbUser();

    const customerId = formData.get("customerId") as string;
    const amountStr = formData.get("amount") as string;
    const paymentMethod = (formData.get("paymentMethod") as PaymentMethod) || PaymentMethod.CASH;
    const referenceNumber = (formData.get("referenceNumber") as string) || undefined;

    if (!customerId) {
      return { error: "Customer ID is required." };
    }

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      return { error: "Payment amount must be greater than zero." };
    }

    if (!Object.values(PaymentMethod).includes(paymentMethod)) {
      return { error: "Invalid payment method." };
    }

    await recordAccountPayment({
      customerId,
      amount,
      paymentMethod,
      referenceNumber,
      userId: user.id,
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${customerId}`);
    revalidatePath(`/customers/${customerId}/payments`);

    return { success: true, customerId };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to record payment.",
    };
  }
}
