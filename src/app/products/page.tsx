import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { listProducts, PriceTier } from "@/lib/products/service";
import { ProductSearch } from "./product-search";
import { EmptyState } from "@/components/ui/empty-state";
import { IconPackage } from "@/components/ui/icons";
import { ScrollableTable } from "@/components/ui/scrollable-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Products & Pricing - Pepsi Stock Balance",
  description: "View and manage distribution products, stock levels, and price tiers",
};

interface ProductsPageProps {
  searchParams: Promise<{
    q?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  const params = await searchParams;
  const searchQuery = params.q || "";

  // Query products with strict role-based data projection
  const products = await listProducts(searchQuery, isOwner);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader user={user} />

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <div className="space-y-6">
          {/* Header & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Products & Pricing</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Catalogue of beverages, current full-crate stock on hand, and active selling prices.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/receiving/new"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                + Receive Stock
              </Link>
              <Link
                href="/products/new"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
              >
                + Add Product
              </Link>
            </div>
          </div>

          {/* Search bar */}
          <div className="flex items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <ProductSearch defaultValue={searchQuery} />
            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Showing {products.length} {products.length === 1 ? "item" : "items"}
            </span>
          </div>

          {/* Product Listing: Mobile Cards + Desktop Table */}
          {products.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-8 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <EmptyState
                icon={<IconPackage className="w-8 h-8 text-zinc-400" />}
                title={searchQuery ? "No matching products found" : "No products added yet"}
                description={
                  searchQuery
                    ? `We couldn't find any products matching "${searchQuery}". Try adjusting your search query.`
                    : "Get started by adding beverage products, bottle configurations, and price tiers."
                }
                actionLabel={searchQuery ? undefined : "+ Add Product"}
                actionHref={searchQuery ? undefined : "/products/new"}
              />
            </div>
          ) : (
            <>
              {/* Mobile Product Cards (< sm screens) */}
              <div className="sm:hidden space-y-3">
                {products.map((product) => {
                  const retailPrice = product.activePrices.find((p) => p.tier === PriceTier.RETAIL)?.amount;
                  const isOutOfStock = product.currentStock <= 0;

                  return (
                    <div
                      key={product.id}
                      className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                            {product.name}
                          </h3>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {product.brand} {product.sku && `• SKU: ${product.sku}`}
                          </p>
                        </div>
                        <div>
                          {!product.isActive ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                              Inactive
                            </span>
                          ) : isOutOfStock ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300">
                              Out of Stock
                            </span>
                          ) : product.isLowStock ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              In Stock
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                        <div>
                          <span className="text-zinc-400 block text-[10px] uppercase font-bold">Available</span>
                          <span className={`text-base font-black tabular-nums ${isOutOfStock ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                            {product.currentStock} <span className="text-xs font-normal text-zinc-500">crates</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block text-[10px] uppercase font-bold">Retail Price</span>
                          <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                            {retailPrice ? `Rs. ${retailPrice}` : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 text-xs">
                        <Link
                          href="/receiving/new"
                          className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          + Receive More
                        </Link>
                        <Link
                          href={`/products/${product.id}`}
                          className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Manage & Prices →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (sm+ screens) */}
              <div className="hidden sm:block bg-white dark:bg-zinc-900 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <ScrollableTable>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-xs uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th scope="col" className="px-6 py-3">Product / Brand</th>
                        <th scope="col" className="px-6 py-3">Current Stock</th>
                        <th scope="col" className="px-6 py-3">Min. Alert</th>
                        <th scope="col" className="px-6 py-3">Active Prices (Rs.)</th>
                        {isOwner && <th scope="col" className="px-6 py-3">Cost Price</th>}
                        <th scope="col" className="px-6 py-3">Status</th>
                        <th scope="col" className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {products.map((product) => {
                        const retailPrice = product.activePrices.find((p) => p.tier === PriceTier.RETAIL)?.amount;
                        const wholesalePrice = product.activePrices.find((p) => p.tier === PriceTier.WHOLESALE)?.amount;
                        const keyAccountPrice = product.activePrices.find((p) => p.tier === PriceTier.KEY_ACCOUNT)?.amount;
                        const isOutOfStock = product.currentStock <= 0;

                        return (
                          <tr
                            key={product.id}
                            className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {product.name}
                              </div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {product.brand} {product.sku && `• SKU: ${product.sku}`}
                              </div>
                            </td>

                            {/* Current Stock */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className={`font-black text-base tabular-nums ${isOutOfStock ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                                  {product.currentStock}
                                </span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">crates</span>
                              </div>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap tabular-nums text-zinc-600 dark:text-zinc-400">
                              {product.minimumStockLevel} crates
                            </td>

                            {/* Active Selling Prices */}
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-0.5 text-xs">
                                <div>
                                  <span className="text-zinc-400">Retail:</span>{" "}
                                  <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                                    {retailPrice ? `Rs. ${retailPrice}` : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-400">Wholesale:</span>{" "}
                                  <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                                    {wholesalePrice ? `Rs. ${wholesalePrice}` : "—"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-400">Key Account:</span>{" "}
                                  <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                                    {keyAccountPrice ? `Rs. ${keyAccountPrice}` : "—"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Owner-only: Purchase Cost */}
                            {isOwner && (
                              <td className="px-6 py-4 whitespace-nowrap text-zinc-700 dark:text-zinc-300 font-medium tabular-nums">
                                Rs. {"latestPurchasePrice" in product ? product.latestPurchasePrice : "0.00"}
                              </td>
                            )}

                            {/* Stock Status Badge */}
                            <td className="px-6 py-4 whitespace-nowrap">
                              {!product.isActive ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                  Inactive
                                </span>
                              ) : isOutOfStock ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  Out of Stock
                                </span>
                              ) : product.isLowStock ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  In Stock
                                </span>
                              )}
                            </td>

                            {/* Details / Manage link */}
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <Link
                                href={`/products/${product.id}`}
                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                Manage & Prices →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollableTable>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
