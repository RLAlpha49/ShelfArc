"use client"

import { useMemo } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import type { DashboardWidgetId } from "@/lib/store/settings-store"
import { DASHBOARD_WIDGETS, useSettingsStore } from "@/lib/store/settings-store"

/** Full dashboard skeleton shown while the data section streams in. @source */
export function DashboardSkeleton() {
  const layout = useSettingsStore((s) => s.dashboardLayout)

  const { showStats, fullExtras, leftCount, rightCount } = useMemo(() => {
    const isVisible = (id: DashboardWidgetId) => !layout.hidden.includes(id)
    const effectiveColumn = (id: DashboardWidgetId) =>
      layout.columns?.[id] ??
      DASHBOARD_WIDGETS.find((w) => w.id === id)?.column ??
      "left"

    let showStats = false
    let fullExtras = 0
    let leftCount = 0
    let rightCount = 0

    for (const id of layout.order) {
      if (!isVisible(id)) continue
      if (id === "stats") {
        showStats = true
        continue
      }
      const col = effectiveColumn(id)
      if (col === "full") fullExtras++
      else if (col === "left") leftCount++
      else rightCount++
    }

    return { showStats, fullExtras, leftCount, rightCount }
  }, [layout])

  return (
    <>
      {showStats && (
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
      )}

      {fullExtras > 0 && (
        <div className="mb-10 space-y-8">
          {Array.from({ length: fullExtras }, (_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-36" />
              <div className="glass-card space-y-3 rounded-xl p-6">
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {(leftCount > 0 || rightCount > 0) && (
        <section className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {leftCount > 0 && (
            <div className="space-y-8 lg:col-span-7">
              {Array.from({ length: leftCount }, (_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-5 w-36" />
                  <div className="glass-card space-y-3 rounded-xl p-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {rightCount > 0 && (
            <div className="space-y-8 lg:col-span-5">
              {Array.from({ length: rightCount }, (_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-5 w-28" />
                  <div className="glass-card space-y-3 rounded-xl p-6">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
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
