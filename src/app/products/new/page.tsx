import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { CreateProductForm } from "./create-product-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Product - Pepsi Stock Balance",
  description: "Create a new beverage product in the distribution catalog",
};

export default async function NewProductPage() {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <AppHeader user={user} />

      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8">
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

          <CreateProductForm isOwner={isOwner} />
        </div>
      </main>
    </div>
  );
}
