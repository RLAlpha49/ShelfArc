"use client"

import Link from "next/link"
import { formatDate } from "@/lib/format-date"
import type { SeriesWithVolumes } from "@/lib/types/database"
import type { AugmentedVolume } from "@/lib/library/analytics"
import type { DateFormat } from "@/lib/store/settings-store"

/** Empty state shown when the user has no series yet. @source */
export function RecentSeriesEmpty() {
  return (
    <div className="glass-card flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center">
      <div className="text-primary bg-primary/8 mb-3 flex h-11 w-11 items-center justify-center rounded-lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-5 w-5"
        >
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      </div>
      <p className="text-muted-foreground text-sm">No series added yet</p>
      <Link
        href="/library"
        className="text-primary hover:text-primary/80 mt-2 inline-flex items-center gap-1 text-sm font-medium transition-colors"
      >
        Add your first series
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-3.5 w-3.5"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Link>
    </div>
  )
}

/**
 * Renders a list of recently added series.
 * @param items - Series entries to display.
 * @param dateFormat - User's preferred date format.
 * @source
 */
export function RecentSeriesList({
  items,
  dateFormat
}: {
  readonly items: readonly SeriesWithVolumes[]
  readonly dateFormat: DateFormat
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border">
      {items.map((s) => (
        <Link
          key={s.id}
          href={`/library/series/${s.id}`}
          className="bg-card group hover:bg-accent/60 flex items-center justify-between p-4 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
              {s.title}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {s.type === "light_novel" ? "Light Novel" : "Manga"} ·{" "}
              {s.volumes.length} vol
              {s.author && (
                <span className="text-muted-foreground/60"> · {s.author}</span>
              )}
              <span className="text-muted-foreground/60">
                {" "}
                · {formatDate(s.created_at, dateFormat)}
              </span>
            </div>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted-foreground/40 group-hover:text-primary ml-3 h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5"
          >
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </Link>
      ))}
    </div>
  )
}

/** Empty state shown when the user has no volumes yet. @source */
export function RecentVolumesEmpty() {
  return (
    <div className="glass-card flex flex-col items-center justify-center rounded-xl px-6 py-14 text-center">
      <div className="text-primary bg-primary/8 mb-3 flex h-11 w-11 items-center justify-center rounded-lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-5 w-5"
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      </div>
      <p className="text-muted-foreground text-sm">No volumes added yet</p>
    </div>
  )
}

/**
 * Renders a list of recently added volumes.
 * @param items - Volume entries to display.
 * @param priceFormatter - Intl formatter for currency values.
 * @param dateFormat - User's preferred date format.
 * @source
 */
export function RecentVolumesList({
  items,
  priceFormatter,
  dateFormat
}: {
  readonly items: readonly AugmentedVolume[]
  readonly priceFormatter: Intl.NumberFormat
  readonly dateFormat: DateFormat
}) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border">
      {items.map((v) => (
        <Link
          key={v.id}
          href={`/library/volume/${v.id}`}
          className="bg-card group hover:bg-accent/60 flex items-center justify-between p-4 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <div className="group-hover:text-primary truncate text-sm font-semibold transition-colors">
              {v.title || `Volume ${v.volume_number}`}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {v.seriesTitle} · Vol. {v.volume_number}
              {v.purchase_price != null && v.purchase_price > 0 && (
                <span className="text-muted-foreground/60">
                  {" "}
                  · {priceFormatter.format(v.purchase_price)}
                </span>
              )}
              <span className="text-muted-foreground/60">
                {" "}
                · {formatDate(v.created_at, dateFormat)}
              </span>
            </div>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted-foreground/40 group-hover:text-primary ml-3 h-4 w-4 shrink-0 transition-all group-hover:translate-x-0.5"
          >
            <polyline points="9,18 15,12 9,6" />
          </svg>
        </Link>
      ))}
    </div>
  )
}

/**
 * Switches between the recent series and recent volumes lists.
 * @param tab - Active tab identifier.
 * @param recentSeries - Series items for the "series" tab.
 * @param recentVolumes - Volume items for the "volumes" tab.
 * @param priceFormatter - Intl formatter for currency values.
 * @param dateFormat - User's preferred date format.
 * @source
 */
export function RecentlyAddedContent({
  tab,
  recentSeries,
  recentVolumes,
  priceFormatter,
  dateFormat
}: {
  readonly tab: "series" | "volumes"
  readonly recentSeries: readonly SeriesWithVolumes[]
  readonly recentVolumes: readonly AugmentedVolume[]
  readonly priceFormatter: Intl.NumberFormat
  readonly dateFormat: DateFormat
}) {
  if (tab === "series") {
    if (recentSeries.length === 0) return <RecentSeriesEmpty />
    return <RecentSeriesList items={recentSeries} dateFormat={dateFormat} />
  }
  if (recentVolumes.length === 0) return <RecentVolumesEmpty />
  return (
    <RecentVolumesList
      items={recentVolumes}
      priceFormatter={priceFormatter}
      dateFormat={dateFormat}
    />
  )
}
