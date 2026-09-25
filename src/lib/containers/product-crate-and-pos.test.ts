import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  inferDefaultCrateConfig,
  setProductCrateConfig,
  getProductCrateConfig,
} from "./settings-service";

describe("Product Crate Configuration & POS Fixes", () => {
  test("inferDefaultCrateConfig defaults unknown products to non-returnable (hasGlassCrate: false)", () => {
    // Unknown or generic names should not be returnable crates by default
    const configUnknown = inferDefaultCrateConfig("Pepsi Standard");
    assert.strictEqual(configUnknown.hasGlassCrate, false);

    const configJuice = inferDefaultCrateConfig("Slice Mango 200ml");
    assert.strictEqual(configJuice.hasGlassCrate, false);

    const configCan = inferDefaultCrateConfig("Pepsi 330ml Can");
    assert.strictEqual(configCan.hasGlassCrate, false);

    const configPet = inferDefaultCrateConfig("Pepsi 1.5L PET");
    assert.strictEqual(configPet.hasGlassCrate, false);
  });

  test("inferDefaultCrateConfig recognizes RGB and glass keywords", () => {
    const configGlass = inferDefaultCrateConfig("Pepsi 250ml Glass Bottle");
    assert.strictEqual(configGlass.hasGlassCrate, true);
    assert.strictEqual(configGlass.bottlesPerCrate, 24);

    const configRgb = inferDefaultCrateConfig("7Up RGB Regular");
    assert.strictEqual(configRgb.hasGlassCrate, true);
  });

  test("setProductCrateConfig and getProductCrateConfig accurately store and retrieve false hasGlassCrate", () => {
    const testProdId = "test-prod-non-returnable-" + Date.now();
    setProductCrateConfig(testProdId, {
      hasGlassCrate: false,
      bottlesPerCrate: 24,
    });

    const retrieved = getProductCrateConfig({ id: testProdId, name: "Test Product" });
    assert.strictEqual(retrieved.hasGlassCrate, false);
    assert.strictEqual(retrieved.bottlesPerCrate, 24);

    // Update to true
    setProductCrateConfig(testProdId, {
      hasGlassCrate: true,
      bottlesPerCrate: 24,
    });
    const retrievedUpdated = getProductCrateConfig({ id: testProdId, name: "Test Product" });
    assert.strictEqual(retrievedUpdated.hasGlassCrate, true);
  });

  test("FormData checkbox boolean parsing rules", () => {
    // Simulating HTML form submissions
    // Case 1: Unchecked checkbox with hidden input fallback
    const formUnchecked = new Map<string, string>([
      ["crateConfigSubmitted", "1"],
      ["isReturnable", "false"],
    ]);
    const isReturnableRaw1 = formUnchecked.get("isReturnable") || null;
    const hasGlassCrateRaw1 = formUnchecked.get("hasGlassCrate") || null;
    const hasGlassCrate1 =
      isReturnableRaw1 === "true" ||
      isReturnableRaw1 === "on" ||
      hasGlassCrateRaw1 === "true" ||
      hasGlassCrateRaw1 === "on";
    assert.strictEqual(hasGlassCrate1, false);

    // Case 2: Standard uncontrolled unchecked checkbox (no field submitted)
    const formOmitted = new Map<string, string>();
    const isReturnableRaw2 = formOmitted.get("isReturnable") || null;
    const hasGlassCrateRaw2 = formOmitted.get("hasGlassCrate") || null;
    const hasGlassCrate2 =
      isReturnableRaw2 === "true" ||
      isReturnableRaw2 === "on" ||
      hasGlassCrateRaw2 === "true" ||
      hasGlassCrateRaw2 === "on";
    assert.strictEqual(hasGlassCrate2, false);

    // Case 3: Checked checkbox
    const formChecked = new Map<string, string>([
      ["crateConfigSubmitted", "1"],
      ["isReturnable", "true"],
    ]);
    const isReturnableRaw3 = formChecked.get("isReturnable") || null;
    const hasGlassCrateRaw3 = formChecked.get("hasGlassCrate") || null;
    const hasGlassCrate3 =
      isReturnableRaw3 === "true" ||
      isReturnableRaw3 === "on" ||
      hasGlassCrateRaw3 === "true" ||
      hasGlassCrateRaw3 === "on";
    assert.strictEqual(hasGlassCrate3, true);
  });

  test("M-Pesa option is eliminated from user-facing forms and views", () => {
    const editSaleForm = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/sales/[id]/edit/edit-sale-form.tsx"),
      "utf-8"
    );
    assert.doesNotMatch(editSaleForm, /<option[^>]*>MPESA<\/option>/i);

    const paymentForm = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/customers/[id]/payments/payment-form.tsx"),
      "utf-8"
    );
    assert.doesNotMatch(paymentForm, /<option[^>]*>MPESA<\/option>/i);

    const paymentsReport = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/reports/payments/payments-report-client.tsx"),
      "utf-8"
    );
    assert.doesNotMatch(paymentsReport, /<option[^>]*>M-Pesa<\/option>/i);

    const dashboardPage = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/page.tsx"),
      "utf-8"
    );
    assert.doesNotMatch(dashboardPage, /<span>M-Pesa<\/span>/i);

    const dailyClosingDetails = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/daily-closing/[id]/daily-closing-details-client.tsx"),
      "utf-8"
    );
    assert.doesNotMatch(dailyClosingDetails, /<span>M-Pesa:<\/span>/i);
  });

  test("Create sale form tracks lastHandledSaleId to allow ringing up next sale", () => {
    const createSaleForm = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/sales/new/create-sale-form.tsx"),
      "utf-8"
    );
    assert.match(createSaleForm, /lastHandledSaleId/);
    assert.match(createSaleForm, /state\.saleId !== lastHandledSaleId/);
  });
});
