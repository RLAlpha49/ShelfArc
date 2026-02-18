"use client"

import { useMemo, memo } from "react"
import type { SeriesWithVolumes } from "@/lib/types/database"

interface LibraryStatsBarProps {
  readonly series: SeriesWithVolumes[]
}

export const LibraryStatsBar = memo(function LibraryStatsBar({
  series
}: LibraryStatsBarProps) {
  const stats = useMemo(() => {
    const allVolumes = series.flatMap((s) => s.volumes)
    const totalVolumes = allVolumes.length
    const owned = allVolumes.filter(
      (v) => v.ownership_status === "owned"
    ).length
    const wishlist = allVolumes.filter(
      (v) => v.ownership_status === "wishlist"
    ).length
    const read = allVolumes.filter(
      (v) => v.reading_status === "completed"
    ).length
    const inProgress = allVolumes.filter(
      (v) => v.reading_status === "reading"
    ).length
    const completionRate =
      totalVolumes > 0 ? Math.round((read / totalVolumes) * 100) : 0
    return { totalVolumes, owned, wishlist, read, inProgress, completionRate }
  }, [series])

  if (series.length === 0) return null

  return (
    <div className="animate-fade-in-up stagger-2 mb-8">
      <div className="glass-card grid grid-cols-3 gap-2 rounded-2xl p-3 sm:grid-cols-4 md:grid-cols-7 md:gap-4 md:p-4">
        <div className="text-center">
          <div className="font-display text-primary text-lg font-bold md:text-xl">
            {series.length}
          </div>
          <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
            Series
          </div>
        </div>
        <div className="text-center">
          <div className="font-display text-primary text-lg font-bold md:text-xl">
            {stats.totalVolumes}
          </div>
          <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
            Volumes
          </div>
        </div>
        <div className="text-center">
          <div className="font-display text-primary text-lg font-bold md:text-xl">
            {stats.owned}
          </div>
          <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
            Owned
          </div>
        </div>
        <div className="text-center">
          <div className="font-display text-primary text-lg font-bold md:text-xl">
            {stats.read}
          </div>
          <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
            Read
          </div>
        </div>
        <div className="hidden text-center sm:block">
          <div className="font-display text-primary text-lg font-bold md:text-xl">
            {stats.inProgress}
          </div>
          <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
            In Progress
          </div>
        </div>
        <div className="hidden text-center md:block">
          <div className="font-display text-primary text-lg font-bold md:text-xl">
            {stats.wishlist}
          </div>
          <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
            Wishlist
          </div>
        </div>
        <div className="hidden text-center md:block">
          <div className="font-display text-copper text-lg font-bold md:text-xl">
            {stats.completionRate}%
          </div>
          <div className="text-muted-foreground text-[10px] tracking-widest uppercase md:text-xs">
            Complete
          </div>
        </div>
      </div>
    </div>
  )
})
