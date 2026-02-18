"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { getGridClasses } from "@/lib/library/grid-utils"
import { useSettingsStore } from "@/lib/store/settings-store"

/**
 * Skeleton placeholder shown while the library data is loading.
 * @param viewMode - Current layout mode (grid or list).
 */
export function LoadingSkeleton({
  viewMode
}: {
  readonly viewMode: "grid" | "list"
}) {
  const cardSize = useSettingsStore((s) => s.cardSize)
  const items = Array.from({ length: 12 }, (_, i) => `skeleton-${i}`)

  if (viewMode === "grid") {
    return (
      <div className="animate-fade-in">
        <div className={getGridClasses(cardSize)}>
          {items.map((id) => (
            <div key={id} className="space-y-2 p-3">
              <Skeleton className="aspect-2/3 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      {items.map((id) => (
        <Skeleton key={id} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  )
}
