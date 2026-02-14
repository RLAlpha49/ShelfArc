import type React from "react"
import Link from "next/link"
import type { SeriesInsightData } from "@/lib/library/series-insights"

/**
 * Two-panel insights display showing collection breakdown and series details.
 * @param insights - Pre-computed insight data.
 * @source
 */
export function SeriesInsightsPanel({
  insights
}: {
  readonly insights: SeriesInsightData
}) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
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
              {insights.missingVolumes ?? "—"}
            </div>
            <div className="text-muted-foreground text-xs tracking-widest uppercase">
              Missing
            </div>
          </div>
          <div>
            <div className="text-foreground text-lg font-semibold">
              {insights.averageRating ? insights.averageRating.toFixed(1) : "—"}
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
  )
}
