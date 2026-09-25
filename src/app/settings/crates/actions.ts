"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { assertNotCloudPortal } from "@/lib/config/portal-mode";
import { Role } from "@prisma/client";
import {
  updateContainerSettings,
  setProductCrateConfig,
  type ContainerSettings,
} from "@/lib/containers/settings-service";

export type CrateActionState = {
  success?: boolean;
  error?: string;
  message?: string;
} | null;

export async function updateContainerTypesAction(
  _prevState: CrateActionState,
  formData: FormData
): Promise<CrateActionState> {
  try {
    assertNotCloudPortal("Update Container Settings");
    await requireDbUser();

    const glassEnabled = formData.get("glassEnabled") === "true";
    const plasticEnabled = formData.get("plasticEnabled") === "true";
    const defaultBottles = Math.max(1, parseInt(formData.get("defaultBottles") as string, 10) || 24);

    const retailRate = formData.get("retailRate") === "true";
    const wholesaleRate = formData.get("wholesaleRate") === "true";
    const keyRate = formData.get("keyRate") === "true";

    if (!retailRate && !wholesaleRate && !keyRate) {
      return { error: "At least one display rate (Retail, Wholesale, or Key) must remain enabled." };
    }

    updateContainerSettings({
      enabledTypes: {
        glass: glassEnabled,
        plastic: plasticEnabled,
      },
      defaultBottlesPerCrate: defaultBottles,
      enabledRates: {
        retail: retailRate,
        wholesale: wholesaleRate,
        key: keyRate,
      },
    });

    revalidatePath("/settings");
    revalidatePath("/settings/crates");
    revalidatePath("/sales/new");
    revalidatePath("/products");
    revalidatePath("/products/new");
    revalidatePath("/customers");
    revalidatePath("/reports/prices");

    return {
      success: true,
      message: "Settings and display rates updated successfully!",
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to update container settings.",
    };
  }
}

export async function updateBulkProductCratesAction(
  _prevState: CrateActionState,
  formData: FormData
): Promise<CrateActionState> {
  try {
    assertNotCloudPortal("Update Product Crates");
    await requireDbUser();

    const configsJson = formData.get("configs") as string;
    if (!configsJson) {
      return { error: "No configurations submitted." };
    }

    let parsed: Record<string, { hasGlassCrate: boolean; bottlesPerCrate: number }> = {};
    try {
      parsed = JSON.parse(configsJson);
    } catch {
      return { error: "Invalid JSON format for product configs." };
    }

    for (const [productId, cfg] of Object.entries(parsed)) {
      setProductCrateConfig(productId, {
        hasGlassCrate: Boolean(cfg.hasGlassCrate),
        bottlesPerCrate: Math.max(1, parseInt(String(cfg.bottlesPerCrate), 10) || 24),
      });
    }

    revalidatePath("/settings/crates");
    revalidatePath("/sales/new");
    revalidatePath("/products");
    revalidatePath("/products/[id]");

    return {
      success: true,
      message: "Product returnable glass crate settings updated successfully!",
    };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Failed to save product crate configurations.",
    };
  }
}
