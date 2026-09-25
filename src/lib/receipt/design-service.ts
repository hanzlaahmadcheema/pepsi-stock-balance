import fs from "fs";
import path from "path";
import {
  ReceiptDesignConfig,
  DEFAULT_RECEIPT_CONFIG,
  sanitizeReceiptConfig,
} from "./design-config";

const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "receipt-settings.json");

// In-memory cache for fast read access
let cachedConfig: ReceiptDesignConfig | null = null;

function ensureDataDir(): void {
  const dir = path.dirname(SETTINGS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Retrieve saved receipt design configuration from data/receipt-settings.json.
 * Falls back to DEFAULT_RECEIPT_CONFIG if file is missing or invalid.
 */
export async function getReceiptDesignConfig(): Promise<ReceiptDesignConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    ensureDataDir();
    if (!fs.existsSync(SETTINGS_FILE_PATH)) {
      cachedConfig = { ...DEFAULT_RECEIPT_CONFIG };
      return cachedConfig;
    }

    const content = fs.readFileSync(SETTINGS_FILE_PATH, "utf-8");
    if (!content.trim()) {
      cachedConfig = { ...DEFAULT_RECEIPT_CONFIG };
      return cachedConfig;
    }

    const parsed = JSON.parse(content);
    cachedConfig = sanitizeReceiptConfig(parsed);
    return cachedConfig;
  } catch (err) {
    console.error("[ReceiptDesignService] Error reading receipt settings:", err);
    return { ...DEFAULT_RECEIPT_CONFIG };
  }
}

/**
 * Persist custom receipt design configuration to data/receipt-settings.json.
 */
export async function saveReceiptDesignConfig(
  newConfig: Partial<ReceiptDesignConfig>
): Promise<ReceiptDesignConfig> {
  try {
    ensureDataDir();
    const sanitized = sanitizeReceiptConfig(newConfig);
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(sanitized, null, 2), "utf-8");
    cachedConfig = sanitized;
    return sanitized;
  } catch (err) {
    console.error("[ReceiptDesignService] Error saving receipt settings:", err);
    throw new Error("Failed to save receipt design settings to disk.");
  }
}

/**
 * Reset receipt design settings to system factory defaults.
 */
export async function resetReceiptDesignConfig(): Promise<ReceiptDesignConfig> {
  try {
    ensureDataDir();
    if (fs.existsSync(SETTINGS_FILE_PATH)) {
      fs.unlinkSync(SETTINGS_FILE_PATH);
    }
    cachedConfig = { ...DEFAULT_RECEIPT_CONFIG };
    return cachedConfig;
  } catch (err) {
    console.error("[ReceiptDesignService] Error resetting receipt settings:", err);
    cachedConfig = { ...DEFAULT_RECEIPT_CONFIG };
    return cachedConfig;
  }
}
