export default function GlobalLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top placeholder space to match sticky header */}
      <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md flex items-center justify-between px-6 lg:pl-72 animate-pulse">
        <div className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
        <div className="h-7 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 lg:pl-72">
        {/* Banner Skeleton */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-xs border border-zinc-200 dark:border-zinc-800 animate-pulse space-y-3">
          <div className="h-4 w-32 bg-blue-100 dark:bg-blue-950/60 rounded-full" />
          <div className="h-8 w-72 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          <div className="h-4 w-96 max-w-full bg-zinc-200 dark:bg-zinc-800/60 rounded-md" />
        </div>

        {/* 4 Cards Skeleton Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="h-8 w-32 bg-zinc-300 dark:bg-zinc-700 rounded-lg" />
              <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>

        {/* Table / Content Skeleton */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden animate-pulse">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="h-5 w-40 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            <div className="h-8 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
          </div>
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
