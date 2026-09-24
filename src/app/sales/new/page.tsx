import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { listProducts, type StaffProductListItem } from "@/lib/products/service";
import { listCustomers } from "@/lib/customers/service";
import { getContainerSettings, getProductCrateConfig } from "@/lib/containers/settings-service";
import { getTodayBusinessDateString, getUnclosedPreviousDay } from "@/lib/daily-closing/service";
import { IconAlertTriangle } from "@/components/ui/icons";
import { CreateSaleForm } from "./create-sale-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Sale & Invoice - Pepsi Stock Balance",
};

interface NewSalePageProps {
  searchParams: Promise<{
    customerId?: string;
  }>;
}

export default async function NewSalePage({ searchParams }: NewSalePageProps) {
  const user = await requireDbUser();
  const { customerId } = await searchParams;

  // 1. Fetch active products with current stock and crate configuration
  const allProducts = await listProducts(undefined, false);
  const containerSettings = getContainerSettings();
  const activeProducts = (allProducts.filter((p) => p.isActive) as StaffProductListItem[]).map((p) => ({
    ...p,
    crateConfig: getProductCrateConfig({ id: p.id, name: p.name }),
  }));

  // 2. Fetch active customers
  const allCustomers = await listCustomers();
  const activeCustomers = allCustomers.filter((c) => c.isActive);

  // 3. Check if prior business day was unclosed
  const todayDateStr = getTodayBusinessDateString();
  const unclosedPrevious = await getUnclosedPreviousDay(todayDateStr);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1">
              <Link href="/sales" className="hover:underline">
                ← Back to Sales
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              New Sale / POS Invoice
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Record crate sales, validate on-hand inventory, and issue customer invoices.
            </p>
          </div>
        </div>

        {unclosedPrevious && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Attention: Previous day ({unclosedPrevious.dateStr}) daily closing is still {unclosedPrevious.status.replace("_", " ")}. Ensure previous operations are finalized.
              </span>
            </div>
            <Link
              href={unclosedPrevious.id ? `/daily-closing/${unclosedPrevious.id}` : "/daily-closing"}
              className="text-amber-700 dark:text-amber-300 underline font-bold hover:opacity-80 shrink-0"
            >
              Go to Closing →
            </Link>
          </div>
        )}

        <CreateSaleForm
          products={activeProducts}
          customers={activeCustomers}
          initialCustomerId={customerId}
          containerSettings={containerSettings}
        />
      </main>
    </div>
  );
}
