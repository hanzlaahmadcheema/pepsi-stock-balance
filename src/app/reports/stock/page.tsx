import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getStockReport } from "@/lib/reports/service";
import { StockReportClient } from "./stock-report-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inventory Balance Report - Pepsi Stock Balance",
};

interface StockReportPageProps {
  searchParams: Promise<{
    search?: string;
    statusFilter?: "ALL" | "LOW_STOCK" | "OUT_OF_STOCK" | "IN_STOCK";
    page?: string;
  }>;
}

export default async function StockReportPage({ searchParams }: StockReportPageProps) {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const params = await searchParams;

  const page = parseInt(params.page || "1", 10);
  const data = await getStockReport(
    {
      search: params.search,
      statusFilter: params.statusFilter || "ALL",
      page,
      limit: 50,
    },
    isOwner
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <StockReportClient
          data={data}
          isOwner={isOwner}
          filters={{
            search: params.search || "",
            statusFilter: params.statusFilter || "ALL",
            page,
          }}
        />
      </main>
    </div>
  );
}
