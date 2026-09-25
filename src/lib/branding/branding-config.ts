/**
 * Global Application Branding Configuration Models & Defaults
 *
 * Allows users to customize business identity details across the application:
 * - App Header & Navigation
 * - Sales Invoices & Thermal Receipts
 * - Business Reports & Daily Closings
 */

export interface BrandingConfig {
  businessName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  ntn: string;
}

export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  businessName: "Pepsi Stock Balance",
  tagline: "Authorized Beverage Distribution Depot",
  phone: "0300-1234567",
  email: "info@pepsidepot.com",
  address: "Main Beverage Depot, Industrial Area, Lahore",
  ntn: "",
};

export const BRANDING_CONFIG_STORAGE_KEY = "pepsi_app_branding_config_v1";

export function sanitizeBrandingConfig(incoming?: unknown): BrandingConfig {
  if (!incoming || typeof incoming !== "object") {
    return { ...DEFAULT_BRANDING_CONFIG };
  }

  const raw = incoming as Partial<BrandingConfig>;

  return {
    businessName:
      typeof raw.businessName === "string" && raw.businessName.trim()
        ? raw.businessName.trim()
        : DEFAULT_BRANDING_CONFIG.businessName,
    tagline:
      typeof raw.tagline === "string"
        ? raw.tagline.trim()
        : DEFAULT_BRANDING_CONFIG.tagline,
    phone:
      typeof raw.phone === "string"
        ? raw.phone.trim()
        : DEFAULT_BRANDING_CONFIG.phone,
    email:
      typeof raw.email === "string"
        ? raw.email.trim()
        : DEFAULT_BRANDING_CONFIG.email,
    address:
      typeof raw.address === "string"
        ? raw.address.trim()
        : DEFAULT_BRANDING_CONFIG.address,
    ntn:
      typeof raw.ntn === "string"
        ? raw.ntn.trim()
        : DEFAULT_BRANDING_CONFIG.ntn,
  };
}

/**
 * Retrieve branding config from localStorage in browser context.
 */
export function getStoredBrandingConfig(): BrandingConfig {
  if (typeof window === "undefined") {
    return DEFAULT_BRANDING_CONFIG;
  }
  try {
    const raw = window.localStorage.getItem(BRANDING_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_BRANDING_CONFIG;
    return sanitizeBrandingConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_BRANDING_CONFIG;
  }
}

/**
 * Store branding config to localStorage and notify all active listeners.
 */
export function setStoredBrandingConfig(config: BrandingConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BRANDING_CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("app_branding_changed", { detail: config }));
  } catch (err) {
    console.error("Failed to save branding config to localStorage", err);
  }
}
