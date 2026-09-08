"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { DamageType } from "@prisma/client";
import { recordDamage } from "@/lib/damage/service";

export type DamageActionState = {
  success?: boolean;
  error?: string;
  damageRecordId?: string;
} | null;

export async function recordDamageAction(
  _prevState: DamageActionState,
  formData: FormData
): Promise<DamageActionState> {
  try {
    const user = await requireDbUser();

    const productId = formData.get("productId") as string;
    const quantityRaw = formData.get("quantity") as string;
    const damageType = formData.get("damageType") as string;
    const reason = (formData.get("reason") as string) || undefined;
    const notes = (formData.get("notes") as string) || undefined;

    if (!productId) {
      return { error: "Product is required." };
    }

    const quantity = parseInt(quantityRaw, 10);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: "Quantity must be a positive whole number of crates." };
    }

    if (!damageType || !Object.values(DamageType).includes(damageType as DamageType)) {
      return { error: "A valid damage type is required." };
    }

    const result = await recordDamage({
      productId,
      quantity,
      damageType: damageType as DamageType,
      reason,
      notes,
      userId: user.id,
    });

    revalidatePath("/damage");
    revalidatePath("/products");
    revalidatePath("/reports/stock");

    return { success: true, damageRecordId: result.damageRecordId };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to record damage.",
    };
  }
}
