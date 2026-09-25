import Link from "next/link";
import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { listProducts, type StaffProductListItem } from "@/lib/products/service";
import { listCustomers } from "@/lib/customers/service";
import { getContainerSettings, getProductCrateConfig } from "@/lib/containers/settings-service";
import { getTodayBusinessDateString, getUnclosedPreviousDay } from "@/lib/daily-closing/service";
import { IconAlertTriangle } from "@/components/ui/icons";
import { CreateSaleForm } from "./create-sale-form";
import { isCloudPortal } from "@/lib/config/portal-mode";

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
  if (isCloudPortal()) {
    redirect("/sales");
  }

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
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <Link href="/sales" className="link-btn">
            ← Back to Sales
          </Link>
          <h1 className="text-3xl font-black text-ink mt-2">
            New Sale / POS Invoice
          </h1>
          <p className="text-[1.0625rem] text-ink-2 mt-1">
            Record crate sales, validate on-hand inventory, and issue customer invoices.
          </p>
        </div>

        {unclosedPrevious && (
          <div className="notice notice-warn">
            <IconAlertTriangle className="w-5 h-5 shrink-0 text-warn" />
            <span className="flex-1">
              Attention: Previous day ({unclosedPrevious.dateStr}) daily closing is still {unclosedPrevious.status.replace("_", " ")}. Ensure previous operations are finalized.
            </span>
            <Link
              href={unclosedPrevious.id ? `/daily-closing/${unclosedPrevious.id}` : "/daily-closing"}
              className="btn btn-warn btn-sm shrink-0"
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
