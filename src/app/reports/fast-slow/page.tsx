import Link from "next/link";
import { requireDbUser } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { getFastSlowMovingReport } from "@/lib/reports/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fast / Slow Moving Products" };

const CLASSIFICATION_STYLE: Record<
  "FAST" | "SLOW" | "AVERAGE",
  { badge: string; label: string }
> = {
  FAST: {
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold",
    label: "FAST",
  },
  SLOW: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold",
    label: "SLOW",
  },
  AVERAGE: {
    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-bold",
    label: "AVERAGE",
  },
};

interface FastSlowPageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function FastSlowMovingPage({ searchParams }: FastSlowPageProps) {
  const user = await requireDbUser();
  const { startDate, endDate } = await searchParams;

  const data = await getFastSlowMovingReport({ startDate, endDate });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <AppHeader user={user} />

      <main className="max-w-[1720px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6 sm:py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm text-zinc-500">
          <Link href="/reports" className="hover:underline">
            ← Reports
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Fast / Slow Moving Products
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              {data.periodStart && data.periodEnd
                ? `Period: ${data.periodStart} → ${data.periodEnd}`
                : "Current month (default)"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/reports/export?report=fast-slow&format=csv${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`}
              className="px-3 py-2 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              ↓ CSV
            </a>
            <a
              href={`/api/reports/export?report=fast-slow&format=xlsx${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`}
              className="px-3 py-2 text-xs font-bold rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              ↓ XLSX
            </a>
          </div>
        </div>

        {/* Date filter form */}
        <form method="GET" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              defaultValue={startDate || ""}
              className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              End Date
            </label>
            <input
              type="date"
              name="endDate"
              defaultValue={endDate || ""}
              className="px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Apply Filter
          </button>
        </form>

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm text-center">
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
              Fast Moving
            </div>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {data.fastCount}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm text-center">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
              Average Velocity
            </div>
            <div className="text-3xl font-black text-zinc-700 dark:text-zinc-300">
              {data.averageCount}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm text-center">
            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
              Slow Moving
            </div>
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {data.slowCount}
            </div>
          </div>
        </div>

        {/* Report Table */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-bold text-zinc-900 dark:text-zinc-50">Product Classification</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Rule: crates sold &gt; average = FAST · crates sold = average = AVERAGE · crates sold &lt; average = SLOW
            </p>
          </div>

          {data.rows.length === 0 ? (
            <div className="px-6 py-12 text-center text-zinc-400">
              No completed sales data found for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3">Brand</th>
                    <th className="px-6 py-3 text-right">Crates Sold</th>
                    <th className="px-6 py-3 text-right">Period Average</th>
                    <th className="px-6 py-3 text-center">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {data.rows.map((row) => {
                    const style = CLASSIFICATION_STYLE[row.classification];
                    return (
                      <tr key={row.productId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                        <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                          {row.productName}
                        </td>
                        <td className="px-6 py-4 text-zinc-500">{row.productBrand}</td>
                        <td className="px-6 py-4 text-right font-bold text-zinc-900 dark:text-zinc-100">
                          {row.cratesSold}
                        </td>
                        <td className="px-6 py-4 text-right text-zinc-500">
                          {row.averageCratesSold.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full font-bold ${style.badge}`}
                          >
                            {style.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
