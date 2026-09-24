import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SaleStatus } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getSaleForReturn } from "@/lib/returns/service";
import { CreateReturnForm } from "./create-return-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Return - Pepsi Stock Balance",
};

interface NewReturnPageProps {
  searchParams: Promise<{
    invoiceNumber?: string;
    saleId?: string;
  }>;
}

export default async function NewReturnPage({ searchParams }: NewReturnPageProps) {
  const user = await requireDbUser();
  const { invoiceNumber, saleId } = await searchParams;

  const query = invoiceNumber || saleId;
  const initialSale = query ? await getSaleForReturn(query) : null;

  // Fetch recent completed sales for easy dropdown selection
  const recentSalesRaw = await prisma.sale.findMany({
    where: { status: SaleStatus.COMPLETED },
    orderBy: { soldAt: "desc" },
    take: 20,
    select: {
      id: true,
      invoiceNumber: true,
      soldAt: true,
      customer: { select: { name: true } },
    },
  });

  const recentSales = recentSalesRaw.map((s) => ({
    id: s.id,
    invoiceNumber: s.invoiceNumber,
    customerName: s.customer?.name || "Anonymous",
    soldAt: s.soldAt,
  }));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1">
            <Link href="/returns" className="hover:underline">
              ← Back to Returns
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Create Customer Return
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Record returned crates against the original sale. Returned goods will be quarantined pending inspection.
          </p>
        </div>

        <CreateReturnForm initialSale={initialSale} recentSales={recentSales} />
      </main>
    </div>
  );
}
