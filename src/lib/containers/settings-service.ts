import fs from "fs";
import path from "path";

export interface ProductCrateConfig {
  hasGlassCrate: boolean; // Whether this product uses returnable glass crates
  bottlesPerCrate: number; // Default 24 bottles per crate
}

export interface ContainerSettings {
  enabledTypes: {
    glass: boolean; // Active by default (we deal with only glass)
    plastic: boolean; // Disabled by default, preserved without permanent deletion
  };
  defaultBottlesPerCrate: number; // Default 24
  productConfigs: Record<string, ProductCrateConfig>;
}

const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "container-settings.json");

const DEFAULT_SETTINGS: ContainerSettings = {
  enabledTypes: {
    glass: true,
    plastic: false, // Disabled by default as requested: "we deals with only glass, don't delete plastic permanently just disable it"
  },
  defaultBottlesPerCrate: 24,
  productConfigs: {},
};

// In-memory cache
let cachedSettings: ContainerSettings | null = null;

function ensureDataDir() {
  const dir = path.dirname(SETTINGS_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Heuristic to detect if a product name indicates disposable / non-glass packaging.
 * (e.g., 1.5L PET, 2.25L, Cans, Disposable water).
 */
export function inferDefaultCrateConfig(productName: string): ProductCrateConfig {
  const lower = productName.toLowerCase();

  // If clearly non-returnable PET or Can packaging:
  if (
    lower.includes("can") ||
    lower.includes("tin") ||
    lower.includes("pet") ||
    lower.includes("1.5") ||
    lower.includes("1500") ||
    lower.includes("2.25") ||
    lower.includes("2000") ||
    lower.includes("500ml") ||
    lower.includes("1000ml") ||
    lower.includes("tetra") ||
    lower.includes("aquafina") ||
    lower.includes("water") ||
    lower.includes("disposable")
  ) {
    return {
      hasGlassCrate: false,
      bottlesPerCrate: 24,
    };
  }

  // Small glass bottles (250ml, 300ml, 240ml, RGB):
  if (
    lower.includes("glass") ||
    lower.includes("rgb") ||
    lower.includes("250ml") ||
    lower.includes("300ml") ||
    lower.includes("240ml") ||
    lower.includes("regular")
  ) {
    return {
      hasGlassCrate: true,
      bottlesPerCrate: 24,
    };
  }

  // Default to glass crate with 24 bottles
  return {
    hasGlassCrate: true,
    bottlesPerCrate: 24,
  };
}

export function getContainerSettings(): ContainerSettings {
  if (cachedSettings) {
    return cachedSettings;
  }

  ensureDataDir();

  if (!fs.existsSync(SETTINGS_FILE_PATH)) {
    cachedSettings = { ...DEFAULT_SETTINGS };
    try {
      fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
    } catch {}
    return cachedSettings;
  }

  try {
    const raw = fs.readFileSync(SETTINGS_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    cachedSettings = {
      enabledTypes: {
        glass: parsed.enabledTypes?.glass ?? true,
        plastic: parsed.enabledTypes?.plastic ?? false,
      },
      defaultBottlesPerCrate: parsed.defaultBottlesPerCrate ?? 24,
      productConfigs: parsed.productConfigs || {},
    };
    return cachedSettings;
  } catch {
    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
  }
}

export function updateContainerSettings(partial: Partial<ContainerSettings>): ContainerSettings {
  const current = getContainerSettings();
  const updated: ContainerSettings = {
    ...current,
    ...partial,
    enabledTypes: {
      ...current.enabledTypes,
      ...(partial.enabledTypes || {}),
    },
    productConfigs: {
      ...current.productConfigs,
      ...(partial.productConfigs || {}),
    },
  };

  ensureDataDir();
  try {
    fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(updated, null, 2), "utf-8");
    cachedSettings = updated;
  } catch (err) {
    console.error("Failed to persist container-settings.json:", err);
  }

  return updated;
}

export function getProductCrateConfig(product: { id?: string; name: string }): ProductCrateConfig {
  const settings = getContainerSettings();

  // Check by ID first
  if (product.id && settings.productConfigs[product.id]) {
    return settings.productConfigs[product.id];
  }

  // Check by Name
  if (product.name && settings.productConfigs[product.name]) {
    return settings.productConfigs[product.name];
  }

  // Fallback to heuristic inference
  return inferDefaultCrateConfig(product.name);
}

export function setProductCrateConfig(
  identifier: string,
  config: ProductCrateConfig
): ContainerSettings {
  const current = getContainerSettings();
  const nextConfigs = {
    ...current.productConfigs,
    [identifier]: {
      hasGlassCrate: Boolean(config.hasGlassCrate),
      bottlesPerCrate: Math.max(1, parseInt(String(config.bottlesPerCrate), 10) || 24),
    },
  };

  return updateContainerSettings({ productConfigs: nextConfigs });
}
