import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { getAgingReport } from "@/lib/reports/service";
import { AgingReportClient } from "./aging-report-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customer Aging Report - Pepsi Stock Balance",
};

interface AgingReportPageProps {
  searchParams: Promise<{
    search?: string;
    hasBalanceOnly?: string;
    page?: string;
  }>;
}

export default async function AgingReportPage({ searchParams }: AgingReportPageProps) {
  const user = await requireDbUser();
  const params = await searchParams;

  const page = parseInt(params.page || "1", 10);
  const data = await getAgingReport({
    search: params.search,
    hasBalanceOnly: params.hasBalanceOnly === "false" ? false : true,
    page,
    limit: 50,
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <AgingReportClient
          data={data}
          filters={{
            search: params.search || "",
            hasBalanceOnly: params.hasBalanceOnly === "false" ? false : true,
            page,
          }}
        />
      </main>
    </div>
  );
}
