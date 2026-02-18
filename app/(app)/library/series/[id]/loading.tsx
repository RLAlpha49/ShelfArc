import { BreadcrumbsSkeleton } from "@/components/breadcrumbs"
import { Skeleton } from "@/components/ui/skeleton"

export default function SeriesDetailLoading() {
  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Breadcrumb */}
      <BreadcrumbsSkeleton segmentCount={2} />

      {/* Header section */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Cover */}
        <div className="lg:col-span-4">
          <Skeleton className="aspect-2/3 w-full rounded-2xl" />
        </div>

        {/* Info */}
        <div className="space-y-5 lg:col-span-8">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-24 w-full rounded-xl" />

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-none" />
            ))}
          </div>
        </div>
      </div>

      <div className="my-10 border-t" />

      {/* Volumes section */}
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-7 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2 p-3">
            <Skeleton className="aspect-2/3 w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
