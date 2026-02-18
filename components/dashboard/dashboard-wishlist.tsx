"use client"

import Link from "next/link"

import type { WishlistStats } from "@/lib/library/analytics"

interface DashboardWishlistProps {
  readonly wishlistStats: WishlistStats
  readonly wishlistCount: number
  readonly totalVolumes: number
  readonly priceFormatter: Intl.NumberFormat
}

export default function DashboardWishlist({
  wishlistStats,
  wishlistCount,
  totalVolumes,
  priceFormatter
}: DashboardWishlistProps) {
  if (wishlistCount === 0) {
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
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">No wishlisted volumes</p>
        <p className="text-muted-foreground/60 mt-1 text-xs">
          Add volumes to your wishlist to track what you want
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="from-gold/15 to-gold/5 rounded-lg border bg-linear-to-br p-3">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Volumes
          </span>
          <div className="text-gold font-display mt-0.5 text-lg font-bold">
            {wishlistCount}
          </div>
        </div>
        <div className="from-copper/12 to-copper/4 rounded-lg border bg-linear-to-br p-3">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Est. Cost
          </span>
          <div className="text-copper font-display mt-0.5 text-lg font-bold">
            {priceFormatter.format(wishlistStats.totalWishlistCost)}
          </div>
        </div>
      </div>

      {/* Average price */}
      {wishlistStats.wishlistPricedCount > 0 && (
        <div className="bg-card rounded-lg border p-3 text-center">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            Avg. Price
          </span>
          <div className="font-display mt-0.5 text-sm font-semibold">
            {priceFormatter.format(wishlistStats.averageWishlistPrice)}
          </div>
        </div>
      )}

      {/* Top wishlisted series */}
      {wishlistStats.topWishlistedSeries.length > 0 && (
        <div>
          <span className="text-muted-foreground mb-2 block text-[10px] font-medium tracking-wider uppercase">
            Top wishlisted series
          </span>
          <div className="space-y-2">
            {wishlistStats.topWishlistedSeries.map((s) => (
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
                    {s.count} vol{s.count === 1 ? "" : "s"}
                    {s.cost > 0 && (
                      <span className="text-muted-foreground/60">
                        {" "}
                        · {priceFormatter.format(s.cost)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="bg-gold/10 mt-1 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="progress-animate from-gold to-copper h-full rounded-full bg-linear-to-r"
                    style={
                      {
                        "--target-width": `${wishlistStats.maxWishlistSeriesCount > 0 ? Math.round((s.count / wishlistStats.maxWishlistSeriesCount) * 100) : 0}%`
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
        href="/dashboard/wishlist"
        className="text-primary hover:text-primary/80 block pt-1 text-center text-xs font-medium transition-colors"
      >
        {wishlistCount} of {totalVolumes} volumes wishlisted
      </Link>
    </div>
  )
}
