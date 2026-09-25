import fs from "fs";
import path from "path";
import {
  BrandingConfig,
  DEFAULT_BRANDING_CONFIG,
  sanitizeBrandingConfig,
} from "./branding-config";

const BRANDING_FILE_PATH = path.join(process.cwd(), "data", "branding-settings.json");

let cachedBranding: BrandingConfig | null = null;

function ensureDataDir(): void {
  const dir = path.dirname(BRANDING_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Fetch application branding settings from data/branding-settings.json.
 */
export async function getBrandingConfig(): Promise<BrandingConfig> {
  if (cachedBranding) {
    return cachedBranding;
  }

  try {
    ensureDataDir();
    if (!fs.existsSync(BRANDING_FILE_PATH)) {
      cachedBranding = { ...DEFAULT_BRANDING_CONFIG };
      return cachedBranding;
    }

    const content = fs.readFileSync(BRANDING_FILE_PATH, "utf-8");
    if (!content.trim()) {
      cachedBranding = { ...DEFAULT_BRANDING_CONFIG };
      return cachedBranding;
    }

    const parsed = JSON.parse(content);
    cachedBranding = sanitizeBrandingConfig(parsed);
    return cachedBranding;
  } catch (err) {
    console.error("[BrandingService] Error reading branding settings:", err);
    return { ...DEFAULT_BRANDING_CONFIG };
  }
}

/**
 * Persist application branding settings to data/branding-settings.json.
 */
export async function saveBrandingConfig(
  newConfig: Partial<BrandingConfig>
): Promise<BrandingConfig> {
  try {
    ensureDataDir();
    const sanitized = sanitizeBrandingConfig(newConfig);
    fs.writeFileSync(BRANDING_FILE_PATH, JSON.stringify(sanitized, null, 2), "utf-8");
    cachedBranding = sanitized;
    return sanitized;
  } catch (err) {
    console.error("[BrandingService] Error saving branding settings:", err);
    throw new Error("Failed to save branding settings to disk.");
  }
}

/**
 * Reset application branding settings to system defaults.
 */
export async function resetBrandingConfig(): Promise<BrandingConfig> {
  try {
    ensureDataDir();
    if (fs.existsSync(BRANDING_FILE_PATH)) {
      fs.unlinkSync(BRANDING_FILE_PATH);
    }
    cachedBranding = { ...DEFAULT_BRANDING_CONFIG };
    return cachedBranding;
  } catch (err) {
    console.error("[BrandingService] Error resetting branding settings:", err);
    cachedBranding = { ...DEFAULT_BRANDING_CONFIG };
    return cachedBranding;
  }
}
