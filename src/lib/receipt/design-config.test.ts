import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RECEIPT_CONFIG,
  sanitizeReceiptConfig,
  ReceiptDesignConfig,
} from "./design-config";
import {
  getReceiptDesignConfig,
  saveReceiptDesignConfig,
  resetReceiptDesignConfig,
} from "./design-service";

describe("Receipt Design Configuration & Sanitizer", () => {
  it("returns default config when input is empty or invalid", () => {
    const fallback = sanitizeReceiptConfig(null);
    assert.equal(fallback.header.businessName, DEFAULT_RECEIPT_CONFIG.header.businessName);
    assert.equal(fallback.sectionOrder.length, 8);
    assert.equal(fallback.styling.printableWidth, "76mm");
  });

  it("preserves customized fields while filling missing defaults", () => {
    const partial: Partial<ReceiptDesignConfig> = {
      header: {
        ...DEFAULT_RECEIPT_CONFIG.header,
        businessName: "CUSTOM DEPOT LAHORE",
        alignment: "left",
      },
      styling: {
        ...DEFAULT_RECEIPT_CONFIG.styling,
        fontFamily: "mono",
        baseFontSize: "large",
      },
    };

    const sanitized = sanitizeReceiptConfig(partial);
    assert.equal(sanitized.header.businessName, "CUSTOM DEPOT LAHORE");
    assert.equal(sanitized.header.alignment, "left");
    assert.equal(sanitized.styling.fontFamily, "mono");
    assert.equal(sanitized.styling.baseFontSize, "large");
    // Ensure untouched fields retain default
    assert.equal(sanitized.totals.totalLabel, "TOTAL");
    assert.equal(sanitized.sectionOrder.length, 8);
  });

  it("ensures all valid section IDs are included in sectionOrder even if user omitted some", () => {
    const partial = {
      sectionOrder: ["footer", "header"] as any,
    };
    const sanitized = sanitizeReceiptConfig(partial);
    assert.equal(sanitized.sectionOrder[0], "footer");
    assert.equal(sanitized.sectionOrder[1], "header");
    assert.equal(sanitized.sectionOrder.length, 8);
  });

  it("persists to file and resets successfully", async () => {
    // 1. Save custom config
    const custom = await saveReceiptDesignConfig({
      header: {
        ...DEFAULT_RECEIPT_CONFIG.header,
        businessName: "TEST PERSISTENCE DEPOT",
      },
    });
    assert.equal(custom.header.businessName, "TEST PERSISTENCE DEPOT");

    // 2. Fetch config
    const retrieved = await getReceiptDesignConfig();
    assert.equal(retrieved.header.businessName, "TEST PERSISTENCE DEPOT");

    // 3. Reset config
    const reset = await resetReceiptDesignConfig();
    assert.equal(reset.header.businessName, DEFAULT_RECEIPT_CONFIG.header.businessName);

    // 4. Verify fetch after reset
    const afterReset = await getReceiptDesignConfig();
    assert.equal(afterReset.header.businessName, DEFAULT_RECEIPT_CONFIG.header.businessName);
  });
});
