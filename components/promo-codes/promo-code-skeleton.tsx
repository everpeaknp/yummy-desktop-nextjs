export function PromoCodeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6 lg:p-8 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-5 w-96 bg-muted rounded" />
      </div>

      {/* Cards skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[400px] bg-muted rounded-xl" />
        <div className="h-[400px] bg-muted rounded-xl" />
      </div>

      {/* List skeleton */}
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
