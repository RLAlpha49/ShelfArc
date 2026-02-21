import Link from "next/link"
import type React from "react"

import type { SeriesInsightData } from "@/lib/library/series-insights"

/**
 * Two-panel insights display showing collection breakdown and series details.
 * @param insights - Pre-computed insight data.
 * @param seriesTitle - Optional series title used to generate the Amazon buy link.
 * @source
 */
export function SeriesInsightsPanel({
  insights,
  seriesTitle
}: {
  readonly insights: SeriesInsightData
  readonly seriesTitle?: string
}) {
  const showNextCallout = insights.nextVolumeLabel !== "Complete"
  const amazonUrl = seriesTitle
    ? `https://www.amazon.com/s?k=${encodeURIComponent(seriesTitle + " Vol " + String(insights.nextVolumeNumber))}`
    : null
  return (
    <div className="mt-6 space-y-4">
      {showNextCallout && (
        <div
          className="animate-fade-in-up glass-card flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"
          style={{ animationDelay: "150ms", animationFillMode: "both" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium tracking-widest text-amber-700 uppercase dark:text-amber-400">
                Next to buy
              </p>
              <p className="font-display text-lg font-semibold">
                {insights.nextVolumeLabel}
              </p>
            </div>
          </div>
          {amazonUrl && (
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/25 dark:text-amber-400"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              Buy on Amazon
            </a>
          )}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          className="animate-fade-in-up glass-card rounded-2xl p-5"
          style={{ animationDelay: "200ms", animationFillMode: "both" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs tracking-widest uppercase">
              Collection breakdown
            </span>
            <span className="text-muted-foreground text-xs">
              {insights.collectionPercent}% collected
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-foreground text-lg font-semibold">
                {insights.ownedVolumes}
              </div>
              <div className="text-muted-foreground text-xs tracking-widest uppercase">
                Owned
              </div>
            </div>
            <div>
              <div className="text-foreground text-lg font-semibold">
                {insights.wishlistVolumes}
              </div>
              <div className="text-muted-foreground text-xs tracking-widest uppercase">
                Wishlist
              </div>
            </div>
            <div>
              <div className="text-foreground text-lg font-semibold">
                {insights.readingVolumes}
              </div>
              <div className="text-muted-foreground text-xs tracking-widest uppercase">
                Reading
              </div>
            </div>
            <div>
              <div className="text-foreground text-lg font-semibold">
                {insights.readVolumes}
              </div>
              <div className="text-muted-foreground text-xs tracking-widest uppercase">
                Completed
              </div>
            </div>
            <div>
              <div className="text-foreground text-lg font-semibold">
                {insights.gapVolumes ?? "—"}
              </div>
              <div className="text-muted-foreground text-xs tracking-widest uppercase">
                Gap volumes
              </div>
            </div>
            <div>
              <div className="text-foreground text-lg font-semibold">
                {insights.averageRating
                  ? insights.averageRating.toFixed(1)
                  : "—"}
              </div>
              <div className="text-muted-foreground text-xs tracking-widest uppercase">
                Avg rating
              </div>
            </div>
          </div>
          {insights.totalVolumes > 0 && (
            <div className="mt-4 space-y-3">
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Collection</span>
                  <span className="font-medium">
                    {insights.collectionPercent}%
                  </span>
                </div>
                <div className="bg-primary/10 h-2 overflow-hidden rounded-full">
                  <div
                    className="progress-animate from-copper to-gold h-full rounded-full bg-linear-to-r"
                    style={
                      {
                        "--target-width": `${insights.collectionPercent}%`
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Reading</span>
                  <span className="font-medium">{insights.readPercent}%</span>
                </div>
                <div className="bg-primary/10 h-2 overflow-hidden rounded-full">
                  <div
                    className="progress-animate from-primary to-gold h-full rounded-full bg-linear-to-r"
                    style={
                      {
                        "--target-width": `${insights.readPercent}%`
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className="animate-fade-in-up glass-card rounded-2xl p-5"
          style={{ animationDelay: "300ms", animationFillMode: "both" }}
        >
          <span className="text-muted-foreground text-xs tracking-widest uppercase">
            Series details
          </span>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                Cataloged
              </dt>
              <dd className="font-medium">{insights.catalogedVolumes}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                Total volumes
              </dt>
              <dd className="font-medium">
                {insights.officialTotalVolumes ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                Owned volumes
              </dt>
              <dd className="font-medium">{insights.volumeRangeLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                Next volume
              </dt>
              <dd className="font-medium">{insights.nextVolumeLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                Latest volume
              </dt>
              <dd className="font-medium">
                {insights.latestVolume ? (
                  <Link
                    href={`/library/volume/${insights.latestVolume.id}`}
                    className="text-foreground hover:text-primary"
                  >
                    Vol. {insights.latestVolume.volume_number}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                Total pages
              </dt>
              <dd className="font-medium">
                {insights.totalPages > 0
                  ? insights.totalPages.toLocaleString()
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                Priced
              </dt>
              <dd className="font-medium">
                {insights.pricedVolumes} of {insights.catalogedVolumes}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                Added
              </dt>
              <dd className="font-medium">{insights.createdLabel || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs tracking-widest uppercase">
                Updated
              </dt>
              <dd className="font-medium">{insights.updatedLabel || "—"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
