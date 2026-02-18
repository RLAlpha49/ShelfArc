"use client"

import { useMemo } from "react"

import { CoverImage } from "@/components/library/cover-image"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { TypeBadge } from "@/components/ui/status-badge"
import { useSettingsStore } from "@/lib/store/settings-store"
import type { SeriesWithVolumes } from "@/lib/types/database"

export interface SeriesListItemProps {
  readonly series: SeriesWithVolumes
  readonly onClick: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly selected?: boolean
  readonly onSelect?: () => void
}

/**
 * List-mode row for a single series with cover, title, and volume count.
 */
export function SeriesListItem({
  series,
  onClick,
  onEdit,
  onDelete,
  selected = false,
  onSelect
}: SeriesListItemProps) {
  const ownedCount = series.volumes.filter(
    (v) => v.ownership_status === "owned"
  ).length
  const readCount = series.volumes.filter(
    (v) => v.reading_status === "completed"
  ).length
  const totalCount = series.total_volumes || series.volumes.length
  const { primaryIsbn, volumeFallbackUrl } = useMemo(() => {
    const primaryVolume = series.volumes.find((volume) => volume.isbn)
    const fallbackVolume = series.volumes.find(
      (volume) => volume.cover_image_url
    )

    return {
      primaryIsbn: primaryVolume?.isbn ?? null,
      volumeFallbackUrl: fallbackVolume?.cover_image_url ?? null
    }
  }, [series.volumes])
  const showSelection = Boolean(onSelect)
  const showSeriesProgressBar = useSettingsStore((s) => s.showSeriesProgressBar)

  return (
    <div className="group relative">
      {showSelection && (
        <div
          className={`bg-background/80 absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-lg p-0.5 shadow-sm backdrop-blur-sm transition-all ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect?.()}
            aria-label={`Select ${series.title}`}
            className="border-foreground/50 h-6 w-6 border-2"
          />
        </div>
      )}

      <button
        type="button"
        className={`group glass-card hover:bg-accent flex w-full cursor-pointer items-start gap-4 rounded-2xl p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${showSelection ? "pl-14" : ""} ${selected ? "ring-primary/40 ring-offset-background ring-2 ring-offset-2" : ""}`}
        onClick={onClick}
        aria-pressed={showSelection ? selected : undefined}
      >
        <div className="bg-muted relative h-20 w-14 shrink-0 overflow-hidden rounded-xl">
          <CoverImage
            isbn={primaryIsbn}
            coverImageUrl={series.cover_image_url}
            fallbackCoverImageUrl={volumeFallbackUrl}
            alt={series.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            fallback={
              <div className="from-primary/5 to-copper/5 flex h-full w-full items-center justify-center bg-linear-to-br">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-primary/30 h-6 w-6"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
              </div>
            }
          />
          <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="font-display min-w-0 truncate font-medium">
              {series.title}
            </h3>
            <TypeBadge type={series.type} short className="shrink-0" />
          </div>
          <p className="text-muted-foreground truncate text-sm">
            {series.author || "Unknown Author"}
          </p>
          {series.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {series.tags.slice(0, 3).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="border-primary/15 rounded-lg text-xs"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="hidden shrink-0 space-y-2 text-right sm:block">
          <div className="text-muted-foreground flex items-center justify-end gap-3 text-xs">
            <span>
              {ownedCount}/{totalCount} owned
            </span>
            <span className="bg-border h-3 w-px" />
            <span>{readCount} read</span>
          </div>
          {showSeriesProgressBar && totalCount > 0 && (
            <div className="bg-primary/10 ml-auto h-1.5 w-24 overflow-hidden rounded-full">
              <div
                className="progress-animate from-copper to-gold h-full rounded-full bg-linear-to-r"
                style={
                  {
                    "--target-width": `${(ownedCount / totalCount) * 100}%`
                  } as React.CSSProperties
                }
              />
            </div>
          )}
        </div>
      </button>
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          className="bg-background/80 hover:bg-background text-foreground focus-visible:ring-ring inline-flex h-8 items-center justify-center rounded-xl px-2 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
          onClick={(event) => {
            event.stopPropagation()
            onEdit()
          }}
          aria-label={`Edit ${series.title}`}
        >
          Edit
        </button>
        <button
          type="button"
          className="bg-background/80 hover:bg-destructive/10 text-destructive focus-visible:ring-ring inline-flex h-8 items-center justify-center rounded-xl px-2 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete ${series.title}`}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
