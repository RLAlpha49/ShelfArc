import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      <Skeleton className="mb-2 h-9 w-40 rounded-xl" />
      <Skeleton className="mb-10 h-5 w-64 rounded-lg" />

      <div className="grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-14">
        {/* Sidebar nav */}
        <div className="hidden lg:block">
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Content sections */}
        <div className="space-y-8">
          {/* Profile card */}
          <Skeleton className="h-64 rounded-2xl" />

          {/* Preferences card */}
          <Skeleton className="h-48 rounded-2xl" />

          {/* Appearance card */}
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
