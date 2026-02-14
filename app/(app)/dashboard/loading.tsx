import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="dashboard-container mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <Skeleton className="mb-1 h-5 w-20" />
      <Skeleton className="mb-2 h-12 w-80" />
      <Skeleton className="mb-10 h-5 w-64" />

      <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-none" />
        ))}
      </div>

      <div className="mb-10 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-36 rounded-full" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <div className="space-y-8 lg:col-span-5">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
