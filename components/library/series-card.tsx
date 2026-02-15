"use client"

import { useMemo } from "react"
import { useSettingsStore } from "@/lib/store/settings-store"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { CoverImage } from "@/components/library/cover-image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { TypeBadge } from "@/components/ui/status-badge"
import type { SeriesWithVolumes } from "@/lib/types/database"

/** Props for the {@link SeriesCard} component. @source */
interface SeriesCardProps {
  readonly series: SeriesWithVolumes
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onClick: () => void
  readonly onBulkScrape?: () => void
  readonly selected?: boolean
  readonly onSelect?: () => void
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
  onBulkScrape,
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
          className={`bg-background/80 absolute top-2 left-2 z-10 rounded-lg p-0.5 shadow-sm backdrop-blur-sm transition-all ${selected ? "opacity-100" : "touch-device:opacity-100 opacity-0 group-hover:opacity-100"}`}
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
            <TypeBadge type={series.type} short />

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

      <div className="touch-device:opacity-100 absolute top-2 right-2 z-10 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="bg-background/80 hover:bg-background text-foreground focus-visible:ring-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl shadow-sm backdrop-blur-sm transition-colors hover:shadow-md focus-visible:ring-1 focus-visible:outline-none touch-device:border touch-device:border-border/50"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Actions for ${series.title}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(event) => event.stopPropagation()}
          >
            {onBulkScrape && (
              <DropdownMenuItem onClick={() => onBulkScrape()}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 h-4 w-4"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
                Bulk Scrape Prices
              </DropdownMenuItem>
            )}
            {onBulkScrape && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => onEdit()}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2 h-4 w-4"
              >
                <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
              </svg>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2 h-4 w-4"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
