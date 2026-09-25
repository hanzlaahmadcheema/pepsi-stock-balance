import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { prisma } from "@/lib/prisma";
import {
  getContainerSettings,
  getProductCrateConfig,
} from "@/lib/containers/settings-service";
import { CrateSettingsClient } from "./crates/crate-settings-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings - Pepsi Stock Balance",
  description: "Manage system display rates (Retail, Wholesale, Key), crate tracking, and container configurations.",
};

export default async function SettingsPage() {
  const user = await requireDbUser();

  const [products, settings] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, brand: true, sku: true },
      orderBy: [{ brand: "asc" }, { name: "asc" }],
    }),
    getContainerSettings(),
  ]);

  const productsWithCrates = products.map((p) => {
    const config = getProductCrateConfig(p);
    return {
      ...p,
      hasGlassCrate: config.hasGlassCrate,
      bottlesPerCrate: config.bottlesPerCrate,
    };
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        <CrateSettingsClient
          settings={settings}
          initialProducts={productsWithCrates}
        />
      </main>
    </div>
  );
}
