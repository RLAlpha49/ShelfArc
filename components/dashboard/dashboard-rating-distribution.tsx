"use client"

import { useMemo, useState } from "react"

import type { RatingDistributionPoint } from "@/lib/library/analytics"

interface DashboardRatingDistributionProps {
  readonly distribution: RatingDistributionPoint[]
  readonly unratedCount: number
}

interface TooltipState {
  visible: boolean
  rating: number
  count: number
  pct: string
}

export default function DashboardRatingDistribution({
  distribution,
  unratedCount
}: DashboardRatingDistributionProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    rating: 0,
    count: 0,
    pct: "0"
  })

  const totalRated = useMemo(
    () => distribution.reduce((sum, d) => sum + d.count, 0),
    [distribution]
  )

  const maxCount = useMemo(
    () => Math.max(...distribution.map((d) => d.count), 1),
    [distribution]
  )

  const visibleBars = useMemo(() => {
    const firstNonZero = distribution.findIndex((d) => d.count > 0)
    const lastNonZero = [...distribution]
      .reverse()
      .findIndex((d) => d.count > 0)
    if (firstNonZero === -1) return distribution
    const start = Math.max(0, firstNonZero - 1)
    const end = Math.min(10, 10 - lastNonZero + 1)
    return distribution.slice(start, end + 1)
  }, [distribution])

  if (totalRated === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center">
        <div className="text-primary bg-primary/10 mb-3 flex h-11 w-11 items-center justify-center rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">No ratings yet</p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          Rate your volumes to see a distribution here
        </p>
      </div>
    )
  }

  return (
    <div className="relative space-y-3">
      <ul className="space-y-1.5" aria-label="Rating distribution">
        {visibleBars.map((bar) => {
          const pctStr =
            totalRated > 0 ? ((bar.count / totalRated) * 100).toFixed(1) : "0.0"
          const widthPct = maxCount > 0 ? (bar.count / maxCount) * 100 : 0
          return (
            <li
              key={bar.rating}
              className="flex items-center gap-2"
              onMouseEnter={() =>
                setTooltip({
                  visible: true,
                  rating: bar.rating,
                  count: bar.count,
                  pct: pctStr
                })
              }
              onMouseLeave={() => setTooltip((p) => ({ ...p, visible: false }))}
            >
              <span className="text-muted-foreground w-5 shrink-0 text-right text-[11px] font-medium tabular-nums">
                {bar.rating}
              </span>

              <div
                className="bg-primary/8 relative h-4 flex-1 overflow-hidden rounded-sm"
                title={`Rating ${bar.rating}: ${bar.count} volume${bar.count === 1 ? "" : "s"} (${pctStr}%)`}
              >
                {bar.count > 0 && (
                  <div
                    className="h-full rounded-sm transition-all duration-500"
                    style={{
                      width: `${widthPct}%`,
                      background:
                        "linear-gradient(to right, var(--color-copper, #b87333), var(--color-primary, #6366f1))"
                    }}
                  />
                )}
              </div>

              <span
                className={`w-8 shrink-0 text-right text-[11px] tabular-nums ${bar.count > 0 ? "text-foreground font-medium" : "text-muted-foreground/40"}`}
              >
                {bar.count > 0 ? bar.count : "—"}
              </span>
            </li>
          )
        })}
      </ul>

      {tooltip.visible && (
        <div
          aria-live="polite"
          className="bg-card border-border pointer-events-none absolute top-0 right-0 z-10 rounded-md border px-2.5 py-1.5 shadow-md"
        >
          <p className="text-muted-foreground text-[10px]">
            Rating {tooltip.rating}
          </p>
          <p className="font-display text-xs font-semibold">
            {tooltip.count} volume{tooltip.count === 1 ? "" : "s"} (
            {tooltip.pct}%)
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-muted-foreground text-[11px]">
          {totalRated} rated volume{totalRated === 1 ? "" : "s"}
        </span>
        {unratedCount > 0 && (
          <span className="text-muted-foreground/60 text-[11px]">
            {unratedCount} unrated
          </span>
        )}
      </div>
    </div>
  )
}
