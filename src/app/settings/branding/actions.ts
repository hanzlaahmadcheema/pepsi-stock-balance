"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { assertNotCloudPortal } from "@/lib/config/portal-mode";
import {
  saveBrandingConfig,
  resetBrandingConfig,
} from "@/lib/branding/branding-service";
import {
  BrandingConfig,
  sanitizeBrandingConfig,
} from "@/lib/branding/branding-config";
import {
  getReceiptDesignConfig,
  saveReceiptDesignConfig,
} from "@/lib/receipt/design-service";

export interface BrandingActionResponse {
  success: boolean;
  config?: BrandingConfig;
  error?: string;
}

/**
 * Save user customized business branding details.
 * Accessible to Staff and Owner.
 */
export async function saveBrandingAction(
  config: Partial<BrandingConfig>
): Promise<BrandingActionResponse> {
  try {
    assertNotCloudPortal("Customize Business Branding");
    await requireDbUser();

    const sanitized = sanitizeBrandingConfig(config);
    const saved = await saveBrandingConfig(sanitized);

    // Also synchronize to receipt design header so receipts automatically reflect branding
    try {
      const receiptConfig = await getReceiptDesignConfig();
      await saveReceiptDesignConfig({
        ...receiptConfig,
        header: {
          ...receiptConfig.header,
          businessName: saved.businessName,
          tagline: saved.tagline,
          phone: saved.phone,
          address: saved.address,
          taxNumber: saved.ntn,
        },
      });
    } catch (err) {
      console.warn("Could not auto-sync branding to receipt design:", err);
    }

    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/settings/branding");
    revalidatePath("/settings/invoice-design");
    revalidatePath("/sales");
    revalidatePath("/sales/receipt-preview");

    return { success: true, config: saved };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save branding.";
    return { success: false, error: message };
  }
}

/**
 * Reset application branding to defaults.
 */
export async function resetBrandingAction(): Promise<BrandingActionResponse> {
  try {
    assertNotCloudPortal("Reset Business Branding");
    await requireDbUser();

    const defaults = await resetBrandingConfig();

    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/settings/branding");
    revalidatePath("/settings/invoice-design");
    revalidatePath("/sales");

    return { success: true, config: defaults };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset branding.";
    return { success: false, error: message };
  }
}
