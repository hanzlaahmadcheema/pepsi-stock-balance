import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import {
  listStockCountSessions,
  listPendingAdjustments,
} from "@/lib/stock-counts/service";
import { StockCountsClient } from "./stock-counts-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Stock Counts & Adjustments - Pepsi Stock Balance",
};

export default async function StockCountsPage() {
  const user = await requireDbUser();
  const isOwner = user.role === Role.OWNER;

  const sessions = await listStockCountSessions();
  const pendingAdjustments = await listPendingAdjustments();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        <StockCountsClient
          sessions={sessions}
          pendingAdjustments={pendingAdjustments}
          isOwner={isOwner}
        />
      </main>
    </div>
  );
}
