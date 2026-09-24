import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { listProducts, type StaffProductListItem } from "@/lib/products/service";
import { listCustomers } from "@/lib/customers/service";
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

  // 1. Fetch active products with current stock
  const allProducts = await listProducts(undefined, false);
  const activeProducts = allProducts.filter((p) => p.isActive) as StaffProductListItem[];

  // 2. Fetch active customers
  const allCustomers = await listCustomers();
  const activeCustomers = allCustomers.filter((c) => c.isActive);

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

        <CreateSaleForm
          products={activeProducts}
          customers={activeCustomers}
          initialCustomerId={customerId}
        />
      </main>
    </div>
  );
}
