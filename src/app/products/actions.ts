"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Role, PriceTier, Prisma } from "@prisma/client";
import { updateProductPriceTransaction } from "@/lib/products/service";

export type ProductFormState = {
  error?: string;
  success?: boolean;
  message?: string;
  productId?: string;
};

/**
 * Server action to create a new product along with optional initial prices.
 * Strictly enforces OWNER role server-side.
 */
export async function createProductAction(
  _prevState: ProductFormState | null,
  formData: FormData
): Promise<ProductFormState> {
  let ownerUser;
  try {
    ownerUser = await requireRole(Role.OWNER);
  } catch {
    return { error: "Unauthorized: Only an Owner can create new products." };
  }

  const name = (formData.get("name") as string)?.trim();
  const brand = (formData.get("brand") as string)?.trim();
  const sku = (formData.get("sku") as string)?.trim() || null;
  const minStockRaw = formData.get("minimumStockLevel") as string;
  const purchaseCostRaw = formData.get("latestPurchasePrice") as string;

  const retailRaw = formData.get("retailPrice") as string;
  const wholesaleRaw = formData.get("wholesalePrice") as string;
  const keyAccountRaw = formData.get("keyAccountPrice") as string;

  // Validation
  if (!name) {
    return { error: "Product name is required." };
  }

  if (!brand) {
    return { error: "Brand is required." };
  }

  const minimumStockLevel = parseInt(minStockRaw || "0", 10);
  if (isNaN(minimumStockLevel) || minimumStockLevel < 0) {
    return { error: "Minimum stock level must be a non-negative integer." };
  }

  const latestPurchasePrice = purchaseCostRaw ? parseFloat(purchaseCostRaw) : 0;
  if (isNaN(latestPurchasePrice) || latestPurchasePrice < 0) {
    return { error: "Purchase cost must be a non-negative number." };
  }

  // Check unique product name
  const existingName = await prisma.product.findUnique({
    where: { name },
  });

  if (existingName) {
    return { error: `A product with name "${name}" already exists.` };
  }

  if (sku) {
    const existingSku = await prisma.product.findUnique({
      where: { sku },
    });
    if (existingSku) {
      return { error: `A product with SKU "${sku}" already exists.` };
    }
  }

  // Parse optional initial prices
  const initialPrices: { tier: PriceTier; amount: number }[] = [];
  const validateTierPrice = (raw: string, tier: PriceTier, label: string) => {
    if (raw && raw.trim() !== "") {
      const parsed = parseFloat(raw);
      if (isNaN(parsed) || parsed < 0) {
        throw new Error(`${label} price must be a non-negative number.`);
      }
      initialPrices.push({ tier, amount: parsed });
    }
  };

  try {
    validateTierPrice(retailRaw, PriceTier.RETAIL, "Retail");
    validateTierPrice(wholesaleRaw, PriceTier.WHOLESALE, "Wholesale");
    validateTierPrice(keyAccountRaw, PriceTier.KEY_ACCOUNT, "Key Account");
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Invalid price entered." };
  }

  // Create product and initial prices atomically
  let createdProductId: string;
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const prod = await tx.product.create({
          data: {
            name,
            brand,
            sku,
            minimumStockLevel,
            latestPurchasePrice: new Prisma.Decimal(latestPurchasePrice.toFixed(2)),
            isActive: true,
          },
        });

        const now = new Date();
        if (initialPrices.length > 0) {
          await tx.price.createMany({
            data: initialPrices.map((pr) => ({
              productId: prod.id,
              tier: pr.tier,
              amount: new Prisma.Decimal(pr.amount.toFixed(2)),
              effectiveFrom: now,
              effectiveTo: null,
              createdById: ownerUser.id,
            })),
          });
        }

        return prod;
      },
      { maxWait: 5000, timeout: 15000 }
    );

    createdProductId = result.id;
  } catch (err) {
    console.error("Failed to create product:", err);
    return { error: "Database error while saving new product." };
  }

  revalidatePath("/products");
  redirect(`/products/${createdProductId}`);
}

/**
 * Server action to update basic product details (name, brand, sku, minimum stock, purchase cost).
 * Strictly enforces OWNER role server-side.
 */
export async function updateProductDetailsAction(
  _prevState: ProductFormState | null,
  formData: FormData
): Promise<ProductFormState> {
  try {
    await requireRole(Role.OWNER);
  } catch {
    return { error: "Unauthorized: Only an Owner can modify product details." };
  }

  const productId = formData.get("productId") as string;
  const name = (formData.get("name") as string)?.trim();
  const brand = (formData.get("brand") as string)?.trim();
  const sku = (formData.get("sku") as string)?.trim() || null;
  const minStockRaw = formData.get("minimumStockLevel") as string;
  const purchaseCostRaw = formData.get("latestPurchasePrice") as string;

  if (!productId) {
    return { error: "Missing product ID." };
  }

  if (!name) {
    return { error: "Product name is required." };
  }

  if (!brand) {
    return { error: "Brand is required." };
  }

  const minimumStockLevel = parseInt(minStockRaw || "0", 10);
  if (isNaN(minimumStockLevel) || minimumStockLevel < 0) {
    return { error: "Minimum stock level must be a non-negative integer." };
  }

  const latestPurchasePrice = purchaseCostRaw ? parseFloat(purchaseCostRaw) : 0;
  if (isNaN(latestPurchasePrice) || latestPurchasePrice < 0) {
    return { error: "Purchase cost must be a non-negative number." };
  }

  // Check for duplicate name in other products
  const duplicateName = await prisma.product.findFirst({
    where: {
      name,
      id: { not: productId },
    },
  });

  if (duplicateName) {
    return { error: `Another product already uses the name "${name}".` };
  }

  if (sku) {
    const duplicateSku = await prisma.product.findFirst({
      where: {
        sku,
        id: { not: productId },
      },
    });
    if (duplicateSku) {
      return { error: `Another product already uses the SKU "${sku}".` };
    }
  }

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        brand,
        sku,
        minimumStockLevel,
        latestPurchasePrice: new Prisma.Decimal(latestPurchasePrice.toFixed(2)),
      },
    });
  } catch (err) {
    console.error("Failed to update product details:", err);
    return { error: "Database error while updating product." };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { success: true, message: "Product details saved successfully." };
}

/**
 * Server action to toggle product active/inactive status.
 * Strictly enforces OWNER role server-side.
 */
export async function toggleProductStatusAction(
  productId: string
): Promise<{ error?: string; success?: boolean }> {
  try {
    await requireRole(Role.OWNER);
  } catch {
    return { error: "Unauthorized: Only an Owner can change product status." };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    return { error: "Product not found." };
  }

  const newStatus = !product.isActive;

  await prisma.product.update({
    where: { id: productId },
    data: { isActive: newStatus },
  });

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { success: true };
}

/**
 * Server action to update a product price tier atomically in a transaction.
 * Closes currently active price and inserts new active price, keeping full history.
 * Strictly enforces OWNER role server-side.
 */
export async function updateProductPriceAction(
  _prevState: ProductFormState | null,
  formData: FormData
): Promise<ProductFormState> {
  let ownerUser;
  try {
    ownerUser = await requireRole(Role.OWNER);
  } catch {
    return { error: "Unauthorized: Only an Owner can modify product prices." };
  }

  const productId = formData.get("productId") as string;
  const tierRaw = formData.get("tier") as string;
  const amountRaw = formData.get("amount") as string;

  if (!productId) {
    return { error: "Missing product ID." };
  }

  if (!tierRaw || !Object.values(PriceTier).includes(tierRaw as PriceTier)) {
    return { error: `Invalid price tier. Must be one of: ${Object.values(PriceTier).join(", ")}.` };
  }

  const tier = tierRaw as PriceTier;
  const amount = parseFloat(amountRaw);

  if (isNaN(amount) || amount < 0) {
    return { error: "Price amount must be a non-negative number." };
  }

  try {
    await updateProductPriceTransaction(productId, tier, amount, ownerUser.id);
  } catch (err) {
    console.error("Failed to update product price:", err);
    return { error: "Transaction error while saving price update." };
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return {
    success: true,
    message: `Active ${tier} price updated to Rs. ${amount.toFixed(2)}.`,
  };
}
