import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getSaleDetails } from "@/lib/sales/service";
import { InvoiceView } from "./invoice-view";
import { PrintOnLoad } from "./print-on-load";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SaleDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    print?: string;
    new?: string;
    completed?: string;
  }>;
}

export async function generateMetadata({ params }: SaleDetailsPageProps) {
  const { id } = await params;
  if (!id || !UUID_REGEX.test(id)) {
    return {
      title: "Invoice Not Found - Pepsi Stock Balance",
    };
  }
  return {
    title: `Invoice #${id.slice(0, 8)} - Pepsi Stock Balance`,
  };
}

export default async function SaleDetailsPage({ params, searchParams }: SaleDetailsPageProps) {
  const { id } = await params;
  const sp = await searchParams;

  if (!id || !UUID_REGEX.test(id)) {
    notFound();
  }

  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  const sale = await getSaleDetails(id, isOwner);

  if (!sale) {
    notFound();
  }

  const showConfirmation = sp.print === "1" || sp.new === "1" || sp.completed === "1";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <div className="print:hidden">
        <AppHeader user={user} />
      </div>

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6 print:p-0 print:m-0 print:max-w-none">
        {/* Post-sale confirmation prompt (when arriving from completed sale) */}
        {showConfirmation && <PrintOnLoad invoiceNumber={sale.invoiceNumber} />}

        <InvoiceView sale={sale} isOwner={isOwner} />
      </main>
    </div>
  );
}
