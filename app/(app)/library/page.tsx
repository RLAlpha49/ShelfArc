"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SeriesCard } from "@/components/library/series-card"
import { SeriesDialog } from "@/components/library/series-dialog"
import { AssignToSeriesDialog } from "@/components/library/assign-to-series-dialog"
import { DuplicateMergeDialog } from "@/components/library/duplicate-merge-dialog"
import { BulkScrapeDialog } from "@/components/library/bulk-scrape-dialog"
import { VolumeDialog } from "@/components/library/volume-dialog"
import { BookSearchDialog } from "@/components/library/book-search-dialog"
import { LibraryToolbar } from "@/components/library/library-toolbar"
import { VolumeCard } from "@/components/library/volume-card"
import {
  VirtualizedWindowGrid,
  VirtualizedWindowList
} from "@/components/library/virtualized-window"
import { CoverImage } from "@/components/library/cover-image"
import { EmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useLibrary } from "@/lib/hooks/use-library"
import { useLibraryUrlSync } from "@/lib/hooks/use-library-url-sync"
import { useWindowWidth } from "@/lib/hooks/use-window-width"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type { CardSize } from "@/lib/store/settings-store"
import { normalizeVolumeTitle } from "@/lib/normalize-title"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  SeriesWithVolumes,
  Volume,
  OwnershipStatus,
  ReadingStatus,
  TitleType
} from "@/lib/types/database"
import { type BookSearchResult } from "@/lib/books/search"
import { normalizeIsbn } from "@/lib/books/isbn"

/**
 * Returns Tailwind grid classes for the given card size.
 * @param cardSize - The user's chosen card size.
 * @returns A CSS class string for the grid layout.
 * @source
 */
function getGridClasses(cardSize: CardSize): string {
  switch (cardSize) {
    case "compact":
      return "grid items-stretch grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
    case "large":
      return "grid items-stretch grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    default:
      return "grid items-stretch grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
  }
}

/** Badge color mapping per series title type. @source */
const SERIES_TYPE_COLORS: Record<TitleType, string> = {
  light_novel: "bg-gold/10 text-gold",
  manga: "bg-copper/10 text-copper",
  other: "bg-muted text-muted-foreground"
}

/** Badge color mapping per reading status. @source */
const READING_STATUS_COLORS: Record<ReadingStatus, string> = {
  unread: "bg-muted text-muted-foreground",
  reading: "bg-primary/10 text-primary",
  completed: "bg-copper/10 text-copper",
  on_hold: "bg-gold/10 text-gold",
  dropped: "bg-destructive/10 text-destructive"
}

/** Badge color mapping per ownership status. @source */
const OWNERSHIP_STATUS_COLORS: Record<OwnershipStatus, string> = {
  owned: "bg-copper/10 text-copper",
  wishlist: "bg-gold/10 text-gold"
}

/** Item count above which /library switches to window virtualization. @source */
const VIRTUALIZE_THRESHOLD = 200

/** Returns the number of grid columns for the given card size + viewport width. @source */
const GRID_COLUMNS_BY_CARD_SIZE: Record<CardSize, readonly number[]> = {
  compact: [3, 4, 5, 6, 8],
  default: [2, 3, 4, 5, 6],
  large: [1, 2, 3, 4, 5]
}

function getBreakpointTier(width: number) {
  if (width >= 1280) return 4
  if (width >= 1024) return 3
  if (width >= 768) return 2
  if (width >= 640) return 1
  return 0
}

function getGridColumnCount(cardSize: CardSize, width: number) {
  const tier = getBreakpointTier(width)
  return GRID_COLUMNS_BY_CARD_SIZE[cardSize][tier] ?? 2
}

/** Returns the (Tailwind-matching) grid gap in pixels for the given card size. @source */
function getGridGapPx(cardSize: CardSize) {
  if (cardSize === "compact") return 12
  if (cardSize === "large") return 20
  return 16
}

/** Rough row-height estimate for card grids (actual height is measured). @source */
function estimateGridRowSize(cardSize: CardSize) {
  if (cardSize === "compact") return 320
  if (cardSize === "large") return 460
  return 380
}

/**
 * Skeleton placeholder shown while the library data is loading.
 * @param viewMode - Current layout mode (grid or list).
 * @source
 */
function LoadingSkeleton({ viewMode }: { readonly viewMode: "grid" | "list" }) {
  const cardSize = useSettingsStore((s) => s.cardSize)
  const items = Array.from({ length: 12 }, (_, i) => `skeleton-${i}`)

  if (viewMode === "grid") {
    return (
      <div className="animate-fade-in">
        <div className={getGridClasses(cardSize)}>
          {items.map((id) => (
            <div key={id} className="space-y-2 p-3">
              <Skeleton className="aspect-2/3 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      {items.map((id) => (
        <Skeleton key={id} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  )
}

/**
 * List-mode row for a single series with cover, title, and volume count.
 * @param series - The series data to display.
 * @param onClick - Handler for clicking the row.
 * @param onEdit - Handler for editing the series.
 * @param onDelete - Handler for deleting the series.
 * @param selected - Whether this row is currently selected.
 * @param onSelect - Optional handler for toggling selection.
 * @source
 */
function SeriesListItem({
  series,
  onClick,
  onEdit,
  onDelete,
  selected = false,
  onSelect
}: {
  readonly series: SeriesWithVolumes
  readonly onClick: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly selected?: boolean
  readonly onSelect?: () => void
}) {
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
            <Badge
              variant="secondary"
              className={`shrink-0 rounded-lg text-xs ${SERIES_TYPE_COLORS[series.type] ?? SERIES_TYPE_COLORS.other}`}
            >
              {series.type === "light_novel" && "LN"}
              {series.type === "manga" && "Manga"}
              {series.type === "other" && "Other"}
            </Badge>
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

/** A volume paired with its parent series for flat-list rendering. @source */
type VolumeWithSeries = {
  volume: Volume
  series: SeriesWithVolumes
}

/** Supported Amazon binding labels for search queries. @source */
const AMAZON_BINDING_LABELS = ["Paperback", "Kindle"] as const

/**
 * Builds an Amazon search URL for a volume, preferring ISBN when available.
 * @param options - Search parameters including domain, ISBN, titles, and format.
 * @returns A fully-encoded Amazon search URL.
 * @source
 */
const buildAmazonSearchUrl = (options: {
  amazonDomain: string
  isbn?: string | null
  seriesTitle?: string | null
  volumeTitle?: string | null
  volumeNumber: number
  format?: string | null
  bindingLabel?: string | null
}) => {
  const domain = options.amazonDomain?.trim() || "amazon.com"
  const isbn = options.isbn?.trim()
  if (isbn) {
    return `https://www.${domain}/s?k=${encodeURIComponent(isbn)}`
  }
  const tokens = [options.seriesTitle, options.volumeTitle]
    .map((value) => value?.trim())
    .filter(Boolean) as string[]
  if (Number.isFinite(options.volumeNumber)) {
    tokens.push(`Volume ${options.volumeNumber}`)
  }
  if (options.format?.trim()) tokens.push(options.format.trim())
  if (options.bindingLabel) tokens.push(options.bindingLabel)
  const query = tokens.join(" ").trim()
  return `https://www.${domain}/s?k=${encodeURIComponent(query)}`
}

/** Action menu for a volume row/card (toggle read/wishlist, rating, edit/delete). @source */
function VolumeActionsMenu({
  coverAlt,
  amazonLink,
  amazonLabel,
  isCompleted,
  isWishlisted,
  rating,
  onScrapePrice,
  onToggleRead,
  onToggleWishlist,
  onSetRating,
  onEdit,
  onDelete
}: {
  readonly coverAlt: string
  readonly amazonLink: string
  readonly amazonLabel: string
  readonly isCompleted: boolean
  readonly isWishlisted: boolean
  readonly rating: number | null
  readonly onScrapePrice?: () => void
  readonly onToggleRead?: () => void
  readonly onToggleWishlist?: () => void
  readonly onSetRating?: (rating: number | null) => void
  readonly onEdit: () => void
  readonly onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="bg-background/80 hover:bg-background text-foreground focus-visible:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-xl shadow-sm backdrop-blur-sm transition-all hover:shadow-md focus-visible:ring-1 focus-visible:outline-none"
        onClick={(event) => event.stopPropagation()}
        aria-label={`Actions for ${coverAlt}`}
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
        <DropdownMenuItem
          onClick={() => {
            if (amazonLink) {
              window.open(amazonLink, "_blank", "noopener,noreferrer")
            }
          }}
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
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
          <span className="truncate">Amazon</span>
          <span className="sr-only">{amazonLabel}</span>
        </DropdownMenuItem>

        {onScrapePrice && (
          <DropdownMenuItem onClick={() => onScrapePrice()}>
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
            Scrape Price
          </DropdownMenuItem>
        )}

        {onToggleRead && (
          <DropdownMenuItem onClick={() => onToggleRead()}>
            {isCompleted ? (
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
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            ) : (
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
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
            {isCompleted ? "Mark as unread" : "Mark as read"}
          </DropdownMenuItem>
        )}

        {onToggleWishlist && (
          <DropdownMenuItem onClick={() => onToggleWishlist()}>
            {isWishlisted ? (
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
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
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
                <path d="M12.17 8.09 10.34 6.26a2 2 0 0 0-2.83 0L5.67 8.09a2 2 0 0 0 0 2.83l6.36 6.36a2 2 0 0 0 2.83 0l6.36-6.36a2 2 0 0 0 0-2.83l-1.83-1.83a2 2 0 0 0-2.83 0z" />
              </svg>
            )}
            {isWishlisted ? "Mark as owned" : "Move to wishlist"}
          </DropdownMenuItem>
        )}

        {onSetRating && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-gold mr-2 h-4 w-4"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Rating
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent align="end">
              <DropdownMenuRadioGroup
                value={rating == null ? "none" : String(rating)}
                onValueChange={(next) => {
                  if (next === "none") {
                    onSetRating(null)
                    return
                  }
                  const parsed = Number(next)
                  if (!Number.isFinite(parsed)) return
                  onSetRating(parsed)
                }}
              >
                <DropdownMenuRadioItem value="none">
                  No rating
                </DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                {Array.from({ length: 10 }, (_, index) => {
                  const value = String(index + 1)
                  return (
                    <DropdownMenuRadioItem key={value} value={value}>
                      {value}
                    </DropdownMenuRadioItem>
                  )
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

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
        <DropdownMenuItem variant="destructive" onClick={() => onDelete()}>
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
  )
}

/**
 * Grid-mode card for a single volume with cover image and action overlays.
 * @source
 */
function VolumeGridItem({
  item,
  onClick,
  onEdit,
  onDelete,
  onScrapePrice,
  onToggleRead,
  onToggleWishlist,
  onSetRating,
  amazonDomain,
  bindingLabel,
  selected = false,
  onSelect
}: {
  readonly item: VolumeWithSeries
  readonly onClick: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onScrapePrice?: () => void
  readonly onToggleRead?: () => void
  readonly onToggleWishlist?: () => void
  readonly onSetRating?: (rating: number | null) => void
  readonly amazonDomain: string
  readonly bindingLabel: string
  readonly selected?: boolean
  readonly onSelect?: () => void
}) {
  const volumeLabel = `Volume ${item.volume.volume_number}`
  const volumeDescriptor = item.volume.title
    ? `${volumeLabel} • ${normalizeVolumeTitle(item.volume.title)}`
    : volumeLabel
  const coverAlt = `${item.series.title} — ${volumeDescriptor}`
  const showSelection = Boolean(onSelect)
  const isCompleted = item.volume.reading_status === "completed"
  const isWishlisted = item.volume.ownership_status === "wishlist"
  const amazonSearchUrl = buildAmazonSearchUrl({
    amazonDomain,
    isbn: item.volume.isbn,
    seriesTitle: item.series.title,
    volumeTitle: item.volume.title,
    volumeNumber: item.volume.volume_number,
    format: item.volume.format,
    bindingLabel
  })
  const amazonLink = item.volume.amazon_url || amazonSearchUrl
  const amazonLabel = item.volume.amazon_url
    ? `Open ${coverAlt} on Amazon`
    : `Search Amazon for ${coverAlt}`

  return (
    <div className="group relative">
      {showSelection && (
        <div
          className={`bg-background/80 absolute top-2 left-2 z-10 rounded-lg p-0.5 shadow-sm backdrop-blur-sm transition-all ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect?.()}
            aria-label={`Select ${coverAlt}`}
            className="border-foreground/50 h-6 w-6 border-2"
          />
        </div>
      )}

      <button
        type="button"
        className={`bg-card hover:bg-accent/60 group-hover:bg-accent/60 relative w-full cursor-pointer overflow-hidden rounded-2xl text-left transition-colors ${selected ? "ring-primary/40 ring-offset-background ring-2 ring-offset-2" : ""}`}
        onClick={onClick}
        aria-pressed={showSelection ? selected : undefined}
      >
        <div className="bg-muted relative aspect-2/3 overflow-hidden">
          <CoverImage
            isbn={item.volume.isbn}
            coverImageUrl={item.volume.cover_image_url}
            fallbackCoverImageUrl={item.series.cover_image_url}
            alt={coverAlt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            fallback={
              <div className="flex h-full items-center justify-center">
                <span className="text-muted-foreground/30 text-3xl font-bold">
                  {item.volume.volume_number}
                </span>
                <span className="sr-only">{coverAlt}</span>
              </div>
            }
          />
          <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="mt-2.5 space-y-1.5 px-1 pb-2">
          <p className="font-display line-clamp-1 font-medium">
            {item.series.title}
          </p>
          <p className="text-muted-foreground line-clamp-1 text-xs">
            Vol. {item.volume.volume_number}
            {item.volume.title
              ? ` • ${normalizeVolumeTitle(item.volume.title)}`
              : ""}
          </p>
          <div className="flex flex-wrap gap-1">
            <Badge
              variant="secondary"
              className={`rounded-lg text-xs ${OWNERSHIP_STATUS_COLORS[item.volume.ownership_status] ?? "bg-muted text-muted-foreground"}`}
            >
              {item.volume.ownership_status}
            </Badge>
            <Badge
              variant="secondary"
              className={`rounded-lg text-xs ${READING_STATUS_COLORS[item.volume.reading_status]}`}
            >
              {item.volume.reading_status.replace("_", " ")}
            </Badge>
          </div>
          {item.volume.rating != null && (
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-gold h-3 w-3"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {item.volume.rating}/10
            </div>
          )}
        </div>
      </button>
      <div className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <VolumeActionsMenu
          coverAlt={coverAlt}
          amazonLink={amazonLink}
          amazonLabel={amazonLabel}
          isCompleted={isCompleted}
          isWishlisted={isWishlisted}
          rating={item.volume.rating}
          onScrapePrice={onScrapePrice}
          onToggleRead={onToggleRead}
          onToggleWishlist={onToggleWishlist}
          onSetRating={onSetRating}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}

/**
 * List-mode row for a single volume with cover thumbnail and metadata.
 * @source
 */
function VolumeListItem({
  item,
  onClick,
  onEdit,
  onDelete,
  onScrapePrice,
  onToggleRead,
  onToggleWishlist,
  onSetRating,
  amazonDomain,
  bindingLabel,
  selected = false,
  onSelect
}: {
  readonly item: VolumeWithSeries
  readonly onClick: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onScrapePrice?: () => void
  readonly onToggleRead?: () => void
  readonly onToggleWishlist?: () => void
  readonly onSetRating?: (rating: number | null) => void
  readonly amazonDomain: string
  readonly bindingLabel: string
  readonly selected?: boolean
  readonly onSelect?: () => void
}) {
  const volumeLabel = `Volume ${item.volume.volume_number}`
  const volumeDescriptor = item.volume.title
    ? `${volumeLabel} • ${item.volume.title}`
    : volumeLabel
  const coverAlt = `${item.series.title} — ${volumeDescriptor}`
  const showSelection = Boolean(onSelect)
  const isCompleted = item.volume.reading_status === "completed"
  const isWishlisted = item.volume.ownership_status === "wishlist"
  const amazonSearchUrl = buildAmazonSearchUrl({
    amazonDomain,
    isbn: item.volume.isbn,
    seriesTitle: item.series.title,
    volumeTitle: item.volume.title,
    volumeNumber: item.volume.volume_number,
    format: item.volume.format,
    bindingLabel
  })
  const amazonLink = item.volume.amazon_url || amazonSearchUrl
  const amazonLabel = item.volume.amazon_url
    ? `Open ${coverAlt} on Amazon`
    : `Search Amazon for ${coverAlt}`

  return (
    <div className="group relative">
      {showSelection && (
        <div
          className={`bg-background/80 absolute top-1/2 left-4 z-10 -translate-y-1/2 rounded-lg p-0.5 shadow-sm backdrop-blur-sm transition-all ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect?.()}
            aria-label={`Select ${coverAlt}`}
            className="border-foreground/50 h-6 w-6 border-2"
          />
        </div>
      )}

      <button
        type="button"
        className={`glass-card hover:bg-accent group-hover:bg-accent relative flex w-full cursor-pointer items-start gap-4 rounded-2xl p-4 text-left shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${showSelection ? "pl-14" : ""} ${selected ? "ring-primary/40 ring-offset-background ring-2 ring-offset-2" : ""}`}
        onClick={onClick}
        aria-pressed={showSelection ? selected : undefined}
      >
        <div className="bg-muted relative h-20 w-14 shrink-0 overflow-hidden rounded-xl">
          <CoverImage
            isbn={item.volume.isbn}
            coverImageUrl={item.volume.cover_image_url}
            fallbackCoverImageUrl={item.series.cover_image_url}
            alt={coverAlt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-muted-foreground/50 text-sm font-semibold">
                  {item.volume.volume_number}
                </span>
                <span className="sr-only">{coverAlt}</span>
              </div>
            }
          />
          <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="font-display truncate font-medium">
            {item.series.title}
          </h3>
          <p className="text-muted-foreground truncate text-sm">
            Vol. {item.volume.volume_number}
            {item.volume.title
              ? ` • ${normalizeVolumeTitle(item.volume.title)}`
              : ""}
          </p>
          {item.series.author && (
            <p className="text-muted-foreground truncate text-xs">
              {item.series.author}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            <Badge
              variant="secondary"
              className={`rounded-lg text-xs ${OWNERSHIP_STATUS_COLORS[item.volume.ownership_status] ?? "bg-muted text-muted-foreground"}`}
            >
              {item.volume.ownership_status}
            </Badge>
            <Badge
              variant="secondary"
              className={`rounded-lg text-xs ${READING_STATUS_COLORS[item.volume.reading_status]}`}
            >
              {item.volume.reading_status.replace("_", " ")}
            </Badge>
            {item.volume.format && (
              <Badge
                variant="outline"
                className="border-primary/15 rounded-lg text-xs"
              >
                {item.volume.format}
              </Badge>
            )}
          </div>
        </div>
        <div className="hidden shrink-0 space-y-1 text-right sm:block">
          {item.volume.rating != null && (
            <div className="text-muted-foreground flex items-center justify-end gap-1 text-xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-gold h-3 w-3"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {item.volume.rating}/10
            </div>
          )}
          {item.volume.reading_status === "reading" &&
            item.volume.current_page != null &&
            item.volume.page_count != null && (
              <p className="text-muted-foreground text-xs">
                p.{item.volume.current_page}/{item.volume.page_count}
              </p>
            )}
          {item.volume.purchase_price != null && (
            <p className="text-muted-foreground text-xs">
              ${item.volume.purchase_price.toFixed(2)}
            </p>
          )}
        </div>
      </button>
      <div className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <VolumeActionsMenu
          coverAlt={coverAlt}
          amazonLink={amazonLink}
          amazonLabel={amazonLabel}
          isCompleted={isCompleted}
          isWishlisted={isWishlisted}
          rating={item.volume.rating}
          onScrapePrice={onScrapePrice}
          onToggleRead={onToggleRead}
          onToggleWishlist={onToggleWishlist}
          onSetRating={onSetRating}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}

/**
 * Main library page for browsing, filtering, and managing the user's series and volume collection.
 * @source
 */
export default function LibraryPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  useLibraryUrlSync()
  const consumedAddParamRef = useRef<string | null>(null)
  const {
    series,
    unassignedVolumes,
    filteredSeries,
    filteredVolumes,
    filteredUnassignedVolumes,
    isLoading,
    fetchSeries,
    createSeries,
    editSeries,
    removeSeries,
    createVolume,
    editVolume,
    removeVolume,
    addBookFromSearchResult,
    addBooksFromSearchResults
  } = useLibrary()

  const {
    viewMode,
    setSelectedSeries,
    collectionView,
    deleteSeriesVolumes,
    amazonDomain,
    amazonPreferKindle
  } = useLibraryStore()
  const cardSize = useSettingsStore((s) => s.cardSize)
  const windowWidth = useWindowWidth()
  const gridColumnCount = useMemo(
    () => getGridColumnCount(cardSize, windowWidth),
    [cardSize, windowWidth]
  )
  const gridGapPx = useMemo(() => getGridGapPx(cardSize), [cardSize])
  const confirmBeforeDelete = useSettingsStore((s) => s.confirmBeforeDelete)
  const amazonBindingLabel = AMAZON_BINDING_LABELS[Number(amazonPreferKindle)]

  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)
  const [editingSeries, setEditingSeries] = useState<SeriesWithVolumes | null>(
    null
  )
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false)
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [pendingSeriesSelection, setPendingSeriesSelection] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSeries, setDeletingSeries] =
    useState<SeriesWithVolumes | null>(null)
  const [deleteVolumeDialogOpen, setDeleteVolumeDialogOpen] = useState(false)
  const [deletingVolume, setDeletingVolume] = useState<Volume | null>(null)
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<Set<string>>(
    () => new Set()
  )
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<Set<string>>(
    () => new Set()
  )
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [assignToSeriesDialogOpen, setAssignToSeriesDialogOpen] =
    useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [scrapeTarget, setScrapeTarget] = useState<SeriesWithVolumes | null>(
    null
  )

  useEffect(() => {
    fetchSeries()
  }, [fetchSeries])

  const clearSelection = useCallback(() => {
    setSelectedSeriesIds(new Set())
    setSelectedVolumeIds(new Set())
  }, [])

  const existingEntries = useMemo(() => {
    const assigned = series.flatMap((seriesItem) =>
      seriesItem.volumes.map((volume) => ({
        title: volume.title ?? null,
        isbn: volume.isbn ?? null,
        author: seriesItem.author ?? null
      }))
    )
    const unassigned = unassignedVolumes.map((volume) => ({
      title: volume.title ?? null,
      isbn: volume.isbn ?? null,
      author: null
    }))
    return [...assigned, ...unassigned]
  }, [series, unassignedVolumes])

  const existingIsbns = useMemo(() => {
    const normalized = existingEntries
      .map((item) => item.isbn)
      .filter((isbn): isbn is string => Boolean(isbn))
      .map((isbn) => normalizeIsbn(isbn))
      .filter((isbn) => isbn.length > 0)
    return Array.from(new Set(normalized))
  }, [existingEntries])

  const volumeLookup = useMemo(() => {
    const map = new Map<string, Volume>()
    for (const seriesItem of series) {
      for (const volume of seriesItem.volumes) {
        map.set(volume.id, volume)
      }
    }
    for (const volume of unassignedVolumes) {
      map.set(volume.id, volume)
    }
    return map
  }, [series, unassignedVolumes])

  const selectedIds =
    collectionView === "series" ? selectedSeriesIds : selectedVolumeIds
  const selectedCount = selectedIds.size
  const totalSelectableCount =
    collectionView === "series"
      ? filteredSeries.length
      : filteredVolumes.length + filteredUnassignedVolumes.length
  const isAllSelected =
    totalSelectableCount > 0 && selectedCount === totalSelectableCount

  const selectedUnassignedVolumeIds = useMemo(() => {
    if (collectionView !== "volumes") return []
    if (selectedVolumeIds.size === 0) return []

    return Array.from(selectedVolumeIds).filter((id) => {
      const volume = volumeLookup.get(id)
      return volume != null && !volume.series_id
    })
  }, [collectionView, selectedVolumeIds, volumeLookup])

  const selectedUnassignedCount = selectedUnassignedVolumeIds.length

  const getNextVolumeNumber = useCallback(
    (seriesId: string | null) => {
      if (!seriesId) return 1
      const targetSeries = series.find((item) => item.id === seriesId)
      if (!targetSeries) return 1
      const maxVolume = targetSeries.volumes.reduce(
        (max, volume) => Math.max(max, volume.volume_number),
        0
      )
      return maxVolume + 1
    },
    [series]
  )

  const toggleSeriesSelection = useCallback((seriesId: string) => {
    setSelectedSeriesIds((prev) => {
      const next = new Set(prev)
      if (next.has(seriesId)) {
        next.delete(seriesId)
      } else {
        next.add(seriesId)
      }
      return next
    })
  }, [])

  const toggleVolumeSelection = useCallback((volumeId: string) => {
    setSelectedVolumeIds((prev) => {
      const next = new Set(prev)
      if (next.has(volumeId)) {
        next.delete(volumeId)
      } else {
        next.add(volumeId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (collectionView === "series") {
      setSelectedSeriesIds(new Set(filteredSeries.map((item) => item.id)))
      return
    }

    const nextIds = new Set(filteredVolumes.map((item) => item.volume.id))
    for (const volume of filteredUnassignedVolumes) {
      nextIds.add(volume.id)
    }
    setSelectedVolumeIds(nextIds)
  }, [
    collectionView,
    filteredSeries,
    filteredVolumes,
    filteredUnassignedVolumes
  ])

  const handleClearSelection = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  const applySeriesType = useCallback(
    async (nextType: TitleType) => {
      if (selectedSeriesIds.size === 0) return
      const targets = Array.from(selectedSeriesIds)
      const results = await Promise.allSettled(
        targets.map((id) => editSeries(id, { type: nextType }))
      )
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} series type${successCount === 1 ? "" : "s"}`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} series type update${failureCount === 1 ? "" : "s"} failed`
        )
      }
    },
    [selectedSeriesIds, editSeries]
  )

  const applySeriesVolumesOwnership = useCallback(
    async (status: OwnershipStatus) => {
      if (selectedSeriesIds.size === 0) return
      const targetVolumes: Volume[] = []
      for (const sid of selectedSeriesIds) {
        const targetSeries = series.find((s) => s.id === sid)
        if (targetSeries) {
          targetVolumes.push(...targetSeries.volumes)
        }
      }
      if (targetVolumes.length === 0) return
      const results = await Promise.allSettled(
        targetVolumes.map((volume) =>
          editVolume(volume.series_id ?? null, volume.id, {
            ownership_status: status
          })
        )
      )
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} volume${successCount === 1 ? "" : "s"} to ${status}`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume update${failureCount === 1 ? "" : "s"} failed`
        )
      }
    },
    [selectedSeriesIds, series, editVolume]
  )

  const applySeriesVolumesReadingStatus = useCallback(
    async (status: ReadingStatus) => {
      if (selectedSeriesIds.size === 0) return
      const targetVolumes: Volume[] = []
      for (const sid of selectedSeriesIds) {
        const targetSeries = series.find((s) => s.id === sid)
        if (targetSeries) {
          targetVolumes.push(...targetSeries.volumes)
        }
      }
      if (targetVolumes.length === 0) return
      const results = await Promise.allSettled(
        targetVolumes.map((volume) =>
          editVolume(volume.series_id ?? null, volume.id, {
            reading_status: status,
            ...(status === "completed" &&
            volume.page_count &&
            volume.page_count > 0
              ? { current_page: volume.page_count }
              : {})
          })
        )
      )
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} volume${successCount === 1 ? "" : "s"} to ${status.replace("_", " ")}`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume update${failureCount === 1 ? "" : "s"} failed`
        )
      }
    },
    [selectedSeriesIds, series, editVolume]
  )

  const handleBulkScrapeSelected = useCallback(() => {
    let targets: SeriesWithVolumes[]
    if (collectionView === "series") {
      targets = filteredSeries.filter((s) => selectedSeriesIds.has(s.id))
    } else {
      const seriesMap = new Map<string, SeriesWithVolumes>()
      for (const s of series) {
        const selectedVols = s.volumes.filter((v) =>
          selectedVolumeIds.has(v.id)
        )
        if (selectedVols.length > 0) {
          seriesMap.set(s.id, { ...s, volumes: selectedVols })
        }
      }
      targets = Array.from(seriesMap.values())
    }
    if (targets.length === 0) return

    if (targets.length === 1) {
      setScrapeTarget(targets[0])
      return
    }

    // Combine all volumes into a single synthetic series, tagging each
    // volume with its real series title so the scrape hook uses the
    // correct Amazon search query per volume.
    const allVolumes = targets.flatMap((s) =>
      s.volumes.map((v) => ({ ...v, _seriesTitle: s.title }))
    )
    setScrapeTarget({
      ...targets[0],
      title: `${targets.length} series`,
      volumes: allVolumes
    })
  }, [
    collectionView,
    filteredSeries,
    selectedSeriesIds,
    series,
    selectedVolumeIds
  ])

  const applyVolumeOwnershipStatus = useCallback(
    async (status: OwnershipStatus) => {
      if (selectedVolumeIds.size === 0) return
      const targets = Array.from(selectedVolumeIds)
        .map((id) => volumeLookup.get(id))
        .filter((volume): volume is Volume => Boolean(volume))
      const results = await Promise.allSettled(
        targets.map((volume) =>
          editVolume(volume.series_id ?? null, volume.id, {
            ownership_status: status
          })
        )
      )
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} volume${successCount === 1 ? "" : "s"} to ${status}`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume update${failureCount === 1 ? "" : "s"} failed`
        )
      }
    },
    [selectedVolumeIds, volumeLookup, editVolume]
  )

  const applyVolumeReadingStatus = useCallback(
    async (status: ReadingStatus) => {
      if (selectedVolumeIds.size === 0) return
      const targets = Array.from(selectedVolumeIds)
        .map((id) => volumeLookup.get(id))
        .filter((volume): volume is Volume => Boolean(volume))
      const results = await Promise.allSettled(
        targets.map((volume) =>
          editVolume(volume.series_id ?? null, volume.id, {
            reading_status: status,
            ...(status === "completed" &&
            volume.page_count &&
            volume.page_count > 0
              ? { current_page: volume.page_count }
              : {})
          })
        )
      )
      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Updated ${successCount} volume${successCount === 1 ? "" : "s"} to ${status.replace("_", " ")}`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume update${failureCount === 1 ? "" : "s"} failed`
        )
      }
    },
    [selectedVolumeIds, volumeLookup, editVolume]
  )

  const assignSelectedUnassignedVolumes = useCallback(
    async (targetSeriesId: string) => {
      if (selectedUnassignedVolumeIds.length === 0) return false

      const results = await Promise.allSettled(
        selectedUnassignedVolumeIds.map((volumeId) =>
          editVolume(null, volumeId, { series_id: targetSeriesId })
        )
      )

      const successCount = results.filter(
        (result) => result.status === "fulfilled"
      ).length
      const failureCount = results.length - successCount

      if (successCount > 0) {
        toast.success(
          `Assigned ${successCount} book${successCount === 1 ? "" : "s"} to series`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} assignment${failureCount === 1 ? "" : "s"} failed`
        )
      }

      if (successCount > 0) {
        clearSelection()
      }

      return successCount > 0
    },
    [selectedUnassignedVolumeIds, editVolume, clearSelection]
  )

  const deleteSelectedSeries = useCallback(async () => {
    const targets = Array.from(selectedSeriesIds)
    if (targets.length === 0) return
    const results = await Promise.allSettled(
      targets.map((id) => removeSeries(id))
    )
    const successCount = results.filter(
      (result) => result.status === "fulfilled"
    ).length
    const failureCount = results.length - successCount

    if (successCount > 0) {
      toast.success(
        `Deleted ${successCount} series${successCount === 1 ? "" : "es"}`
      )
    }
    if (failureCount > 0) {
      toast.error(
        `${failureCount} series delete${failureCount === 1 ? "" : "s"} failed`
      )
    }
  }, [selectedSeriesIds, removeSeries])

  const deleteSelectedVolumes = useCallback(async () => {
    const targets = Array.from(selectedVolumeIds)
      .map((id) => volumeLookup.get(id))
      .filter((volume): volume is Volume => Boolean(volume))
    if (targets.length === 0) return
    const results = await Promise.allSettled(
      targets.map((volume) => removeVolume(volume.series_id ?? null, volume.id))
    )
    const successCount = results.filter(
      (result) => result.status === "fulfilled"
    ).length
    const failureCount = results.length - successCount

    if (successCount > 0) {
      toast.success(
        `Deleted ${successCount} volume${successCount === 1 ? "" : "s"}`
      )
    }
    if (failureCount > 0) {
      toast.error(
        `${failureCount} volume delete${failureCount === 1 ? "" : "s"} failed`
      )
    }
  }, [selectedVolumeIds, volumeLookup, removeVolume])

  const performBulkDelete = useCallback(async () => {
    if (collectionView === "series") {
      await deleteSelectedSeries()
    } else {
      await deleteSelectedVolumes()
    }

    clearSelection()
    setBulkDeleteDialogOpen(false)
  }, [
    collectionView,
    deleteSelectedSeries,
    deleteSelectedVolumes,
    clearSelection
  ])

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return
    if (!confirmBeforeDelete) {
      void performBulkDelete()
      return
    }
    setBulkDeleteDialogOpen(true)
  }, [selectedCount, confirmBeforeDelete, performBulkDelete])

  const handleAddSeries = async (
    data: Parameters<typeof createSeries>[0],
    options?: { volumeIds?: string[] }
  ) => {
    try {
      const createdSeries = await createSeries(data)
      toast.success("Series added successfully")

      const volumeIds = Array.from(
        new Set(options?.volumeIds?.filter(Boolean) ?? [])
      )

      if (volumeIds.length > 0) {
        const results = await Promise.allSettled(
          volumeIds.map((volumeId) =>
            editVolume(null, volumeId, { series_id: createdSeries.id })
          )
        )
        const successCount = results.filter(
          (result) => result.status === "fulfilled"
        ).length
        const failureCount = results.length - successCount

        if (successCount > 0) {
          toast.success(
            `Added ${successCount} volume${successCount === 1 ? "" : "s"} to the series`
          )
        }
        if (failureCount > 0) {
          toast.error(
            `${failureCount} volume${failureCount === 1 ? "" : "s"} failed to attach`
          )
        }
      }

      if (pendingSeriesSelection) {
        setSelectedSeriesId(createdSeries.id)
        setPendingSeriesSelection(false)
      }
    } catch {
      toast.error("Failed to add series")
    }
  }

  const handleEditSeries = async (
    data: Parameters<typeof createSeries>[0],
    options?: { volumeIds?: string[] }
  ) => {
    if (!editingSeries) return
    void options
    try {
      await editSeries(editingSeries.id, data)
      toast.success("Series updated successfully")
      setEditingSeries(null)
    } catch {
      toast.error("Failed to update series")
    }
  }

  const handleDeleteSeries = async () => {
    if (!deletingSeries) return
    try {
      await removeSeries(deletingSeries.id)
      toast.success("Series deleted successfully")
      setDeletingSeries(null)
      setDeleteDialogOpen(false)
    } catch {
      toast.error("Failed to delete series")
    }
  }

  const handleAddVolume = async (data: Parameters<typeof createVolume>[1]) => {
    try {
      await createVolume(selectedSeriesId ?? null, data)
      toast.success("Book added successfully")
    } catch {
      toast.error("Failed to add book")
    }
  }

  const handleEditVolume = async (data: Parameters<typeof createVolume>[1]) => {
    if (!editingVolume) return
    const currentSeriesId = editingVolume.series_id ?? null
    const nextSeriesId = selectedSeriesId ?? null

    try {
      await editVolume(currentSeriesId, editingVolume.id, {
        ...data,
        series_id: nextSeriesId
      })
      toast.success("Book updated successfully")
      setEditingVolume(null)
    } catch {
      toast.error("Failed to update book")
    }
  }

  const handleDeleteVolume = async () => {
    if (!deletingVolume) return
    try {
      await removeVolume(deletingVolume.series_id ?? null, deletingVolume.id)
      toast.success("Book deleted successfully")
      setDeletingVolume(null)
      setDeleteVolumeDialogOpen(false)
    } catch {
      toast.error("Failed to delete book")
    }
  }

  const openEditDialog = useCallback((series: SeriesWithVolumes) => {
    setEditingSeries(series)
    setSeriesDialogOpen(true)
  }, [])

  const openDeleteDialog = useCallback(
    async (series: SeriesWithVolumes) => {
      if (!confirmBeforeDelete) {
        try {
          await removeSeries(series.id)
          toast.success("Series deleted successfully")
        } catch {
          toast.error("Failed to delete series")
        }
        return
      }
      setDeletingSeries(series)
      setDeleteDialogOpen(true)
    },
    [confirmBeforeDelete, removeSeries]
  )

  const openEditVolumeDialog = useCallback((volume: Volume) => {
    setEditingVolume(volume)
    setSelectedSeriesId(volume.series_id ?? null)
    setVolumeDialogOpen(true)
  }, [])

  const handleEditSelected = useCallback(() => {
    if (selectedCount !== 1) return

    if (collectionView === "series") {
      const selectedId = Array.from(selectedSeriesIds)[0]
      const selectedSeries = series.find((item) => item.id === selectedId)
      if (selectedSeries) {
        openEditDialog(selectedSeries)
      }
      return
    }

    const selectedId = Array.from(selectedVolumeIds)[0]
    const selectedVolume = volumeLookup.get(selectedId)
    if (selectedVolume) {
      openEditVolumeDialog(selectedVolume)
    }
  }, [
    selectedCount,
    collectionView,
    selectedSeriesIds,
    selectedVolumeIds,
    series,
    volumeLookup,
    openEditDialog,
    openEditVolumeDialog
  ])

  const openDeleteVolumeDialog = useCallback(
    async (volume: Volume) => {
      if (!confirmBeforeDelete) {
        try {
          await removeVolume(volume.series_id ?? null, volume.id)
          toast.success("Book deleted successfully")
        } catch {
          toast.error("Failed to delete book")
        }
        return
      }
      setDeletingVolume(volume)
      setDeleteVolumeDialogOpen(true)
    },
    [confirmBeforeDelete, removeVolume]
  )

  const handleSeriesClick = useCallback(
    (series: SeriesWithVolumes) => {
      setSelectedSeries(series)
      router.push(`/library/series/${series.id}`)
    },
    [setSelectedSeries, router]
  )

  const handleVolumeClick = useCallback(
    (volumeId: string) => {
      router.push(`/library/volume/${volumeId}`)
    },
    [router]
  )

  const handleSeriesItemClick = useCallback(
    (seriesItem: SeriesWithVolumes) => {
      if (selectedSeriesIds.size > 0) {
        toggleSeriesSelection(seriesItem.id)
        return
      }
      handleSeriesClick(seriesItem)
    },
    [selectedSeriesIds.size, toggleSeriesSelection, handleSeriesClick]
  )

  const handleVolumeItemClick = useCallback(
    (volumeId: string) => {
      if (selectedVolumeIds.size > 0) {
        toggleVolumeSelection(volumeId)
        return
      }
      handleVolumeClick(volumeId)
    },
    [selectedVolumeIds.size, toggleVolumeSelection, handleVolumeClick]
  )

  const handleToggleRead = useCallback(
    async (volume: Volume) => {
      const nextStatus =
        volume.reading_status === "completed" ? "unread" : "completed"
      try {
        await editVolume(volume.series_id ?? null, volume.id, {
          reading_status: nextStatus,
          ...(nextStatus === "completed" &&
          volume.page_count &&
          volume.page_count > 0
            ? { current_page: volume.page_count }
            : {})
        })
        toast.success(
          nextStatus === "completed" ? "Marked as read" : "Marked as unread"
        )
      } catch {
        toast.error("Failed to update reading status")
      }
    },
    [editVolume]
  )

  const handleToggleWishlist = useCallback(
    async (volume: Volume) => {
      const nextStatus =
        volume.ownership_status === "wishlist" ? "owned" : "wishlist"
      try {
        await editVolume(volume.series_id ?? null, volume.id, {
          ownership_status: nextStatus
        })
        toast.success(
          nextStatus === "wishlist" ? "Moved to wishlist" : "Marked as owned"
        )
      } catch {
        toast.error("Failed to update ownership status")
      }
    },
    [editVolume]
  )

  const handleSetRating = useCallback(
    async (volume: Volume, rating: number | null) => {
      if (
        rating != null &&
        (!Number.isFinite(rating) || rating < 0 || rating > 10)
      ) {
        toast.error("Rating must be between 0 and 10")
        return
      }

      try {
        await editVolume(volume.series_id ?? null, volume.id, {
          rating
        })
        toast.success(rating == null ? "Rating cleared" : `Rated ${rating}/10`)
      } catch {
        toast.error("Failed to update rating")
      }
    },
    [editVolume]
  )

  const openSeriesScrapeDialog = useCallback(
    (seriesItem: SeriesWithVolumes) => {
      setScrapeTarget(seriesItem)
    },
    []
  )

  const openVolumeScrapeDialog = useCallback(
    (volume: Volume, seriesItem?: SeriesWithVolumes) => {
      if (seriesItem) {
        setScrapeTarget({
          ...seriesItem,
          volumes: [volume]
        })
        return
      }

      const standaloneTitle =
        volume.title?.trim() || `Volume ${volume.volume_number}`
      const standaloneSeries: SeriesWithVolumes = {
        id: `unassigned-${volume.id}`,
        user_id: volume.user_id,
        title: standaloneTitle,
        original_title: null,
        description: null,
        notes: null,
        author: null,
        artist: null,
        publisher: null,
        cover_image_url: volume.cover_image_url,
        type: "other",
        total_volumes: 1,
        status: null,
        tags: [],
        created_at: volume.created_at,
        updated_at: volume.updated_at,
        volumes: [volume]
      }
      setScrapeTarget(standaloneSeries)
    },
    []
  )

  const openAddDialog = useCallback(() => {
    setEditingSeries(null)
    setSearchDialogOpen(true)
  }, [])

  const openAddSeriesDialog = useCallback(() => {
    setEditingSeries(null)
    setPendingSeriesSelection(false)
    setSeriesDialogOpen(true)
  }, [])

  useEffect(() => {
    const addParam = searchParams.get("add")
    if (!addParam) {
      consumedAddParamRef.current = null
      return
    }

    if (consumedAddParamRef.current === addParam) return
    consumedAddParamRef.current = addParam

    if (addParam === "book") {
      globalThis.queueMicrotask(() => openAddDialog())
    } else if (addParam === "series") {
      globalThis.queueMicrotask(() => openAddSeriesDialog())
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete("add")
    const nextQuery = nextParams.toString()
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [openAddDialog, openAddSeriesDialog, pathname, router, searchParams])

  const openManualDialog = useCallback(() => {
    setSearchDialogOpen(false)
    setEditingVolume(null)
    setSelectedSeriesId(null)
    setPendingSeriesSelection(false)
    setVolumeDialogOpen(true)
  }, [])

  const openSeriesDialogFromVolume = useCallback(() => {
    setEditingSeries(null)
    setPendingSeriesSelection(true)
    setSeriesDialogOpen(true)
  }, [])

  const handleSearchSelect = useCallback(
    async (
      result: BookSearchResult,
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      try {
        await addBookFromSearchResult(result, options)
        toast.success("Book added successfully")
      } catch {
        toast.error("Failed to add book")
      }
    },
    [addBookFromSearchResult]
  )

  const handleSearchSelectMany = useCallback(
    async (
      results: BookSearchResult[],
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      const { successCount, failureCount } = await addBooksFromSearchResults(
        results,
        options
      )

      if (successCount > 0) {
        toast.success(
          `${successCount} book${successCount === 1 ? "" : "s"} added`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} book${failureCount === 1 ? "" : "s"} failed to add`
        )
      }
    },
    [addBooksFromSearchResults]
  )

  const renderUnassignedSection = () => {
    if (filteredUnassignedVolumes.length === 0) return null

    return (
      <div className="animate-fade-in-up stagger-3 mt-10 space-y-4 border-t pt-10">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
              Uncategorized
            </span>
            <h2 className="font-display text-lg font-semibold">
              Unassigned Books
            </h2>
          </div>
        </div>
        {filteredUnassignedVolumes.length > VIRTUALIZE_THRESHOLD ? (
          <VirtualizedWindowGrid
            items={filteredUnassignedVolumes}
            columnCount={gridColumnCount}
            gapPx={gridGapPx}
            estimateRowSize={() => estimateGridRowSize(cardSize)}
            getItemKey={(volume) => volume.id}
            renderItem={(volume) => (
              <VolumeCard
                volume={volume}
                onClick={() => handleVolumeItemClick(volume.id)}
                onEdit={() => openEditVolumeDialog(volume)}
                onDelete={() => openDeleteVolumeDialog(volume)}
                onScrapePrice={() => openVolumeScrapeDialog(volume)}
                onToggleRead={() => handleToggleRead(volume)}
                onToggleWishlist={() => handleToggleWishlist(volume)}
                onSetRating={(rating) => handleSetRating(volume, rating)}
                selected={selectedVolumeIds.has(volume.id)}
                onSelect={() => toggleVolumeSelection(volume.id)}
              />
            )}
          />
        ) : (
          <div className={`grid-stagger ${getGridClasses(cardSize)}`}>
            {filteredUnassignedVolumes.map((volume) => (
              <VolumeCard
                key={volume.id}
                volume={volume}
                onClick={() => handleVolumeItemClick(volume.id)}
                onEdit={() => openEditVolumeDialog(volume)}
                onDelete={() => openDeleteVolumeDialog(volume)}
                onScrapePrice={() => openVolumeScrapeDialog(volume)}
                onToggleRead={() => handleToggleRead(volume)}
                onToggleWishlist={() => handleToggleWishlist(volume)}
                onSetRating={(rating) => handleSetRating(volume, rating)}
                selected={selectedVolumeIds.has(volume.id)}
                onSelect={() => toggleVolumeSelection(volume.id)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderVolumesView = () => {
    const hasAssignedVolumes = filteredVolumes.length > 0
    const hasUnassignedVolumes = filteredUnassignedVolumes.length > 0

    if (!hasAssignedVolumes && !hasUnassignedVolumes) {
      return (
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground h-8 w-8"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          }
          title="No volumes found"
          description="Search for a book to add your first volume"
          action={{
            label: "Add Book",
            onClick: openAddDialog
          }}
        />
      )
    }

    return (
      <div className="space-y-8">
        {hasAssignedVolumes &&
          (viewMode === "grid" ? (
            <div className="animate-fade-in-up">
              {filteredVolumes.length > VIRTUALIZE_THRESHOLD ? (
                <VirtualizedWindowGrid
                  items={filteredVolumes}
                  columnCount={gridColumnCount}
                  gapPx={gridGapPx}
                  estimateRowSize={() => estimateGridRowSize(cardSize)}
                  getItemKey={(item) => item.volume.id}
                  renderItem={(item) => (
                    <VolumeGridItem
                      item={item}
                      onClick={() => handleVolumeItemClick(item.volume.id)}
                      onEdit={() => openEditVolumeDialog(item.volume)}
                      onDelete={() => openDeleteVolumeDialog(item.volume)}
                      onScrapePrice={() =>
                        openVolumeScrapeDialog(item.volume, item.series)
                      }
                      onToggleRead={() => handleToggleRead(item.volume)}
                      onToggleWishlist={() => handleToggleWishlist(item.volume)}
                      onSetRating={(rating) =>
                        handleSetRating(item.volume, rating)
                      }
                      amazonDomain={amazonDomain}
                      bindingLabel={amazonBindingLabel}
                      selected={selectedVolumeIds.has(item.volume.id)}
                      onSelect={() => toggleVolumeSelection(item.volume.id)}
                    />
                  )}
                />
              ) : (
                <div className={`grid-stagger ${getGridClasses(cardSize)}`}>
                  {filteredVolumes.map((item) => (
                    <VolumeGridItem
                      key={item.volume.id}
                      item={item}
                      onClick={() => handleVolumeItemClick(item.volume.id)}
                      onEdit={() => openEditVolumeDialog(item.volume)}
                      onDelete={() => openDeleteVolumeDialog(item.volume)}
                      onScrapePrice={() =>
                        openVolumeScrapeDialog(item.volume, item.series)
                      }
                      onToggleRead={() => handleToggleRead(item.volume)}
                      onToggleWishlist={() => handleToggleWishlist(item.volume)}
                      onSetRating={(rating) =>
                        handleSetRating(item.volume, rating)
                      }
                      amazonDomain={amazonDomain}
                      bindingLabel={amazonBindingLabel}
                      selected={selectedVolumeIds.has(item.volume.id)}
                      onSelect={() => toggleVolumeSelection(item.volume.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="animate-fade-in-up">
              {filteredVolumes.length > VIRTUALIZE_THRESHOLD ? (
                <VirtualizedWindowList
                  items={filteredVolumes}
                  estimateSize={() => 104}
                  getItemKey={(item) => item.volume.id}
                  renderItem={(item) => (
                    <div className="pb-2">
                      <VolumeListItem
                        item={item}
                        onClick={() => handleVolumeItemClick(item.volume.id)}
                        onEdit={() => openEditVolumeDialog(item.volume)}
                        onDelete={() => openDeleteVolumeDialog(item.volume)}
                        onScrapePrice={() =>
                          openVolumeScrapeDialog(item.volume, item.series)
                        }
                        onToggleRead={() => handleToggleRead(item.volume)}
                        onToggleWishlist={() =>
                          handleToggleWishlist(item.volume)
                        }
                        onSetRating={(rating) =>
                          handleSetRating(item.volume, rating)
                        }
                        amazonDomain={amazonDomain}
                        bindingLabel={amazonBindingLabel}
                        selected={selectedVolumeIds.has(item.volume.id)}
                        onSelect={() => toggleVolumeSelection(item.volume.id)}
                      />
                    </div>
                  )}
                />
              ) : (
                <div className="list-stagger space-y-2">
                  {filteredVolumes.map((item) => (
                    <VolumeListItem
                      key={item.volume.id}
                      item={item}
                      onClick={() => handleVolumeItemClick(item.volume.id)}
                      onEdit={() => openEditVolumeDialog(item.volume)}
                      onDelete={() => openDeleteVolumeDialog(item.volume)}
                      onScrapePrice={() =>
                        openVolumeScrapeDialog(item.volume, item.series)
                      }
                      onToggleRead={() => handleToggleRead(item.volume)}
                      onToggleWishlist={() => handleToggleWishlist(item.volume)}
                      onSetRating={(rating) =>
                        handleSetRating(item.volume, rating)
                      }
                      amazonDomain={amazonDomain}
                      bindingLabel={amazonBindingLabel}
                      selected={selectedVolumeIds.has(item.volume.id)}
                      onSelect={() => toggleVolumeSelection(item.volume.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        {renderUnassignedSection()}
      </div>
    )
  }

  const renderSeriesView = () => {
    if (filteredSeries.length === 0 && filteredUnassignedVolumes.length === 0) {
      return (
        <EmptyState
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground h-8 w-8"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          }
          title="No series found"
          description="Start building your collection by adding your first series"
          action={{
            label: "Add Book",
            onClick: openAddDialog
          }}
        />
      )
    }

    if (viewMode === "grid") {
      return (
        <div className="space-y-8">
          <div className="animate-fade-in-up">
            <div className="rounded-2xl">
              {filteredSeries.length > VIRTUALIZE_THRESHOLD ? (
                <VirtualizedWindowGrid
                  items={filteredSeries}
                  columnCount={gridColumnCount}
                  gapPx={gridGapPx}
                  estimateRowSize={() => estimateGridRowSize(cardSize)}
                  getItemKey={(series) => series.id}
                  renderItem={(series) => (
                    <SeriesCard
                      series={series}
                      onEdit={() => openEditDialog(series)}
                      onDelete={() => openDeleteDialog(series)}
                      onBulkScrape={() => openSeriesScrapeDialog(series)}
                      onClick={() => handleSeriesItemClick(series)}
                      selected={selectedSeriesIds.has(series.id)}
                      onSelect={() => toggleSeriesSelection(series.id)}
                    />
                  )}
                />
              ) : (
                <div className={`grid-stagger ${getGridClasses(cardSize)}`}>
                  {filteredSeries.map((series) => (
                    <SeriesCard
                      key={series.id}
                      series={series}
                      onEdit={() => openEditDialog(series)}
                      onDelete={() => openDeleteDialog(series)}
                      onBulkScrape={() => openSeriesScrapeDialog(series)}
                      onClick={() => handleSeriesItemClick(series)}
                      selected={selectedSeriesIds.has(series.id)}
                      onSelect={() => toggleSeriesSelection(series.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          {renderUnassignedSection()}
        </div>
      )
    }

    return (
      <div className="space-y-8">
        <div className="animate-fade-in-up">
          {filteredSeries.length > VIRTUALIZE_THRESHOLD ? (
            <VirtualizedWindowList
              items={filteredSeries}
              estimateSize={() => 104}
              getItemKey={(series) => series.id}
              renderItem={(series) => (
                <div className="pb-2">
                  <SeriesListItem
                    series={series}
                    onClick={() => handleSeriesItemClick(series)}
                    onEdit={() => openEditDialog(series)}
                    onDelete={() => openDeleteDialog(series)}
                    selected={selectedSeriesIds.has(series.id)}
                    onSelect={() => toggleSeriesSelection(series.id)}
                  />
                </div>
              )}
            />
          ) : (
            <div className="list-stagger space-y-2">
              {filteredSeries.map((series) => (
                <SeriesListItem
                  key={series.id}
                  series={series}
                  onClick={() => handleSeriesItemClick(series)}
                  onEdit={() => openEditDialog(series)}
                  onDelete={() => openDeleteDialog(series)}
                  selected={selectedSeriesIds.has(series.id)}
                  onSelect={() => toggleSeriesSelection(series.id)}
                />
              ))}
            </div>
          )}
        </div>
        {renderUnassignedSection()}
      </div>
    )
  }

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSkeleton viewMode={viewMode} />
    }

    return collectionView === "volumes"
      ? renderVolumesView()
      : renderSeriesView()
  }

  return (
    <div className="relative px-6 py-8 lg:px-10">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,var(--warm-glow-strong),transparent_70%)]" />

      <div className="mb-10 grid items-end gap-6 lg:grid-cols-12">
        {/* Left: editorial heading — 7 columns */}
        <div className="animate-fade-in-up lg:col-span-7">
          <span className="text-muted-foreground mb-3 block text-xs tracking-widest uppercase">
            Collection
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            My{" "}
            <span className="text-gradient from-copper to-gold bg-linear-to-r">
              Library
            </span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg leading-relaxed">
            Manage your light novel and manga collection
          </p>
        </div>
        {/* Right: quick stats — 5 columns */}
        <div className="animate-fade-in-up stagger-2 hidden lg:col-span-5 lg:flex lg:items-end lg:justify-end lg:gap-6">
          {!isLoading && series.length > 0 && (
            <>
              <div className="text-right">
                <div className="font-display text-primary text-2xl font-bold">
                  {series.length}
                </div>
                <div className="text-muted-foreground text-xs tracking-widest uppercase">
                  Series
                </div>
              </div>
              <div className="bg-border h-8 w-px" />
              <div className="text-right">
                <div className="font-display text-primary text-2xl font-bold">
                  {series.reduce(
                    (sum, s) =>
                      sum +
                      s.volumes.filter((v) => v.ownership_status === "owned")
                        .length,
                    0
                  )}
                </div>
                <div className="text-muted-foreground text-xs tracking-widest uppercase">
                  Owned
                </div>
              </div>
              <div className="bg-border h-8 w-px" />
              <div className="text-right">
                <div className="font-display text-primary text-2xl font-bold">
                  {series.reduce((sum, s) => sum + s.volumes.length, 0)}
                </div>
                <div className="text-muted-foreground text-xs tracking-widest uppercase">
                  Volumes
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <LibraryToolbar
        onAddBook={openAddDialog}
        onAddSeries={openAddSeriesDialog}
        onFindDuplicates={() => setDuplicateDialogOpen(true)}
      />

      <DuplicateMergeDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      />

      {selectedCount > 0 && (
        <div className="animate-fade-in bg-background/90 sticky top-16 z-40 mx-auto my-3 max-w-4xl rounded-2xl border shadow-lg backdrop-blur-md">
          <div className="px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-3">
                <span className="font-display text-sm font-semibold">
                  {selectedCount} selected
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                disabled={totalSelectableCount === 0 || isAllSelected}
                className="rounded-xl"
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                disabled={selectedCount === 0}
                className="rounded-xl"
              >
                Clear
              </Button>

              {collectionView === "volumes" && selectedUnassignedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignToSeriesDialogOpen(true)}
                  className="rounded-xl"
                >
                  Assign to series ({selectedUnassignedCount})
                </Button>
              )}

              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "rounded-xl"
                  })}
                  disabled={selectedCount === 0}
                >
                  Bulk actions
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  {collectionView === "series" ? (
                    <>
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Series type</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => applySeriesType("light_novel")}
                        >
                          Set to Light Novel
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => applySeriesType("manga")}
                        >
                          Set to Manga
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => applySeriesType("other")}
                        >
                          Set to Other
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Set all volumes</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => applySeriesVolumesOwnership("owned")}
                        >
                          Mark all owned
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            applySeriesVolumesOwnership("wishlist")
                          }
                        >
                          Mark all wishlisted
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            applySeriesVolumesReadingStatus("completed")
                          }
                        >
                          Mark all completed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            applySeriesVolumesReadingStatus("unread")
                          }
                        >
                          Mark all unread
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleBulkScrapeSelected}>
                        Bulk scrape prices
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Ownership</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => applyVolumeOwnershipStatus("owned")}
                        >
                          Mark owned
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => applyVolumeOwnershipStatus("wishlist")}
                        >
                          Mark wishlist
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Reading status</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => applyVolumeReadingStatus("unread")}
                        >
                          Mark unread
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => applyVolumeReadingStatus("reading")}
                        >
                          Mark reading
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => applyVolumeReadingStatus("completed")}
                        >
                          Mark completed
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => applyVolumeReadingStatus("on_hold")}
                        >
                          Mark on hold
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => applyVolumeReadingStatus("dropped")}
                        >
                          Mark dropped
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleBulkScrapeSelected}>
                        Bulk scrape prices
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={handleEditSelected}
                disabled={selectedCount !== 1}
                className="rounded-xl"
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={selectedCount === 0}
                className="rounded-xl"
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearSelection()}
                className="rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="my-8 border-t" />
      <div>{renderContent()}</div>

      <BookSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectResult={handleSearchSelect}
        onSelectResults={handleSearchSelectMany}
        onAddManual={openManualDialog}
        context="series"
        existingIsbns={existingIsbns}
      />

      <VolumeDialog
        open={volumeDialogOpen}
        onOpenChange={(open) => {
          setVolumeDialogOpen(open)
          if (!open) {
            setEditingVolume(null)
            setSelectedSeriesId(null)
            setPendingSeriesSelection(false)
          }
        }}
        volume={editingVolume}
        nextVolumeNumber={getNextVolumeNumber(selectedSeriesId)}
        onSubmit={editingVolume ? handleEditVolume : handleAddVolume}
        seriesOptions={series}
        selectedSeriesId={selectedSeriesId}
        onSeriesChange={setSelectedSeriesId}
        onCreateSeries={openSeriesDialogFromVolume}
        allowNoSeries
      />

      <SeriesDialog
        open={seriesDialogOpen}
        onOpenChange={(open) => {
          setSeriesDialogOpen(open)
          if (!open) {
            setEditingSeries(null)
            setPendingSeriesSelection(false)
          }
        }}
        series={editingSeries}
        unassignedVolumes={unassignedVolumes}
        onSubmit={editingSeries ? handleEditSeries : handleAddSeries}
      />

      <AssignToSeriesDialog
        open={assignToSeriesDialogOpen}
        onOpenChange={setAssignToSeriesDialogOpen}
        series={series}
        selectedVolumeCount={selectedUnassignedCount}
        onAssign={assignSelectedUnassignedVolumes}
      />

      <AlertDialog
        open={deleteVolumeDialogOpen}
        onOpenChange={setDeleteVolumeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this book? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVolume}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Series</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingSeries?.title}
              &quot;?{" "}
              {deleteSeriesVolumes
                ? "This will also delete all volumes associated with this series."
                : "The volumes will be kept and moved to Unassigned Books."}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSeries}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {scrapeTarget && (
        <BulkScrapeDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setScrapeTarget(null)
            }
          }}
          series={scrapeTarget}
          editVolume={editVolume}
        />
      )}

      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {collectionView === "series"
                ? "Delete Selected Series"
                : "Delete Selected Books"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {collectionView === "series" ? (
                <>
                  You are about to delete {selectedCount} series. {""}
                  {deleteSeriesVolumes
                    ? "This will also delete all volumes associated with these series."
                    : "The volumes will be kept and moved to Unassigned Books."}{" "}
                  This action cannot be undone.
                </>
              ) : (
                <>
                  You are about to delete {selectedCount} book
                  {selectedCount === 1 ? "" : "s"}. This action cannot be
                  undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={performBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
