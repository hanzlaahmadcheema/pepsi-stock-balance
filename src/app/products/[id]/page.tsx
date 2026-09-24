import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role, PriceTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { getProductDetails } from "@/lib/products/service";
import { ProductStatusButton } from "./product-status-button";
import { EditProductForm } from "./edit-product-form";
import { UpdatePriceForm } from "./update-price-form";

export const dynamic = "force-dynamic";

interface ProductDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: ProductDetailsPageProps) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: `${product?.name || "Product Details"} - Pepsi Stock Balance`,
  };
}

export default async function ProductDetailsPage({ params }: ProductDetailsPageProps) {
  const { id } = await params;

  // 1. Authenticated user assertion
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  // 2. Query product with strict role projection
  const product = await getProductDetails(id, isOwner);

  if (!product) {
    notFound();
  }

  const retailPrice = product.activePrices.find((p) => p.tier === PriceTier.RETAIL)?.amount;
  const wholesalePrice = product.activePrices.find((p) => p.tier === PriceTier.WHOLESALE)?.amount;
  const keyAccountPrice = product.activePrices.find((p) => p.tier === PriceTier.KEY_ACCOUNT)?.amount;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader user={user} />

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <div className="space-y-8">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/products" className="hover:underline">
              Products
            </Link>
            <span>/</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-medium">{product.name}</span>
          </div>

          {/* Product Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    product.isActive
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      product.isActive ? "bg-emerald-500" : "bg-zinc-400"
                    }`}
                  />
                  {product.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Brand: <strong className="text-zinc-900 dark:text-zinc-100">{product.brand}</strong>
                {product.sku && (
                  <span className="ml-3">
                    SKU: <span className="font-mono">{product.sku}</span>
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <ProductStatusButton productId={product.id} isActive={product.isActive} />
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Current Stock */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Current Stock On Hand
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
                  {product.currentStock}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">crates</span>
              </div>
              <div className="mt-2">
                {product.isLowStock ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    ⚠ Below minimum threshold ({product.minimumStockLevel})
                  </span>
                ) : (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Healthy inventory level
                  </span>
                )}
              </div>
            </div>

            {/* Minimum Stock Alert Level */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Low-Stock Alert Level
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
                  {product.minimumStockLevel}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">crates</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                System highlights re-order warning when stock reaches this level.
              </p>
            </div>

            {/* Purchase Cost (OWNER ONLY) */}
            {isOwner && (
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                    Purchase Cost
                  </span>
                  <span className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold px-1.5 py-0.5 rounded">
                    OWNER
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-xs text-zinc-400">Rs.</span>
                  <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
                    {product.latestPurchasePrice ?? "0.00"}
                  </span>
                  <span className="text-xs text-zinc-400">/ crate</span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                  Confidential manual delivery cost per full crate.
                </p>
              </div>
            )}
          </div>

          {/* Active Selling Prices per Tier */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Current Selling Prices (Per Crate)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Retail */}
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50">
                <span className="text-xs uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider">
                  Retail Tier
                </span>
                <div className="text-2xl font-bold mt-1 text-zinc-900 dark:text-zinc-100">
                  {retailPrice ? `Rs. ${retailPrice}` : <span className="text-zinc-400 text-lg">Not Set</span>}
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
                  Anonymous sales & standard retail
                </span>
              </div>

              {/* Wholesale */}
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50">
                <span className="text-xs uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider">
                  Wholesale Tier
                </span>
                <div className="text-2xl font-bold mt-1 text-zinc-900 dark:text-zinc-100">
                  {wholesalePrice ? `Rs. ${wholesalePrice}` : <span className="text-zinc-400 text-lg">Not Set</span>}
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
                  Bulk retail shops & market distributors
                </span>
              </div>

              {/* Key Account */}
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50">
                <span className="text-xs uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider">
                  Key Account Tier
                </span>
                <div className="text-2xl font-bold mt-1 text-zinc-900 dark:text-zinc-100">
                  {keyAccountPrice ? `Rs. ${keyAccountPrice}` : <span className="text-zinc-400 text-lg">Not Set</span>}
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 block">
                  Institutional, hotels & contract clients
                </span>
              </div>
            </div>
          </div>

          {/* Product Management Sections (Staff & Owner) */}
          <div className="space-y-8">
            {/* Update Selling Price Form */}
            <UpdatePriceForm
              productId={product.id}
              activePrices={product.activePrices.map((p) => ({
                tier: p.tier,
                amount: p.amount,
              }))}
            />

            {/* Edit Product Information Form */}
            <EditProductForm
              productId={product.id}
              isOwner={isOwner}
              initialData={{
                name: product.name,
                brand: product.brand,
                sku: product.sku,
                minimumStockLevel: product.minimumStockLevel,
                latestPurchasePrice: product.latestPurchasePrice,
              }}
            />

              {/* Complete Historical Prices Ledger */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Complete Price History (Ledger)
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Immutable price records. Every price update closes the previous active rate and preserves historical pricing.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th scope="col" className="px-6 py-3">Tier</th>
                        <th scope="col" className="px-6 py-3">Selling Price</th>
                        <th scope="col" className="px-6 py-3">Effective From</th>
                        <th scope="col" className="px-6 py-3">Effective To / Status</th>
                        <th scope="col" className="px-6 py-3">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {product.priceHistory && product.priceHistory.length > 0 ? (
                        product.priceHistory.map((h) => {
                          const isActive = h.effectiveTo === null;
                          return (
                            <tr
                              key={h.id}
                              className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                            >
                              <td className="px-6 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                                {h.tier}
                              </td>
                              <td className="px-6 py-3 font-bold text-zinc-900 dark:text-zinc-50">
                                Rs. {h.amount}
                              </td>
                              <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400 text-xs">
                                {new Date(h.effectiveFrom).toLocaleString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="px-6 py-3">
                                {isActive ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    Currently Active
                                  </span>
                                ) : (
                                  <span className="text-zinc-500 dark:text-zinc-400 text-xs">
                                    Closed on{" "}
                                    {new Date(h.effectiveTo!).toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400 text-xs">
                                {h.createdByName}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-6 py-6 text-center text-zinc-500 dark:text-zinc-400"
                          >
                            No historical price records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
        </div>
      </main>
    </div>
  );
}
