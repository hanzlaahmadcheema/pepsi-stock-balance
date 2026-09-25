import Link from "next/link";
import { redirect } from "next/navigation";
import { isCloudPortal } from "@/lib/config/portal-mode";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { listSuppliers } from "@/lib/suppliers/service";
import { CreateReceivingForm } from "./create-receiving-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Stock Receiving - Pepsi Stock Balance",
  description: "Record a new beverage delivery and update inventory",
};

export default async function NewReceivingPage() {
  if (isCloudPortal()) {
    redirect("/receiving");
  }
  const user = await requireDbUser();
  const isOwner = user.role === "OWNER";

  // 1. Fetch active suppliers
  const suppliers = await listSuppliers(true);

  // 2. Fetch active products
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      brand: true,
      latestPurchasePrice: true,
    },
  });

  const formattedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    latestPurchasePrice: p.latestPurchasePrice ? p.latestPurchasePrice.toString() : "0.00",
  }));

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader user={user} />

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/receiving" className="hover:underline">
              Receiving
            </Link>
            <span>/</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-medium">New Delivery</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Record Stock Receiving</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Log incoming full-crate deliveries from suppliers and post to the stock ledger.
            </p>
          </div>

          {suppliers.length === 0 ? (
            <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-amber-200 dark:border-amber-900 text-center space-y-3">
              <p className="text-amber-800 dark:text-amber-300 font-medium">
                No active suppliers found.
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Please create an active supplier before recording a delivery.
              </p>
              <Link
                href="/suppliers"
                className="inline-flex px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                Go to Suppliers &rarr;
              </Link>
            </div>
          ) : products.length === 0 ? (
            <div className="p-6 bg-white dark:bg-zinc-900 rounded-xl border border-amber-200 dark:border-amber-900 text-center space-y-3">
              <p className="text-amber-800 dark:text-amber-300 font-medium">
                No active products found.
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Please add active products to the catalogue before recording a delivery.
              </p>
              <Link
                href="/products/new"
                className="inline-flex px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                Create Product &rarr;
              </Link>
            </div>
          ) : (
            <CreateReceivingForm suppliers={suppliers} products={formattedProducts} />
          )}
        </div>
      </main>
    </div>
  );
}
