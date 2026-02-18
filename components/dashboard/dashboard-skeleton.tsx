import { Skeleton } from "@/components/ui/skeleton"

/** Full dashboard skeleton shown while the data section streams in. @source */
export function DashboardSkeleton() {
  return (
    <>
      {/* Stats strip skeleton */}
      <section className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-card flex flex-col gap-2 p-5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-md" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </section>

      {/* Two-column content skeleton */}
      <section className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-48" />
              <div className="glass-card space-y-3 rounded-xl p-6">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-3/4" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-8 lg:col-span-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-28" />
              <div className="glass-card space-y-3 rounded-xl p-6">
                {i === 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                  </div>
                ) : (
                  <>
                    <Skeleton className="mx-auto h-24 w-24 rounded-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

/** Compact skeleton for an individual widget loading via React.lazy. @source */
export function WidgetSkeleton() {
  return (
    <div className="glass-card space-y-3 rounded-xl p-6">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}
