import { requireDbUser } from "@/lib/auth";
import { Role, PriceTier } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getPriceReport } from "@/lib/reports/service";
import { PricesReportClient } from "./prices-report-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Price Tiers Report - Pepsi Stock Balance",
};

interface PriceReportPageProps {
  searchParams: Promise<{
    search?: string;
    tier?: string;
    includeHistory?: string;
  }>;
}

export default async function PriceReportPage({ searchParams }: PriceReportPageProps) {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const params = await searchParams;

  const validTier = Object.values(PriceTier).includes(params.tier as PriceTier)
    ? (params.tier as PriceTier)
    : undefined;

  const data = await getPriceReport(
    {
      search: params.search,
      tier: validTier,
      includeHistory: params.includeHistory === "true",
    },
    isOwner
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <PricesReportClient
          data={data}
          isOwner={isOwner}
          filters={{
            search: params.search || "",
            tier: validTier,
            includeHistory: params.includeHistory === "true",
          }}
        />
      </main>
    </div>
  );
}
