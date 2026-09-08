import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { CreateProductForm } from "./create-product-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Product - Pepsi Stock Balance",
  description: "Create a new beverage product in the distribution catalog",
};

export default async function NewProductPage() {
  // 1. Strictly enforce OWNER role server-side
  const user = await requireRole(Role.OWNER);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader user={user} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Link href="/products" className="hover:underline">
              Products
            </Link>
            <span>/</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-medium">New Product</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add New Product</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Define the item, initial cost, low-stock threshold, and selling prices per tier.
            </p>
          </div>

          <CreateProductForm />
        </div>
      </main>
    </div>
  );
}
