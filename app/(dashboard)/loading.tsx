import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-10 max-w-[1600px] mx-auto pb-20 px-4 animate-in fade-in duration-500">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>

      {/* Health Cards Skeleton */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-6 flex justify-between items-center shadow-sm">
            <div className="space-y-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        ))}
      </section>

      {/* Summary Bar Skeleton */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-20" />
              </div>
            </div>
            <Skeleton className="h-5 w-5 rounded" />
          </div>
        ))}
      </section>

      {/* Charts Skeleton */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-xl p-6 h-[400px] shadow-sm flex flex-col gap-4">
           <Skeleton className="h-6 w-48" />
           <Skeleton className="flex-1 w-full" />
        </div>
        <div className="bg-card border border-border rounded-xl p-6 h-[400px] shadow-sm flex flex-col gap-4">
           <Skeleton className="h-6 w-32" />
           <div className="flex-1 flex items-center justify-center">
              <Skeleton className="h-64 w-64 rounded-full" />
           </div>
        </div>
      </section>

      {/* Operational Pulse Skeleton */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-6 h-[220px] shadow-sm flex flex-col gap-4">
            <Skeleton className="h-5 w-40" />
            <div className="space-y-6 pt-4">
              <div className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1 pt-1">
                  <Skeleton className="h-2 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1 pt-1">
                  <Skeleton className="h-2 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Performers & Activity Skeleton */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
           <div className="bg-card border border-border rounded-xl p-6 h-[500px] shadow-sm flex flex-col gap-6">
              <Skeleton className="h-6 w-48" />
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-2 w-1/2" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
           </div>
        </div>
        <div className="lg:col-span-7">
           <div className="bg-card border border-border rounded-xl p-6 h-[500px] shadow-sm flex flex-col gap-6">
              <Skeleton className="h-6 w-48" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="space-y-2 flex-1 pt-1">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
           </div>
        </div>
      </section>
    </div>
  );
}
