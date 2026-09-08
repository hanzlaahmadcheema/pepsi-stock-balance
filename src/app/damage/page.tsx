import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { prisma } from "@/lib/prisma";
import { listDamageRecords } from "@/lib/damage/service";
import { DamageForm } from "./damage-form";
import { EmptyState } from "@/components/ui/empty-state";
import { IconAlertTriangle } from "@/components/ui/icons";
import { ScrollableTable } from "@/components/ui/scrollable-table";

export const dynamic = "force-dynamic";
export const metadata = { title: "Damage / Expiry Recording" };

export default async function DamagePage() {
  const user = await requireDbUser();

  const [activeProducts, { records, totalCratesDamaged, totalRecords }] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, brand: true },
      orderBy: { name: "asc" },
    }),
    listDamageRecords({ limit: 50 }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Damage / Expiry Recording
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              Record damaged or expired crates. Stock is reduced immediately.
            </p>
          </div>
          <div className="text-right text-sm text-zinc-500">
            <div className="font-semibold text-zinc-700 dark:text-zinc-300">
              {totalRecords} records total
            </div>
            <div>{totalCratesDamaged} crates damaged</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-1">
            <DamageForm products={activeProducts} />
          </div>

          {/* Recent records */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Recent Damage Records
                </h2>
              </div>
              <ScrollableTable>
                <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Crates</th>
                      <th className="px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12">
                          <EmptyState
                            icon={<IconAlertTriangle className="w-8 h-8 text-zinc-400" />}
                            title="No damage records found"
                            description="Use the form on the left to record damaged, broken, or expired crates from saleable inventory."
                          />
                        </td>
                      </tr>
                    ) : (
                      records.map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500">
                            {new Date(r.recordedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">
                              {r.productName}
                            </div>
                            <div className="text-xs text-zinc-400">{r.productBrand}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 font-semibold">
                              {r.damageType.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">
                            -{r.quantity}
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500">
                            {r.reason || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500">
                            {r.recordedByName}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </ScrollableTable>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
