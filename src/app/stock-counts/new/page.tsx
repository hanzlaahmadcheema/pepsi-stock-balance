import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { listProducts, type StaffProductListItem } from "@/lib/products/service";
import { StockCountForm, type ProductStockItem } from "./stock-count-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Stock Count - Pepsi Stock Balance",
};

export default async function NewStockCountPage() {
  const user = await requireDbUser();

  // Fetch active products with current system stock
  const allProducts = await listProducts(undefined, false);
  const activeProducts = allProducts.filter((p) => p.isActive) as StaffProductListItem[];

  const productStockItems: ProductStockItem[] = activeProducts.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    systemStock: p.currentStock,
  }));

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1">
            <Link href="/stock-counts" className="hover:underline">
              ← Back to Stock Counts
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Record Physical Stock Count
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Enter physical crate counts to verify inventory against system stock.
          </p>
        </div>

        <StockCountForm products={productStockItems} defaultDate={todayStr} />
      </main>
    </div>
  );
}
