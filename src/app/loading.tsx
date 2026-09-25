export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Top placeholder space to match the sticky top bar and the nav rail */}
      <div className="flex items-center justify-between gap-4 border-b-2 border-rule bg-surface px-4 py-2 sm:px-6 lg:pl-[7.5rem] lg:px-8">
        <div className="h-4 w-48 animate-pulse rounded bg-rule" />
        <div className="h-10 w-32 animate-pulse rounded-md border-2 border-rule bg-surface-alt" />
      </div>

      <main className="mx-auto w-full max-w-[1720px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Banner skeleton */}
        <div className="panel animate-pulse space-y-3 p-5">
          <div className="h-3 w-32 rounded bg-rule" />
          <div className="h-7 w-72 max-w-full rounded bg-rule" />
          <div className="h-4 w-96 max-w-full rounded bg-rule/60" />
        </div>

        {/* Stat card skeleton grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="panel animate-pulse space-y-3 p-4">
              <div className="h-3 w-24 rounded bg-rule" />
              <div className="num h-8 w-32 rounded bg-rule" />
              <div className="h-3 w-20 rounded bg-rule/60" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="panel animate-pulse overflow-hidden">
          <div className="flex items-center justify-between border-b-2 border-rule bg-surface-alt px-4 py-3">
            <div className="h-4 w-40 rounded bg-rule" />
            <div className="h-10 w-28 rounded-md border-2 border-rule bg-surface" />
          </div>
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4, 5].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-4 border-b border-rule/50 py-2 last:border-0"
              >
                <div className="h-4 w-32 rounded bg-rule" />
                <div className="h-4 w-24 rounded bg-rule" />
                <div className="h-4 w-20 rounded bg-rule" />
                <div className="h-6 w-20 rounded border-2 border-rule-strong" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
