"use client"

import Link from "next/link"

import type { PriceBreakdown } from "@/lib/library/analytics"

interface DashboardPriceTrackingProps {
  readonly priceBreakdown: PriceBreakdown
  readonly ownedVolumes: number
  readonly priceFormatter: Intl.NumberFormat
}

export default function DashboardPriceTracking({
  priceBreakdown,
  ownedVolumes,
  priceFormatter
}: DashboardPriceTrackingProps) {
  if (priceBreakdown.trackedCount === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center">
        <div className="text-gold bg-gold/10 mb-3 flex h-11 w-11 items-center justify-center rounded-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-5 w-5"
          >
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">No prices tracked yet</p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          Add purchase prices to volumes to see insights
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Category split */}
      <div className="grid grid-cols-2 gap-2">
        <div className="from-primary/12 to-primary/4 rounded-lg border bg-linear-to-br p-3">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Light Novels
          </span>
          <div className="text-primary font-display mt-0.5 text-lg font-bold">
            {priceFormatter.format(priceBreakdown.lnSpent)}
          </div>
        </div>
        <div className="from-copper/12 to-copper/4 rounded-lg border bg-linear-to-br p-3">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Manga
          </span>
          <div className="text-copper font-display mt-0.5 text-lg font-bold">
            {priceFormatter.format(priceBreakdown.mangaSpent)}
          </div>
        </div>
      </div>

      {/* Price range stats */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border">
        <div className="bg-card p-3 text-center">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Min
          </span>
          <div className="font-display mt-0.5 text-sm font-semibold">
            {priceFormatter.format(priceBreakdown.minPrice)}
          </div>
        </div>
        <div className="bg-card p-3 text-center">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Median
          </span>
          <div className="font-display mt-0.5 text-sm font-semibold">
            {priceFormatter.format(priceBreakdown.medianPrice)}
          </div>
        </div>
        <div className="bg-card p-3 text-center">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Max
          </span>
          <div className="font-display mt-0.5 text-sm font-semibold">
            {priceFormatter.format(priceBreakdown.maxPrice)}
          </div>
        </div>
      </div>

      {/* Top spending by series */}
      {priceBreakdown.spendingBySeries.length > 0 && (
        <div>
          <span className="text-muted-foreground mb-2 block text-[10px] font-medium tracking-wider uppercase">
            Top series by spend
          </span>
          <div className="space-y-2">
            {priceBreakdown.spendingBySeries.map((s) => (
              <Link
                key={s.id}
                href={`/library/series/${s.id}`}
                className="group block"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="group-hover:text-primary min-w-0 flex-1 truncate font-medium transition-colors">
                    {s.title}
                  </span>
                  <span className="text-muted-foreground ml-2 shrink-0">
                    {priceFormatter.format(s.total)}
                  </span>
                </div>
                <div className="bg-primary/8 mt-1 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="progress-animate from-copper to-gold h-full rounded-full bg-linear-to-r"
                    style={
                      {
                        "--target-width": `${priceBreakdown.maxSeriesSpent > 0 ? Math.round((s.total / priceBreakdown.maxSeriesSpent) * 100) : 0}%`
                      } as React.CSSProperties
                    }
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link
        href="/dashboard/tracked"
        className="text-primary hover:text-primary/80 block pt-1 text-center text-xs font-medium transition-colors"
      >
        {priceBreakdown.trackedCount} of {ownedVolumes} owned volumes priced
      </Link>
    </div>
  )
}
