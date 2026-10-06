export function LivePromoSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-11 w-36 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Filters skeleton */}
      <div className="flex flex-wrap gap-3">
        <div className="h-9 w-20 rounded-full bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
        <div className="h-9 w-28 rounded-full bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
        <div className="ml-auto h-9 w-48 rounded-lg bg-muted animate-pulse" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border-2 border-dashed border-muted bg-card p-5 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-8 w-32 rounded bg-muted animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
                  <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-10 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-10 w-24 rounded bg-muted animate-pulse" />
              <div className="h-3 w-full rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-28 rounded bg-muted animate-pulse" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="flex gap-2">
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
