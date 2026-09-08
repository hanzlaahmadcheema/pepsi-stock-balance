import { requireDbUser } from "@/lib/auth";
import { Role, SaleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { getSalesReport, parseDateFilter } from "@/lib/reports/service";
import { SalesReportClient } from "./sales-report-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sales Report - Pepsi Stock Balance",
};

interface SalesReportPageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    customerId?: string;
    saleType?: string;
    page?: string;
  }>;
}

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const params = await searchParams;

  const { startStr, endStr } = parseDateFilter(params.startDate, params.endDate);
  const page = parseInt(params.page || "1", 10);
  const validSaleType = Object.values(SaleType).includes(params.saleType as SaleType)
    ? (params.saleType as SaleType)
    : undefined;

  const data = await getSalesReport(
    {
      startDate: startStr,
      endDate: endStr,
      customerId: params.customerId || undefined,
      saleType: validSaleType,
      page,
      limit: 50,
    },
    isOwner
  );

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SalesReportClient
          data={data}
          isOwner={isOwner}
          customers={customers}
          filters={{
            startDate: startStr,
            endDate: endStr,
            customerId: params.customerId,
            saleType: validSaleType,
            page,
          }}
        />
      </main>
    </div>
  );
}
