import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { listSuppliers } from "@/lib/suppliers/service";
import { SupplierListWrapper } from "./supplier-modal";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Suppliers - Pepsi Stock Balance",
  description: "Manage beverage bottling plants, distributors, and supplier sources",
};

export default async function SuppliersPage() {
  // 1. Require a signed-in user (OWNER or STAFF)
  const user = await requireDbUser();

  // 2. Fetch suppliers
  const suppliers = await listSuppliers(false);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader user={user} />

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <div className="space-y-6">
          <SupplierListWrapper suppliers={suppliers} />
        </div>
      </main>
    </div>
  );
}
