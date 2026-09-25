import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { AppHeader } from "@/components/app-header";
import { prisma } from "@/lib/prisma";
import { ApprovalCard } from "./approval-card";
import { IconCheck } from "@/components/ui/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pending Approvals" };

export default async function ApprovalsPage() {
  const user = await requireDbUser();

  const pendingAdjustments = await prisma.stockAdjustment.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      product: { select: { name: true, brand: true } },
      requestedBy: { select: { name: true } },
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Pending Approvals
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Review and approve or reject stock adjustment requests.
            </p>
          </div>
          <div className="text-right">
            <div
              className={`text-3xl font-bold ${
                pendingAdjustments.length > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {pendingAdjustments.length}
            </div>
            <div className="text-xs text-zinc-500">pending</div>
          </div>
        </div>

        {pendingAdjustments.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
              <IconCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <h2 className="text-lg font-bold text-zinc-700 dark:text-zinc-300">
              All caught up!
            </h2>
            <p className="text-sm text-zinc-500 mt-1">No pending stock adjustments require your review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingAdjustments.map((adj) => (
              <ApprovalCard
                key={adj.id}
                adjustmentId={adj.id}
                productName={adj.product.name}
                productBrand={adj.product.brand}
                oldQuantity={adj.oldQuantity}
                newQuantity={adj.newQuantity}
                difference={adj.difference}
                reason={adj.reason}
                requestedByName={adj.requestedBy.name}
                createdAt={adj.createdAt}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
