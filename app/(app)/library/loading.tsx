import { Skeleton } from "@/components/ui/skeleton"

export default function LibraryLoading() {
  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-10 grid items-end gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="mb-2 h-10 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="hidden lg:col-span-5 lg:flex lg:items-end lg:justify-end lg:gap-6">
          <Skeleton className="h-12 w-16" />
          <Skeleton className="h-8 w-px" />
          <Skeleton className="h-12 w-16" />
          <Skeleton className="h-8 w-px" />
          <Skeleton className="h-12 w-16" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 flex-1 rounded-xl sm:max-w-xs" />
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>

      <div className="my-8 border-t" />

      {/* Card grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
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
