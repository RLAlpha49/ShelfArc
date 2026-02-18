import { Skeleton } from "@/components/ui/skeleton"

export default function ActivityLoading() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 lg:px-10">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="mb-1 h-3 w-16" />
        <Skeleton className="mb-2 h-12 w-64" />
        <Skeleton className="h-5 w-56" />
      </div>

      {/* Filter */}
      <div className="mb-6">
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Timeline items */}
      <div className="divide-border divide-y">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
