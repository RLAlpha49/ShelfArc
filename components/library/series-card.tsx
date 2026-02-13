"use client"

import { useMemo } from "react"
import { useSettingsStore } from "@/lib/store/settings-store"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { CoverImage } from "@/components/library/cover-image"
import type { SeriesWithVolumes, TitleType } from "@/lib/types/database"

/** Props for the {@link SeriesCard} component. @source */
interface SeriesCardProps {
  readonly series: SeriesWithVolumes
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onClick: () => void
  readonly selected?: boolean
  readonly onSelect?: () => void
}

/** Badge color mapping per series title type. @source */
const TYPE_COLORS: Record<TitleType, string> = {
  light_novel: "bg-gold/10 text-gold",
  manga: "bg-copper/10 text-copper",
  other: "bg-muted text-muted-foreground"
}

/**
 * Card displaying a series cover, title, type badge, progress bar, and quick-action buttons.
 * @param props - {@link SeriesCardProps}
 * @source
 */
export function SeriesCard({
  series,
  onEdit,
  onDelete,
  onClick,
  selected = false,
  onSelect
}: SeriesCardProps) {
  const { ownedVolumes, readVolumes, primaryIsbn } = useMemo(
    () =>
      series.volumes.reduce(
        (acc, volume) => {
          if (volume.ownership_status === "owned") {
            acc.ownedVolumes += 1
          }
          if (volume.reading_status === "completed") {
            acc.readVolumes += 1
          }
          if (!acc.primaryIsbn && volume.isbn) {
            acc.primaryIsbn = volume.isbn
          }
          return acc
        },
        { ownedVolumes: 0, readVolumes: 0, primaryIsbn: null as string | null }
      ),
    [series.volumes]
  )

  const totalVolumes = series.total_volumes || series.volumes.length
  const showSeriesProgressBar = useSettingsStore((s) => s.showSeriesProgressBar)
  const showSelection = Boolean(onSelect)

  return (
    <div className="card-hover hover-lift press-effect group relative h-full w-full">
      {showSelection && (
        <div
          className={`bg-background/80 absolute top-2 left-2 z-10 rounded-lg p-0.5 shadow-sm backdrop-blur-sm transition-all ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
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
        className={`bg-card hover:bg-accent/50 relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl text-left transition-all hover:shadow-lg ${selected ? "ring-primary/40 ring-offset-background ring-2 ring-offset-2" : ""}`}
        onClick={onClick}
        aria-pressed={showSelection ? selected : undefined}
      >
        <div className="bg-muted relative aspect-2/3">
          <CoverImage
            isbn={primaryIsbn}
            coverImageUrl={series.cover_image_url}
            alt={series.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            fallback={
              <div className="from-primary/5 to-copper/5 flex h-full items-center justify-center bg-linear-to-br">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary/30 h-12 w-12"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
              </div>
            }
          />
          <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <div className="p-3">
          <h3 className="font-display line-clamp-2 text-sm leading-tight font-semibold">
            {series.title}
          </h3>

          {series.author && (
            <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">
              {series.author}
            </p>
          )}

          {showSeriesProgressBar && totalVolumes > 0 && (
            <div className="bg-primary/10 mt-2.5 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="progress-animate from-copper to-gold h-full rounded-full bg-linear-to-r"
                style={
                  {
                    "--target-width": `${(ownedVolumes / totalVolumes) * 100}%`
                  } as React.CSSProperties
                }
              />
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-1">
            <Badge
              variant="secondary"
              className={`rounded-lg text-xs ${TYPE_COLORS[series.type] ?? TYPE_COLORS.other}`}
            >
              {series.type === "light_novel" && "LN"}
              {series.type === "manga" && "Manga"}
              {series.type === "other" && "Other"}
            </Badge>

            {series.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-primary/15 rounded-lg text-xs"
              >
                {tag}
              </Badge>
            ))}
          </div>

          <div className="text-muted-foreground mt-2.5 flex items-center gap-3 text-[11px]">
            <span>
              {ownedVolumes}/{totalVolumes} owned
            </span>
            <span className="bg-border h-3 w-px" />
            <span>{readVolumes} read</span>
          </div>
        </div>
      </button>

      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 overflow-hidden opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          className="bg-background/80 hover:bg-background text-foreground focus-visible:ring-ring inline-flex h-8 items-center justify-center rounded-xl px-2 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors hover:shadow-md focus-visible:ring-1 focus-visible:outline-none"
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
          className="bg-background/80 hover:bg-destructive/15 text-destructive focus-visible:ring-ring inline-flex h-8 items-center justify-center rounded-xl px-2 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors hover:shadow-md focus-visible:ring-1 focus-visible:outline-none"
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
