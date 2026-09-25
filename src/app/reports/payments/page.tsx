import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { prisma } from "@/lib/prisma";
import { PaymentMethod } from "@prisma/client";
import { getPaymentReport, parseDateFilter } from "@/lib/reports/service";
import { PaymentsReportClient } from "./payments-report-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cash & Payment Collections Report - Pepsi Stock Balance",
};

interface PaymentReportPageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    type?: string;
    receivedById?: string;
    page?: string;
  }>;
}

export default async function PaymentReportPage({ searchParams }: PaymentReportPageProps) {
  const user = await requireDbUser();
  const params = await searchParams;

  const { startStr, endStr } = parseDateFilter(params.startDate, params.endDate);
  const page = parseInt(params.page || "1", 10);

  const data = await getPaymentReport({
    startDate: startStr,
    endDate: endStr,
    paymentMethod: params.paymentMethod as PaymentMethod | undefined,
    type: params.type as "all" | "counter" | "account" | undefined,
    receivedById: params.receivedById || undefined,
    page,
    limit: 50,
  });

  const staffUsers = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8">
        <PaymentsReportClient
          data={data}
          staffUsers={staffUsers}
          filters={{
            startDate: startStr,
            endDate: endStr,
            paymentMethod: params.paymentMethod || "",
            type: params.type || "all",
            receivedById: params.receivedById || "",
            page,
          }}
        />
      </main>
    </div>
  );
}
