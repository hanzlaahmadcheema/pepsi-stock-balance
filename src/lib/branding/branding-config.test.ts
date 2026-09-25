import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BRANDING_CONFIG,
  sanitizeBrandingConfig,
  BrandingConfig,
} from "./branding-config";
import {
  getBrandingConfig,
  saveBrandingConfig,
  resetBrandingConfig,
} from "./branding-service";
import { DEVELOPER_CREDIT } from "@/components/ui/developer-credit";

describe("Application Branding & Developer Credit", () => {
  it("verifies developer credit points directly to Hanzla Ahmad WhatsApp", () => {
    assert.equal(DEVELOPER_CREDIT.name, "Hanzla Ahmad");
    assert.equal(DEVELOPER_CREDIT.whatsappUrl, "https://wa.me/923266900001");
    assert.equal(DEVELOPER_CREDIT.whatsappNumber, "+92 326 6900001");
    assert.equal(DEVELOPER_CREDIT.displayLabel, "Built by Hanzla Ahmad");
  });

  it("returns default branding when given null or empty object", () => {
    const fallback = sanitizeBrandingConfig(null);
    assert.equal(fallback.businessName, DEFAULT_BRANDING_CONFIG.businessName);
    assert.equal(fallback.tagline, DEFAULT_BRANDING_CONFIG.tagline);
    assert.equal(fallback.phone, DEFAULT_BRANDING_CONFIG.phone);
    assert.equal(fallback.email, DEFAULT_BRANDING_CONFIG.email);
  });

  it("preserves custom branding fields and trims inputs", () => {
    const custom: Partial<BrandingConfig> = {
      businessName: "  Punjab Beverage Wholesale Depot  ",
      phone: "0321-9988776",
      email: "depot@punjab-beverage.com",
      address: "Kot Lakhpat Industrial Area, Lahore",
      ntn: "1234567-8",
    };

    const sanitized = sanitizeBrandingConfig(custom);
    assert.equal(sanitized.businessName, "Punjab Beverage Wholesale Depot");
    assert.equal(sanitized.phone, "0321-9988776");
    assert.equal(sanitized.email, "depot@punjab-beverage.com");
    assert.equal(sanitized.address, "Kot Lakhpat Industrial Area, Lahore");
    assert.equal(sanitized.ntn, "1234567-8");
  });

  it("persists custom branding to file and resets cleanly", async () => {
    // 1. Save
    const saved = await saveBrandingConfig({
      businessName: "Test Depot Lahore",
      phone: "0300-9999999",
    });
    assert.equal(saved.businessName, "Test Depot Lahore");
    assert.equal(saved.phone, "0300-9999999");

    // 2. Fetch
    const retrieved = await getBrandingConfig();
    assert.equal(retrieved.businessName, "Test Depot Lahore");
    assert.equal(retrieved.phone, "0300-9999999");

    // 3. Reset
    const reset = await resetBrandingConfig();
    assert.equal(reset.businessName, DEFAULT_BRANDING_CONFIG.businessName);

    // 4. Verify fetch after reset
    const afterReset = await getBrandingConfig();
    assert.equal(afterReset.businessName, DEFAULT_BRANDING_CONFIG.businessName);
  });
});
