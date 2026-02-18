import { Skeleton } from "@/components/ui/skeleton"
import { BreadcrumbsSkeleton } from "@/components/breadcrumbs"

export default function VolumeDetailLoading() {
  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Breadcrumb */}
      <BreadcrumbsSkeleton segmentCount={3} />

      {/* Cover + Info */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Cover */}
        <div className="lg:col-span-4">
          <Skeleton className="aspect-2/3 w-full rounded-2xl" />
        </div>

        {/* Info */}
        <div className="space-y-4 lg:col-span-8">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-18 rounded-full" />
          </div>

          {/* Title */}
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/3" />

          {/* Stats strip */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-none" />
            ))}
          </div>

          {/* Details panel */}
          <Skeleton className="h-40 w-full rounded-2xl" />

          {/* Description */}
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
