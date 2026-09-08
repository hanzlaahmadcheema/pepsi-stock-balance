import { requireDbUser } from "@/lib/auth";
import { Role, DamageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";
import { getDamageReport, parseDateFilter } from "@/lib/reports/service";
import { DamageReportClient } from "./damage-report-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Damage & Write-Off Report - Pepsi Stock Balance",
};

interface DamageReportPageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    productId?: string;
    damageType?: string;
    page?: string;
  }>;
}

export default async function DamageReportPage({ searchParams }: DamageReportPageProps) {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;
  const params = await searchParams;

  const { startStr, endStr } = parseDateFilter(params.startDate, params.endDate);
  const page = parseInt(params.page || "1", 10);
  const validDamageType = Object.values(DamageType).includes(params.damageType as DamageType)
    ? (params.damageType as DamageType)
    : undefined;

  const data = await getDamageReport(
    {
      startDate: startStr,
      endDate: endStr,
      productId: params.productId || undefined,
      damageType: validDamageType,
      page,
      limit: 50,
    },
    isOwner
  );

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DamageReportClient
          data={data}
          isOwner={isOwner}
          products={products}
          filters={{
            startDate: startStr,
            endDate: endStr,
            productId: params.productId,
            damageType: validDamageType,
            page,
          }}
        />
      </main>
    </div>
  );
}
