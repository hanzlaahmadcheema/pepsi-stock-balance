import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { getCustomerReport } from "@/lib/reports/service";
import { CustomersReportClient } from "./customers-report-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customer Credit Report - Pepsi Stock Balance",
};

interface CustomerReportPageProps {
  searchParams: Promise<{
    search?: string;
    onlyWithBalance?: string;
    page?: string;
  }>;
}

export default async function CustomerReportPage({ searchParams }: CustomerReportPageProps) {
  const user = await requireDbUser();
  const params = await searchParams;

  const page = parseInt(params.page || "1", 10);
  const data = await getCustomerReport({
    search: params.search,
    onlyWithBalance: params.onlyWithBalance === "true",
    page,
    limit: 50,
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CustomersReportClient
          data={data}
          filters={{
            search: params.search || "",
            onlyWithBalance: params.onlyWithBalance === "true",
            page,
          }}
        />
      </main>
    </div>
  );
}
