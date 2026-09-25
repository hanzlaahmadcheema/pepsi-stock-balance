"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDbUser } from "@/lib/auth";
import { assertNotCloudPortal } from "@/lib/config/portal-mode";

export type SupplierActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

/**
 * Server action to create a new supplier.
 * Any signed-in user (OWNER or STAFF) may manage suppliers.
 */
export async function createSupplierAction(
  _prevState: SupplierActionState | null,
  formData: FormData
): Promise<SupplierActionState> {
  assertNotCloudPortal("Create Supplier");
  try {
    await requireDbUser();
  } catch {
    return { error: "Unauthorized: You must be signed in to create suppliers." };
  }

  const name = (formData.get("name") as string)?.trim();
  const contactPerson = (formData.get("contactPerson") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;

  if (!name) {
    return { error: "Supplier name is required." };
  }

  try {
    await prisma.supplier.create({
      data: {
        name,
        contactPerson,
        phone,
        address,
        isActive: true,
      },
    });
  } catch (err) {
    console.error("Failed to create supplier:", err);
    return { error: "Database error while saving supplier." };
  }

  revalidatePath("/suppliers");
  revalidatePath("/receiving/new");
  return { success: true, message: `Supplier "${name}" created successfully.` };
}

/**
 * Server action to update an existing supplier.
 * Any signed-in user (OWNER or STAFF) may manage suppliers.
 */
export async function updateSupplierAction(
  _prevState: SupplierActionState | null,
  formData: FormData
): Promise<SupplierActionState> {
  assertNotCloudPortal("Update Supplier");
  try {
    await requireDbUser();
  } catch {
    return { error: "Unauthorized: You must be signed in to modify suppliers." };
  }

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const contactPerson = (formData.get("contactPerson") as string)?.trim() || null;
  const phone = (formData.get("phone") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;

  if (!id) {
    return { error: "Missing supplier ID." };
  }

  if (!name) {
    return { error: "Supplier name is required." };
  }

  try {
    await prisma.supplier.update({
      where: { id },
      data: {
        name,
        contactPerson,
        phone,
        address,
      },
    });
  } catch (err) {
    console.error("Failed to update supplier:", err);
    return { error: "Database error while updating supplier." };
  }

  revalidatePath("/suppliers");
  revalidatePath("/receiving/new");
  return { success: true, message: `Supplier "${name}" updated successfully.` };
}

/**
 * Server action to toggle a supplier's active status.
 * Any signed-in user (OWNER or STAFF) may manage suppliers.
 */
export async function toggleSupplierStatusAction(
  id: string
): Promise<{ error?: string; success?: boolean }> {
  assertNotCloudPortal("Toggle Supplier Status");
  try {
    await requireDbUser();
  } catch {
    return { error: "Unauthorized: You must be signed in to change supplier status." };
  }

  const supplier = await prisma.supplier.findUnique({
    where: { id },
  });

  if (!supplier) {
    return { error: "Supplier not found." };
  }

  await prisma.supplier.update({
    where: { id },
    data: { isActive: !supplier.isActive },
  });

  revalidatePath("/suppliers");
  revalidatePath("/receiving/new");
  return { success: true };
}
