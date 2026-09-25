import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role, SaleStatus } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getSaleDetails } from "@/lib/sales/service";
import { listProducts, type StaffProductListItem } from "@/lib/products/service";
import { listCustomers } from "@/lib/customers/service";
import { getContainerSettings } from "@/lib/containers/settings-service";
import { EditSaleForm } from "./edit-sale-form";
import { isCloudPortal } from "@/lib/config/portal-mode";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EditSalePageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: EditSalePageProps) {
  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return {
      title: "Invoice Not Found - Pepsi Stock Balance",
    };
  }
  return {
    title: `Edit Invoice #${id.slice(0, 8)} - Pepsi Stock Balance`,
  };
}

export default async function EditSalePage({ params }: EditSalePageProps) {
  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    notFound();
  }

  if (isCloudPortal()) {
    redirect(`/sales/${id}`);
  }

  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  const sale = await getSaleDetails(id, isOwner);

  if (!sale) {
    notFound();
  }

  if (sale.status === SaleStatus.CANCELLED) {
    redirect(`/sales/${sale.id}`);
  }

  // Fetch active products with current stock
  const allProducts = await listProducts(undefined, false);
  const activeProducts = allProducts.filter((p) => p.isActive) as StaffProductListItem[];

  // Fetch active customers
  const allCustomers = await listCustomers();
  const activeCustomers = allCustomers.filter((c) => c.isActive);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1">
            <Link href={`/sales/${sale.id}`} className="hover:underline">
              ← Back to Invoice #{sale.invoiceNumber}
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Modify Invoice #{sale.invoiceNumber}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Edit products, quantities, customer, discount, or payment. All adjustments are recorded in the audit log.
          </p>
        </div>

        <EditSaleForm
          sale={sale}
          products={activeProducts}
          customers={activeCustomers}
          enabledRates={getContainerSettings().enabledRates}
        />
      </main>
    </div>
  );
}
