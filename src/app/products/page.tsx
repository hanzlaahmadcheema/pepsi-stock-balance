import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { listProducts, PriceTier } from "@/lib/products/service";
import { getContainerSettings } from "@/lib/containers/settings-service";
import { ProductSearch } from "./product-search";
import { IconPackage, IconTruck, IconPlus, IconChartBar } from "@/components/ui/icons";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { EmptyState, StatusBadge } from "@/components/ui/classic";
import { isCloudPortal } from "@/lib/config/portal-mode";

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

/** One badge per product, using the shared status language. */
function stockBadge(product: {
  isActive: boolean;
  currentStock: number;
  isLowStock: boolean;
}) {
  if (!product.isActive) {
    return <StatusBadge tone="neutral">Not in use</StatusBadge>;
  }
  if (product.currentStock <= 0) {
    return <StatusBadge tone="bad">Out of stock</StatusBadge>;
  }
  if (product.isLowStock) {
    return <StatusBadge tone="warn">Low stock</StatusBadge>;
  }
  return <StatusBadge tone="good">In stock</StatusBadge>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const isCloud = isCloudPortal();

  const params = await searchParams;
  const searchQuery = params.q || "";

  const containerSettings = getContainerSettings();
  const enabledRates = containerSettings.enabledRates;

  // Query products with strict role-based data projection
  const products = await listProducts(searchQuery, isOwner);

  const totalCrates = products.reduce((sum, product) => sum + product.currentStock, 0);
  const outOfStockCount = products.filter((product) => product.isActive && product.currentStock <= 0).length;
  const lowStockCount = products.filter((product) => product.isActive && product.isLowStock && product.currentStock > 0).length;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader user={user} />

      <main className="mx-auto w-full max-w-[1720px] space-y-6 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
        {/* ---------------- Page heading ---------------- */}
        <div className="panel">
          <div className="flex flex-col gap-4 border-b-2 border-rule bg-surface-alt px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Products &amp; Prices</h1>
              <p className="mt-1 text-base text-ink-2">
                Every drink you sell, how many full crates are left, and what each one sells for.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link href="/reports/stock" className="btn">
                <IconChartBar className="h-5 w-5" />
                Stock Value Report
              </Link>
              {!isCloud ? (
                <>
                  <Link href="/receiving/new" className="btn btn-primary">
                    <IconTruck className="h-5 w-5" />
                    Receive Stock
                  </Link>
                  <Link href="/products/new" className="btn">
                    <IconPlus className="h-5 w-5" />
                    Add Product
                  </Link>
                </>
              ) : null}
            </div>
          </div>

          {/* Reading aid: the three numbers that matter before opening anything */}
          <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3">
            <div className="rounded-lg border-2 border-rule bg-surface-alt px-4 py-3">
              <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Products listed</p>
              <p className="num mt-1 text-2xl font-bold">{products.length}</p>
            </div>
            <div className="rounded-lg border-2 border-rule bg-surface-alt px-4 py-3">
              <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Crates in stock</p>
              <p className="num mt-1 text-2xl font-bold">{totalCrates}</p>
            </div>
            <div className="rounded-lg border-2 border-rule bg-surface-alt px-4 py-3">
              <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Need attention</p>
              <p className="num mt-1 text-2xl font-bold text-warn">{outOfStockCount + lowStockCount}</p>
              <p className="text-sm text-ink-3">
                {outOfStockCount} out of stock · {lowStockCount} running low
              </p>
            </div>
          </div>
        </div>

        {/* ---------------- Search ---------------- */}
        <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <ProductSearch defaultValue={searchQuery} />
          <p className="text-sm text-ink-2">
            Showing <strong className="num">{products.length}</strong>{" "}
            {products.length === 1 ? "product" : "products"}
            {searchQuery ? (
              <>
                {" "}
                for <strong>&ldquo;{searchQuery}&rdquo;</strong>
              </>
            ) : null}
          </p>
        </div>

        {/* ---------------- Product list ---------------- */}
        {products.length === 0 ? (
          <div className="panel p-6">
            <EmptyState
              title={searchQuery ? "No product matches that name" : "No products have been added yet"}
              hint={
                searchQuery
                  ? `Nothing in the catalog is called “${searchQuery}”. Check the spelling, or search by brand instead.`
                  : "Add your drinks one at a time with their crate size and selling price. Stock will start filling in as you record deliveries."
              }
              action={
                !searchQuery && !isCloud ? (
                  <Link href="/products/new" className="btn btn-primary">
                    <IconPlus className="h-5 w-5" />
                    Add the First Product
                  </Link>
                ) : searchQuery ? (
                  <Link href="/products" className="btn">
                    Show All Products
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Phones and tablets: one readable card per product */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
              {products.map((product) => {
                const retailPrice = product.activePrices.find((p) => p.tier === PriceTier.RETAIL)?.amount;
                const isOutOfStock = product.currentStock <= 0;

                return (
                  <div key={product.id} className="panel flex flex-col">
                    <div className="flex items-start justify-between gap-2 border-b-2 border-rule px-4 py-3">
                      <div>
                        <h3 className="text-lg font-bold leading-snug text-ink">{product.name}</h3>
                        <p className="text-sm text-ink-3">
                          {product.brand}
                          {product.sku ? ` · Code ${product.sku}` : ""}
                        </p>
                      </div>
                      {stockBadge(product)}
                    </div>

                    <div className="grid grid-cols-2 gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Crates available</p>
                        <p className={`num text-2xl font-bold ${isOutOfStock ? "text-stamp" : "text-ink"}`}>
                          {product.currentStock}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wider text-ink-3">Retail price</p>
                        <p className="num text-2xl font-bold text-ink">
                          {retailPrice ? `Rs. ${retailPrice}` : "Not set"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2 border-t-2 border-rule px-4 py-3">
                      <Link href={`/products/${product.id}`} className="btn btn-sm">
                        Open Prices
                      </Link>
                      {!isCloud ? (
                        <Link href="/receiving/new" className="btn btn-sm">
                          Receive More
                        </Link>
                      ) : null}
                      {isOutOfStock ? (
                        <span className="self-center text-sm font-bold text-stamp">Receive a delivery to sell this</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktops: the ledger row, the same numbers in a scannable table */}
            <div className="hidden lg:block">
              <div className="panel overflow-hidden">
              <ScrollableTable>
                <table className="ledger">
                  <caption className="sr-only">
                    Products, crate stock on hand, minimum alert level, active selling prices and status
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Product</th>
                      <th scope="col" className="num">
                        Crates On Hand
                      </th>
                      <th scope="col" className="num">
                        Alert Below
                      </th>
                      <th scope="col">Selling Prices</th>
                      {isOwner ? (
                        <th scope="col" className="num">
                          You Paid
                        </th>
                      ) : null}
                      <th scope="col">Status</th>
                      <th scope="col" className="num">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const retailPrice = product.activePrices.find((p) => p.tier === PriceTier.RETAIL)?.amount;
                      const wholesalePrice = product.activePrices.find((p) => p.tier === PriceTier.WHOLESALE)?.amount;
                      const keyAccountPrice = product.activePrices.find((p) => p.tier === PriceTier.KEY_ACCOUNT)?.amount;
                      const isOutOfStock = product.currentStock <= 0;

                      return (
                        <tr key={product.id}>
                          <td>
                            <strong className="text-base">{product.name}</strong>
                            <span className="block text-sm text-ink-3">
                              {product.brand}
                              {product.sku ? ` · Code ${product.sku}` : ""}
                            </span>
                          </td>

                          <td className={`num text-xl font-bold ${isOutOfStock ? "text-stamp" : "text-ink"}`}>
                            {product.currentStock}
                            <span className="ml-1 text-sm font-semibold text-ink-3">crates</span>
                          </td>

                          <td className="num text-ink-2">{product.minimumStockLevel}</td>

                          <td>
                            <div className="flex flex-col gap-0.5 text-sm">
                              {enabledRates.retail ? (
                                <span>
                                  <span className="text-ink-3">Retail </span>
                                  <strong className="num">{retailPrice ? `Rs. ${retailPrice}` : "not set"}</strong>
                                </span>
                              ) : null}
                              {enabledRates.wholesale ? (
                                <span>
                                  <span className="text-ink-3">Wholesale </span>
                                  <strong className="num">{wholesalePrice ? `Rs. ${wholesalePrice}` : "not set"}</strong>
                                </span>
                              ) : null}
                              {enabledRates.key ? (
                                <span>
                                  <span className="text-ink-3">Key account </span>
                                  <strong className="num">{keyAccountPrice ? `Rs. ${keyAccountPrice}` : "not set"}</strong>
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {isOwner ? (
                            <td className="num">
                              {"latestPurchasePrice" in product
                                ? `Rs. ${product.latestPurchasePrice}`
                                : "Not recorded"}
                            </td>
                          ) : null}

                          <td>{stockBadge(product)}</td>

                          <td className="num">
                            <Link href={`/products/${product.id}`} className="link-btn">
                              Open Prices
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollableTable>
              {!isCloud ? (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t-2 border-rule px-4 py-3">
                  <Link href="/products/new" className="btn btn-sm">
                    <IconPlus className="h-5 w-5" />
                    Add Product
                  </Link>
                  <Link href="/receiving/new" className="btn btn-sm">
                    <IconTruck className="h-5 w-5" />
                    Receive Stock
                  </Link>
                </div>
              ) : null}
              </div>
            </div>
          </>
        )}

        {products.length === 0 && !searchQuery && !isCloud ? (
          <p className="text-sm text-ink-3">
            <IconPackage className="mr-1 inline h-4 w-4" aria-hidden="true" />
            Every product you add appears in this list with its stock and prices.
          </p>
        ) : null}
      </main>
    </div>
  );
}
