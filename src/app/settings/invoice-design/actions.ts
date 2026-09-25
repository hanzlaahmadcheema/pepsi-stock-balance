"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth";
import { assertNotCloudPortal } from "@/lib/config/portal-mode";
import {
  saveReceiptDesignConfig,
  resetReceiptDesignConfig,
} from "@/lib/receipt/design-service";
import {
  ReceiptDesignConfig,
  DEFAULT_RECEIPT_CONFIG,
  sanitizeReceiptConfig,
} from "@/lib/receipt/design-config";

export interface ReceiptDesignActionResponse {
  success: boolean;
  config?: ReceiptDesignConfig;
  error?: string;
}

/**
 * Save user customized receipt design configuration.
 * Accessible to both Staff and Owner.
 */
export async function saveReceiptDesignAction(
  config: Partial<ReceiptDesignConfig>
): Promise<ReceiptDesignActionResponse> {
  try {
    assertNotCloudPortal("Customize Invoice Design");
    await requireDbUser();

    const sanitized = sanitizeReceiptConfig(config);
    const saved = await saveReceiptDesignConfig(sanitized);

    revalidatePath("/settings/invoice-design");
    revalidatePath("/sales");
    revalidatePath("/sales/receipt-preview");

    return { success: true, config: saved };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save invoice design.";
    return { success: false, error: message };
  }
}

/**
 * Reset receipt design to system defaults.
 */
export async function resetReceiptDesignAction(): Promise<ReceiptDesignActionResponse> {
  try {
    assertNotCloudPortal("Reset Invoice Design");
    await requireDbUser();

    const defaults = await resetReceiptDesignConfig();

    revalidatePath("/settings/invoice-design");
    revalidatePath("/sales");
    revalidatePath("/sales/receipt-preview");

    return { success: true, config: defaults };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset invoice design.";
    return { success: false, error: message };
  }
}
