import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { getReceivingReport, parseDateFilter } from "@/lib/reports/service";
import { ReceivingReportClient } from "./receiving-report-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Receiving Report - Pepsi Stock Balance",
};

interface ReceivingReportPageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    supplierId?: string;
    productId?: string;
    page?: string;
  }>;
}

export default async function ReceivingReportPage({ searchParams }: ReceivingReportPageProps) {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const params = await searchParams;

  const { startStr, endStr } = parseDateFilter(params.startDate, params.endDate);
  const page = parseInt(params.page || "1", 10);

  const data = await getReceivingReport(
    {
      startDate: startStr,
      endDate: endStr,
      supplierId: params.supplierId || undefined,
      productId: params.productId || undefined,
      page,
      limit: 50,
    },
    isOwner
  );

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReceivingReportClient
          data={data}
          isOwner={isOwner}
          suppliers={suppliers}
          products={products}
          filters={{
            startDate: startStr,
            endDate: endStr,
            supplierId: params.supplierId,
            productId: params.productId,
            page,
          }}
        />
      </main>
    </div>
  );
}
