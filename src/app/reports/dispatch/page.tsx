import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { getDispatchReport, parseDateFilter } from "@/lib/reports/service";
import { DispatchReportClient } from "./dispatch-report-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dispatch Report - Pepsi Stock Balance",
};

interface DispatchReportPageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    productId?: string;
    customerId?: string;
    page?: string;
  }>;
}

export default async function DispatchReportPage({ searchParams }: DispatchReportPageProps) {
  const user = await requireDbUser();
  const params = await searchParams;

  const { startStr, endStr } = parseDateFilter(params.startDate, params.endDate);
  const page = parseInt(params.page || "1", 10);

  const data = await getDispatchReport({
    startDate: startStr,
    endDate: endStr,
    productId: params.productId || undefined,
    customerId: params.customerId || undefined,
    page,
    limit: 50,
  });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <DispatchReportClient
          data={data}
          products={products}
          customers={customers}
          filters={{
            startDate: startStr,
            endDate: endStr,
            productId: params.productId,
            customerId: params.customerId,
            page,
          }}
        />
      </main>
    </div>
  );
}
