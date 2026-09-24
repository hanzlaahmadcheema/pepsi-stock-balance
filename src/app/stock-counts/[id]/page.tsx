import { notFound } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { getStockCountDetails } from "@/lib/stock-counts/service";
import { CountDetailsClient } from "./count-details-client";

export const dynamic = "force-dynamic";

interface StockCountDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: StockCountDetailsPageProps) {
  const { id } = await params;
  return {
    title: `Count Session #${id.slice(0, 8)} - Pepsi Stock Balance`,
  };
}

export default async function StockCountDetailsPage({ params }: StockCountDetailsPageProps) {
  const { id } = await params;
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  const countDetails = await getStockCountDetails(id);

  if (!countDetails) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        <CountDetailsClient countDetails={countDetails} isOwner={isOwner} />
      </main>
    </div>
  );
}
