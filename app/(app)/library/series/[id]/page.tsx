"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { VolumeDialog } from "@/components/library/volume-dialog"
import { SeriesDialog } from "@/components/library/series-dialog"
import { BulkScrapeDialog } from "@/components/library/bulk-scrape-dialog"
import { BookSearchDialog } from "@/components/library/book-search-dialog"
import { VolumeCard } from "@/components/library/volume-card"
import { VirtualizedWindowGrid } from "@/components/library/virtualized-window"
import { EmptyState } from "@/components/empty-state"
import { CoverImage } from "@/components/library/cover-image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { useLibrary } from "@/lib/hooks/use-library"
import { useWindowWidth } from "@/lib/hooks/use-window-width"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import { formatDate } from "@/lib/format-date"
import { sanitizeHtml } from "@/lib/sanitize-html"
import { toast } from "sonner"
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
  SeriesInsert,
  Volume,
  VolumeInsert,
  OwnershipStatus,
  ReadingStatus
} from "@/lib/types/database"
import type { DateFormat } from "@/lib/store/settings-store"
import { type BookSearchResult } from "@/lib/books/search"
import { normalizeIsbn } from "@/lib/books/isbn"

/** Tailwind badge color classes keyed by series type. @source */
const typeColors = {
  light_novel: "bg-gold/10 text-gold",
  manga: "bg-copper/10 text-copper",
  other: "bg-muted text-muted-foreground"
}

/** Item count above which series detail volumes switch to virtualization. @source */
const VIRTUALIZE_THRESHOLD = 200

/**
 * Extracts a human-readable message from an unknown error value.
 * @param error - The caught error.
 * @returns The error message string.
 * @source
 */
const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/**
 * Converts a volume number to its string representation.
 * @param value - The numeric volume number.
 * @returns The formatted string.
 * @source
 */
const formatVolumeNumber = (value: number) => value.toString()

/**
 * Builds a compact label like "Vol. 1–5, 7" from a list of volume numbers.
 * @param numbers - Array of volume numbers, potentially unsorted or duplicated.
 * @returns A formatted range string.
 * @source
 */
const buildVolumeRangeLabel = (numbers: number[]) => {
  const uniqueSorted = Array.from(
    new Set(numbers.filter((value) => Number.isFinite(value)))
  ).sort((a, b) => a - b)

  if (uniqueSorted.length === 0) return "—"

  const ranges: Array<{ start: number; end: number }> = []
  let rangeStart = uniqueSorted[0]
  let rangeEnd = uniqueSorted[0]

  for (let index = 1; index < uniqueSorted.length; index += 1) {
    const value = uniqueSorted[index]
    const isConsecutive = Math.abs(value - (rangeEnd + 1)) < 1e-6
    if (isConsecutive) {
      rangeEnd = value
      continue
    }
    ranges.push({ start: rangeStart, end: rangeEnd })
    rangeStart = value
    rangeEnd = value
  }

  ranges.push({ start: rangeStart, end: rangeEnd })

  const formatted = ranges
    .map(({ start, end }) =>
      start === end
        ? formatVolumeNumber(start)
        : `${formatVolumeNumber(start)}–${formatVolumeNumber(end)}`
    )
    .join(", ")

  return `Vol. ${formatted}`
}

/**
 * Returns the first gap in owned volume numbers, starting from 1.
 * @param numbers - Owned volume numbers.
 * @returns The next volume number that should be purchased.
 * @source
 */
const getNextOwnedVolumeNumber = (numbers: number[]) => {
  const ownedIntegers = new Set(
    numbers.filter(
      (value) => Number.isFinite(value) && Number.isInteger(value) && value > 0
    )
  )
  let next = 1
  while (ownedIntegers.has(next)) {
    next += 1
  }
  return next
}

/** Pre-computed collection insight metrics for a series. @source */
type SeriesInsightData = {
  ownedVolumes: number
  wishlistVolumes: number
  readingVolumes: number
  readVolumes: number
  totalVolumes: number
  collectionPercent: number
  missingVolumes: number | null
  totalPages: number
  averageRating: number | null
  latestVolume: Volume | null
  volumeRangeLabel: string
  nextVolumeLabel: string
  nextVolumeNumber: number
  catalogedVolumes: number
  officialTotalVolumes: number | null
  createdLabel: string
  updatedLabel: string
  totalSpent: number
  averagePrice: number
  pricedVolumes: number
  readPercent: number
}

/**
 * Computes collection insight metrics for a series.
 * @param series - The series including its volumes.
 * @param dateFormat - User's preferred date format.
 * @returns Aggregated insight data.
 * @source
 */
const buildSeriesInsights = (
  series: SeriesWithVolumes,
  dateFormat: DateFormat
): SeriesInsightData => {
  const ownedVolumeEntries = series.volumes.filter(
    (volume) => volume.ownership_status === "owned"
  )
  const wishlistVolumes = series.volumes.filter(
    (volume) => volume.ownership_status === "wishlist"
  ).length
  const ownedVolumes = ownedVolumeEntries.length
  const readingVolumes = series.volumes.filter(
    (volume) => volume.reading_status === "reading"
  ).length
  const readVolumes = series.volumes.filter(
    (volume) => volume.reading_status === "completed"
  ).length
  const totalVolumes = series.total_volumes ?? series.volumes.length
  const collectionPercent =
    totalVolumes > 0 ? Math.round((ownedVolumes / totalVolumes) * 100) : 0
  const missingVolumes =
    series.total_volumes && series.total_volumes > 0
      ? Math.max(series.total_volumes - ownedVolumes, 0)
      : null
  const totalPages = series.volumes.reduce(
    (acc, volume) => acc + (volume.page_count ?? 0),
    0
  )
  const totalSpent = series.volumes
    .filter((volume) => volume.ownership_status === "owned")
    .reduce((acc, volume) => acc + (volume.purchase_price ?? 0), 0)
  const pricedVolumeEntries = series.volumes.filter(
    (volume) =>
      volume.ownership_status === "owned" &&
      volume.purchase_price != null &&
      volume.purchase_price > 0
  )
  const pricedVolumes = pricedVolumeEntries.length
  const averagePrice = pricedVolumes > 0 ? totalSpent / pricedVolumes : 0
  const readPercent =
    totalVolumes > 0 ? Math.round((readVolumes / totalVolumes) * 100) : 0
  const ratedVolumes = series.volumes.filter(
    (volume) => typeof volume.rating === "number"
  )
  const averageRating =
    ratedVolumes.length > 0
      ? Math.round(
          (ratedVolumes.reduce((acc, volume) => acc + (volume.rating ?? 0), 0) /
            ratedVolumes.length) *
            10
        ) / 10
      : null
  const latestVolume = series.volumes.reduce<Volume | null>((best, volume) => {
    if (!best || volume.volume_number > best.volume_number) return volume
    return best
  }, null)
  const ownedVolumeNumbers = ownedVolumeEntries
    .map((volume) => volume.volume_number)
    .filter((value) => Number.isFinite(value))
  const nextVolumeNumber = getNextOwnedVolumeNumber(ownedVolumeNumbers)
  const volumeRangeLabel = buildVolumeRangeLabel(ownedVolumeNumbers)
  const nextVolumeLabel =
    series.total_volumes && nextVolumeNumber > series.total_volumes
      ? "Complete"
      : `Vol. ${nextVolumeNumber}`

  return {
    ownedVolumes,
    wishlistVolumes,
    readingVolumes,
    readVolumes,
    totalVolumes,
    collectionPercent,
    missingVolumes,
    totalPages,
    averageRating,
    latestVolume,
    volumeRangeLabel,
    nextVolumeLabel,
    nextVolumeNumber,
    catalogedVolumes: series.volumes.length,
    officialTotalVolumes: series.total_volumes,
    createdLabel: formatDate(series.created_at, dateFormat),
    updatedLabel: formatDate(series.updated_at, dateFormat),
    totalSpent,
    averagePrice,
    pricedVolumes,
    readPercent
  }
}

/**
 * Two-panel insights display showing collection breakdown and series details.
 * @param insights - Pre-computed insight data.
 * @source
 */
const SeriesInsightsPanel = ({
  insights
}: {
  readonly insights: SeriesInsightData
}) => (
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
              <span className="font-medium">{insights.collectionPercent}%</span>
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

/**
 * Selection bar for bulk actions on volumes.
 * Extracted to keep {@link SeriesDetailPage} complexity low.
 * @source
 */
const VolumeSelectionBar = ({
  selectedCount,
  totalSelectableCount,
  isAllSelected,
  onSelectAll,
  onClear,
  onApplyOwnership,
  onApplyReading,
  onEdit,
  onDelete,
  onCancel
}: {
  readonly selectedCount: number
  readonly totalSelectableCount: number
  readonly isAllSelected: boolean
  readonly onSelectAll: () => void
  readonly onClear: () => void
  readonly onApplyOwnership: (status: OwnershipStatus) => void
  readonly onApplyReading: (status: ReadingStatus) => void
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onCancel: () => void
}) => {
  if (selectedCount <= 0) return null

  return (
    <div className="glass-card animate-fade-in-up mb-6 rounded-2xl p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-[11px] tracking-widest uppercase">
            Selection
          </span>
          <span className="font-display text-sm font-semibold">
            {selectedCount} selected
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectAll}
          disabled={totalSelectableCount === 0 || isAllSelected}
          className="rounded-xl"
        >
          Select all
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={selectedCount === 0}
          className="rounded-xl"
        >
          Clear
        </Button>

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
            <DropdownMenuLabel>Ownership</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onApplyOwnership("owned")}>
              Mark owned
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onApplyOwnership("wishlist")}>
              Mark wishlist
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Reading status</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onApplyReading("unread")}>
              Mark unread
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onApplyReading("reading")}>
              Mark reading
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onApplyReading("completed")}>
              Mark completed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onApplyReading("on_hold")}>
              Mark on hold
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onApplyReading("dropped")}>
              Mark dropped
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={selectedCount !== 1}
          className="rounded-xl"
        >
          Edit
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={selectedCount === 0}
          className="rounded-xl"
        >
          Delete
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="rounded-xl"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** Series header section with cover, metadata, stats, insights, and notes. @source */
const SeriesHeaderSection = ({
  currentSeries,
  insights,
  primaryIsbn,
  descriptionHtml,
  formatPrice,
  onEditSeries,
  onDeleteSeries
}: {
  readonly currentSeries: SeriesWithVolumes
  readonly insights: SeriesInsightData
  readonly primaryIsbn: string | null
  readonly descriptionHtml: string
  readonly formatPrice: (value: number) => string
  readonly onEditSeries: () => void
  readonly onDeleteSeries: () => void
}) => (
  <div className="relative mb-10">
    <div className="pointer-events-none absolute -inset-6 -z-10 rounded-3xl bg-[radial-gradient(ellipse_at_30%_50%,var(--warm-glow-strong),transparent_70%)]" />
    <div className="animate-fade-in-up grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Cover Image */}
      <div className="lg:col-span-4">
        <div className="relative">
          <div className="absolute -inset-4 rounded-3xl bg-[radial-gradient(ellipse_at_center,var(--warm-glow-strong),transparent_70%)]" />
          <div className="bg-muted relative aspect-2/3 overflow-hidden rounded-2xl shadow-lg">
            <CoverImage
              isbn={primaryIsbn}
              coverImageUrl={currentSeries.cover_image_url}
              alt={currentSeries.title}
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              fallback={
                <div className="flex h-full items-center justify-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-muted-foreground/50 h-16 w-16"
                  >
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                  </svg>
                </div>
              }
            />
          </div>
        </div>
      </div>

      {/* Series Info */}
      <div className="space-y-4 lg:col-span-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className={typeColors[currentSeries.type]}
              >
                {currentSeries.type === "light_novel" && "Light Novel"}
                {currentSeries.type === "manga" && "Manga"}
                {currentSeries.type === "other" && "Other"}
              </Badge>
              {currentSeries.status && (
                <Badge variant="outline">{currentSeries.status}</Badge>
              )}
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              {currentSeries.title}
            </h1>
            {currentSeries.original_title && (
              <p className="text-muted-foreground mt-1 text-lg">
                {currentSeries.original_title}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
              onClick={onEditSeries}
            >
              Edit Series
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl shadow-sm"
              onClick={onDeleteSeries}
            >
              Delete Series
            </Button>
          </div>
        </div>

        {currentSeries.author && (
          <p className="text-muted-foreground">
            By <span className="text-foreground font-medium">{currentSeries.author}</span>
            {currentSeries.artist && currentSeries.artist !== currentSeries.author && (
              <>
                , illustrated by{" "}
                <span className="text-foreground font-medium">{currentSeries.artist}</span>
              </>
            )}
          </p>
        )}

        {currentSeries.publisher && (
          <p className="text-muted-foreground text-sm">
            Published by {currentSeries.publisher}
          </p>
        )}

        {descriptionHtml && (
          <div
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />
        )}

        {currentSeries.tags.length > 0 && (
          <div className="animate-fade-in stagger-2 flex flex-wrap gap-2">
            {currentSeries.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="badge-pop border-primary/15 rounded-lg"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats strip */}
        <div className="animate-fade-in-up stagger-1 mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-6">
          <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Volumes
            </span>
            <div className="font-display text-xl font-bold">
              {insights.ownedVolumes}
              <span className="text-muted-foreground text-sm font-normal">
                /{insights.totalVolumes}
              </span>
            </div>
            <div className="text-muted-foreground text-[10px]">owned</div>
          </div>
          <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Reading
            </span>
            <div className="font-display text-xl font-bold">
              {insights.readVolumes}
              <span className="text-muted-foreground text-sm font-normal">
                /{insights.totalVolumes}
              </span>
            </div>
            <div className="text-muted-foreground text-[10px]">
              {insights.readPercent}% complete
            </div>
          </div>
          <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Total Spent
            </span>
            <div className="font-display text-xl font-bold">
              {formatPrice(insights.totalSpent)}
            </div>
            <div className="text-muted-foreground text-[10px]">
              {insights.pricedVolumes} priced
            </div>
          </div>
          <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Avg Price
            </span>
            <div className="font-display text-xl font-bold">
              {insights.pricedVolumes > 0 ? formatPrice(insights.averagePrice) : "—"}
            </div>
            <div className="text-muted-foreground text-[10px]">per volume</div>
          </div>
          <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Pages
            </span>
            <div className="font-display text-xl font-bold">
              {insights.totalPages > 0 ? insights.totalPages.toLocaleString() : "—"}
            </div>
            <div className="text-muted-foreground text-[10px]">total</div>
          </div>
          <div className="bg-card hover:bg-accent/50 flex flex-col gap-1 p-4 text-center transition-colors">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Wishlist
            </span>
            <div className="font-display text-xl font-bold">
              {insights.wishlistVolumes}
            </div>
            <div className="text-muted-foreground text-[10px]">items</div>
          </div>
        </div>

        <SeriesInsightsPanel insights={insights} />

        {currentSeries.notes && (
          <div
            className="animate-fade-in-up border-border/60 bg-card/60 mt-6 rounded-2xl border p-5"
            style={{ animationDelay: "400ms", animationFillMode: "both" }}
          >
            <span className="text-muted-foreground block text-xs tracking-widest uppercase">
              Personal
            </span>
            <h2 className="font-display mt-2 text-lg font-semibold tracking-tight">
              Notes
            </h2>
            <p className="text-muted-foreground mt-2 whitespace-pre-line">
              {currentSeries.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
)

/** Series volumes section with selection, bulk actions, and volume grid. @source */
const SeriesVolumesSection = ({
  currentSeries,
  selectedVolumeIds,
  selectedCount,
  totalSelectableCount,
  isAllSelected,
  onOpenBulkScrape,
  onOpenAdd,
  onSelectAll,
  onClearSelection,
  onApplyOwnership,
  onApplyReading,
  onEditSelected,
  onBulkDelete,
  onCancelSelection,
  onVolumeClick,
  onEditVolume,
  onDeleteVolume,
  onToggleRead,
  onSelectVolume
}: {
  readonly currentSeries: SeriesWithVolumes
  readonly selectedVolumeIds: Set<string>
  readonly selectedCount: number
  readonly totalSelectableCount: number
  readonly isAllSelected: boolean
  readonly onOpenBulkScrape: () => void
  readonly onOpenAdd: () => void
  readonly onSelectAll: () => void
  readonly onClearSelection: () => void
  readonly onApplyOwnership: (status: OwnershipStatus) => void
  readonly onApplyReading: (status: ReadingStatus) => void
  readonly onEditSelected: () => void
  readonly onBulkDelete: () => void
  readonly onCancelSelection: () => void
  readonly onVolumeClick: (volumeId: string) => void
  readonly onEditVolume: (volume: Volume) => void
  readonly onDeleteVolume: (volume: Volume) => void
  readonly onToggleRead: (volume: Volume) => void
  readonly onSelectVolume: (volumeId: string) => void
}) => {
  const windowWidth = useWindowWidth()
  const columnCount = useMemo(() => {
    if (windowWidth >= 1024) return 6
    if (windowWidth >= 768) return 4
    if (windowWidth >= 640) return 3
    return 2
  }, [windowWidth])

  const sortedVolumes = useMemo(() => {
    return currentSeries.volumes.toSorted(
      (a, b) => a.volume_number - b.volume_number
    )
  }, [currentSeries.volumes])

  const shouldVirtualize = sortedVolumes.length > VIRTUALIZE_THRESHOLD

  return (
    <div>
    <div className="animate-fade-in-up stagger-2 mb-6 flex items-center justify-between">
      <div>
        <span className="text-muted-foreground mb-1 block text-xs tracking-widest uppercase">
          Collection
        </span>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Volumes
        </h2>
      </div>
      <div className="flex items-center gap-2">
        {currentSeries.volumes.length > 0 && (
          <Button
            variant="outline"
            className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
            onClick={onOpenBulkScrape}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1.5 h-4 w-4"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            Bulk Scrape
          </Button>
        )}
        <Button
          className="rounded-xl shadow-sm hover:shadow-md active:scale-[0.98]"
          onClick={onOpenAdd}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="mr-2 h-4 w-4"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Add Volume
        </Button>
      </div>
    </div>

    <VolumeSelectionBar
      selectedCount={selectedCount}
      totalSelectableCount={totalSelectableCount}
      isAllSelected={isAllSelected}
      onSelectAll={onSelectAll}
      onClear={onClearSelection}
      onApplyOwnership={onApplyOwnership}
      onApplyReading={onApplyReading}
      onEdit={onEditSelected}
      onDelete={onBulkDelete}
      onCancel={onCancelSelection}
    />

    {currentSeries.volumes.length === 0 ? (
      <EmptyState
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-muted-foreground h-8 w-8"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
        }
        title="No volumes yet"
        description="Start tracking your collection by adding volumes"
        action={{
          label: "Add Volume",
          onClick: onOpenAdd
        }}
      />
    ) : (
      <div className="animate-fade-in-up">
        {shouldVirtualize ? (
          <VirtualizedWindowGrid
            items={sortedVolumes}
            columnCount={columnCount}
            gapPx={16}
            estimateRowSize={() => 380}
            getItemKey={(volume) => volume.id}
            renderItem={(volume) => (
              <VolumeCard
                volume={volume}
                seriesTitle={currentSeries.title}
                onClick={() => onVolumeClick(volume.id)}
                onEdit={() => onEditVolume(volume)}
                onDelete={() => onDeleteVolume(volume)}
                onToggleRead={() => onToggleRead(volume)}
                selected={selectedVolumeIds.has(volume.id)}
                onSelect={() => onSelectVolume(volume.id)}
              />
            )}
          />
        ) : (
          <div className="grid-stagger grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {sortedVolumes.map((volume) => (
              <VolumeCard
                key={volume.id}
                volume={volume}
                seriesTitle={currentSeries.title}
                onClick={() => onVolumeClick(volume.id)}
                onEdit={() => onEditVolume(volume)}
                onDelete={() => onDeleteVolume(volume)}
                onToggleRead={() => onToggleRead(volume)}
                selected={selectedVolumeIds.has(volume.id)}
                onSelect={() => onSelectVolume(volume.id)}
              />
            ))}
          </div>
        )}
      </div>
    )}
  </div>
  )
}

/**
 * Series detail page showing cover, metadata, volume grid, and editing controls.
 * @source
 */
export default function SeriesDetailPage() {
  const params = useParams()
  const router = useRouter()
  const rawSeriesId = params?.id
  const seriesId = typeof rawSeriesId === "string" ? rawSeriesId : null

  const {
    series,
    fetchSeries,
    createSeries,
    createVolume,
    editSeries,
    editVolume,
    removeSeries,
    removeVolume,
    addVolumeFromSearchResult,
    addVolumesFromSearchResults,
    isLoading
  } = useLibrary()
  const { selectedSeries, setSelectedSeries, deleteSeriesVolumes } =
    useLibraryStore()
  const dateFormat = useSettingsStore((state) => state.dateFormat)
  const confirmBeforeDelete = useSettingsStore((s) => s.confirmBeforeDelete)
  const priceDisplayCurrency = useLibraryStore(
    (state) => state.priceDisplayCurrency
  )

  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false)
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)
  const [createSeriesDialogOpen, setCreateSeriesDialogOpen] = useState(false)
  const [deleteVolumeDialogOpen, setDeleteVolumeDialogOpen] = useState(false)
  const [deleteSeriesDialogOpen, setDeleteSeriesDialogOpen] = useState(false)
  const [bulkScrapeDialogOpen, setBulkScrapeDialogOpen] = useState(false)
  const [isDeletingSeries, setIsDeletingSeries] = useState(false)
  const [isDeletingVolume, setIsDeletingVolume] = useState(false)
  const [deletingVolume, setDeletingVolume] = useState<Volume | null>(null)
  const [selectedVolumeIds, setSelectedVolumeIds] = useState<Set<string>>(
    () => new Set()
  )
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const isDeletingSeriesRef = useRef(false)

  const currentSeries =
    selectedSeries?.id === seriesId
      ? selectedSeries
      : series.find((s) => s.id === seriesId)

  const insights = useMemo(
    () =>
      currentSeries ? buildSeriesInsights(currentSeries, dateFormat) : null,
    [currentSeries, dateFormat]
  )

  const existingIsbns = useMemo(() => {
    if (!currentSeries) return []
    const normalized = currentSeries.volumes
      .map((volume) => volume.isbn)
      .filter((isbn): isbn is string => Boolean(isbn))
      .map((isbn) => normalizeIsbn(isbn))
      .filter((isbn) => isbn.length > 0)
    return Array.from(new Set(normalized))
  }, [currentSeries])

  const formatPrice = useMemo(() => {
    try {
      const withDecimals = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: priceDisplayCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
      const noDecimals = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: priceDisplayCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
      return (value: number) =>
        Number.isInteger(value)
          ? noDecimals.format(value)
          : withDecimals.format(value)
    } catch {
      const withDecimals = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
      const noDecimals = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
      return (value: number) =>
        Number.isInteger(value)
          ? noDecimals.format(value)
          : withDecimals.format(value)
    }
  }, [priceDisplayCurrency])

  useEffect(() => {
    if (series.length === 0) {
      fetchSeries()
    }
  }, [series.length, fetchSeries])

  useEffect(() => {
    if (currentSeries && currentSeries.id !== selectedSeries?.id) {
      setSelectedSeries(currentSeries)
    }
  }, [currentSeries, selectedSeries?.id, setSelectedSeries])

  useEffect(() => {
    if (!seriesId) {
      router.replace("/library")
    }
  }, [seriesId, router])

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

  const clearSelection = useCallback(() => {
    setSelectedVolumeIds(new Set())
  }, [])

  useEffect(() => {
    clearSelection()
  }, [seriesId, clearSelection])

  const handleAddVolume = async (
    data: Omit<VolumeInsert, "user_id" | "series_id">
  ) => {
    if (!seriesId) {
      const error = new Error("Invalid series id")
      console.error(error)
      toast.error(`Failed to add volume: ${error.message}`)
      return
    }
    try {
      await createVolume(seriesId, data)
      toast.success("Volume added successfully")
    } catch (err) {
      console.error(err)
      toast.error(`Failed to add volume: ${getErrorMessage(err)}`)
    }
  }

  const handleEditVolume = async (
    data: Omit<VolumeInsert, "user_id" | "series_id">
  ) => {
    if (!editingVolume) return
    const currentSeriesId = editingVolume.series_id ?? null
    const nextSeriesId = selectedSeriesId ?? null
    try {
      await editVolume(currentSeriesId, editingVolume.id, {
        ...data,
        series_id: nextSeriesId
      })
      toast.success("Volume updated successfully")
      setEditingVolume(null)
    } catch (err) {
      console.error(err)
      toast.error(`Failed to update volume: ${getErrorMessage(err)}`)
    }
  }

  const handleEditSeries = async (
    data: Omit<SeriesInsert, "user_id">,
    options?: { volumeIds?: string[] }
  ) => {
    if (!currentSeries) return
    void options
    try {
      await editSeries(currentSeries.id, data)
      toast.success("Series updated successfully")
    } catch (err) {
      console.error(err)
      toast.error(`Failed to update series: ${getErrorMessage(err)}`)
    }
  }

  const handleCreateNewSeries = async (data: Omit<SeriesInsert, "user_id">) => {
    try {
      const newSeries = await createSeries(data)
      toast.success("Series created successfully")
      if (editingVolume) {
        setSelectedSeriesId(newSeries.id)
        setCreateSeriesDialogOpen(false)
        setVolumeDialogOpen(true)
      }
    } catch (err) {
      console.error(err)
      toast.error(`Failed to create series: ${getErrorMessage(err)}`)
    }
  }

  const handleDeleteVolume = async () => {
    if (isDeletingVolume) return
    if (!deletingVolume) return
    if (!deletingVolume.series_id) {
      const error = new Error("Missing series id for volume")
      console.error(error)
      toast.error(`Failed to delete volume: ${error.message}`)
      return
    }
    setIsDeletingVolume(true)
    try {
      await removeVolume(deletingVolume.series_id, deletingVolume.id)
      toast.success("Volume deleted successfully")
    } catch (err) {
      console.error(err)
      toast.error(`Failed to delete volume: ${getErrorMessage(err)}`)
    } finally {
      setIsDeletingVolume(false)
      setDeletingVolume(null)
      setDeleteVolumeDialogOpen(false)
    }
  }

  const handleDeleteSeries = useCallback(async () => {
    if (!currentSeries) return false
    try {
      await removeSeries(currentSeries.id)
      toast.success("Series deleted successfully")
      router.push("/library")
      return true
    } catch (err) {
      console.error(err)
      toast.error(`Failed to delete series: ${getErrorMessage(err)}`)
      return false
    }
  }, [currentSeries, removeSeries, router])

  const openEditDialog = useCallback((volume: Volume) => {
    setEditingVolume(volume)
    setSelectedSeriesId(volume.series_id ?? null)
    setVolumeDialogOpen(true)
  }, [])

  const openDeleteDialog = useCallback((volume: Volume) => {
    setDeletingVolume(volume)
    setDeleteVolumeDialogOpen(true)
  }, [])

  const openAddDialog = useCallback(() => {
    setEditingVolume(null)
    setSearchDialogOpen(true)
  }, [])

  const openManualDialog = useCallback(() => {
    setSearchDialogOpen(false)
    setEditingVolume(null)
    setVolumeDialogOpen(true)
  }, [])

  const handleSearchSelect = useCallback(
    async (
      result: BookSearchResult,
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      if (!seriesId) {
        const error = new Error("Invalid series id")
        console.error(error)
        toast.error(`Failed to add volume: ${error.message}`)
        return
      }
      try {
        await addVolumeFromSearchResult(seriesId, result, options)
        toast.success("Volume added successfully")
      } catch (err) {
        console.error(err)
        toast.error(`Failed to add volume: ${getErrorMessage(err)}`)
      }
    },
    [addVolumeFromSearchResult, seriesId]
  )

  const handleSearchSelectMany = useCallback(
    async (
      results: BookSearchResult[],
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      if (!seriesId) {
        const error = new Error("Invalid series id")
        console.error(error)
        toast.error(`Failed to add volume: ${error.message}`)
        return
      }
      const { successCount, failureCount } = await addVolumesFromSearchResults(
        seriesId,
        results,
        options
      )

      if (successCount > 0) {
        toast.success(
          `${successCount} volume${successCount === 1 ? "" : "s"} added`
        )
      }
      if (failureCount > 0) {
        toast.error(
          `${failureCount} volume${failureCount === 1 ? "" : "s"} failed to add`
        )
      }
    },
    [addVolumesFromSearchResults, seriesId]
  )

  const handleToggleRead = useCallback(
    async (volume: Volume) => {
      if (!volume.series_id) return
      const nextStatus =
        volume.reading_status === "completed" ? "unread" : "completed"
      try {
        await editVolume(volume.series_id, volume.id, {
          reading_status: nextStatus
        })
        toast.success(
          nextStatus === "completed" ? "Marked as read" : "Marked as unread"
        )
      } catch (err) {
        console.error(err)
        toast.error(`Failed to update: ${getErrorMessage(err)}`)
      }
    },
    [editVolume]
  )

  const handleVolumeClick = useCallback(
    (volumeId: string) => {
      router.push(`/library/volume/${volumeId}`)
    },
    [router]
  )

  const selectedCount = selectedVolumeIds.size
  const totalSelectableCount = currentSeries?.volumes.length ?? 0
  const isAllSelected =
    totalSelectableCount > 0 && selectedCount === totalSelectableCount

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

  const handleSelectAll = useCallback(() => {
    if (!currentSeries) return
    setSelectedVolumeIds(new Set(currentSeries.volumes.map((volume) => volume.id)))
  }, [currentSeries])

  const handleClearSelection = useCallback(() => {
    clearSelection()
  }, [clearSelection])

  const applyVolumeOwnershipStatus = useCallback(
    async (status: OwnershipStatus) => {
      if (!currentSeries) return
      if (selectedVolumeIds.size === 0) return

      const targets = Array.from(selectedVolumeIds)
        .map((id) => currentSeries.volumes.find((volume) => volume.id === id))
        .filter((volume): volume is Volume => Boolean(volume))

      const results = await Promise.allSettled(
        targets.map((volume) =>
          editVolume(currentSeries.id, volume.id, { ownership_status: status })
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
    [currentSeries, selectedVolumeIds, editVolume]
  )

  const applyVolumeReadingStatus = useCallback(
    async (status: ReadingStatus) => {
      if (!currentSeries) return
      if (selectedVolumeIds.size === 0) return

      const targets = Array.from(selectedVolumeIds)
        .map((id) => currentSeries.volumes.find((volume) => volume.id === id))
        .filter((volume): volume is Volume => Boolean(volume))

      const results = await Promise.allSettled(
        targets.map((volume) =>
          editVolume(currentSeries.id, volume.id, { reading_status: status })
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
    [currentSeries, selectedVolumeIds, editVolume]
  )

  const deleteSelectedVolumes = useCallback(async () => {
    if (!currentSeries) return
    const targets = Array.from(selectedVolumeIds)
      .map((id) => currentSeries.volumes.find((volume) => volume.id === id))
      .filter((volume): volume is Volume => Boolean(volume))
    if (targets.length === 0) return

    const results = await Promise.allSettled(
      targets.map((volume) => removeVolume(currentSeries.id, volume.id))
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
  }, [currentSeries, selectedVolumeIds, removeVolume])

  const performBulkDelete = useCallback(async () => {
    await deleteSelectedVolumes()
    clearSelection()
    setBulkDeleteDialogOpen(false)
  }, [deleteSelectedVolumes, clearSelection])

  const handleBulkDelete = useCallback(() => {
    if (selectedCount === 0) return
    if (!confirmBeforeDelete) {
      void performBulkDelete()
      return
    }
    setBulkDeleteDialogOpen(true)
  }, [selectedCount, confirmBeforeDelete, performBulkDelete])

  const handleEditSelected = useCallback(() => {
    if (!currentSeries) return
    if (selectedVolumeIds.size !== 1) return
    const onlyId = Array.from(selectedVolumeIds)[0]
    const volume = currentSeries.volumes.find((v) => v.id === onlyId)
    if (!volume) return
    openEditDialog(volume)
  }, [currentSeries, selectedVolumeIds, openEditDialog])

  const handleDeleteSeriesConfirm = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      if (isDeletingSeriesRef.current) return
      isDeletingSeriesRef.current = true
      setIsDeletingSeries(true)
      try {
        const wasDeleted = await handleDeleteSeries()
        if (wasDeleted) {
          setDeleteSeriesDialogOpen(false)
        }
      } finally {
        isDeletingSeriesRef.current = false
        setIsDeletingSeries(false)
      }
    },
    [handleDeleteSeries]
  )

  const descriptionHtml = useMemo(
    () => sanitizeHtml(currentSeries?.description ?? "").trim(),
    [currentSeries?.description]
  )

  if (isLoading && !currentSeries) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Skeleton className="aspect-2/3 w-full rounded-lg" />
          </div>
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!currentSeries || !insights) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <EmptyState
          title="Series not found"
          description="The series you're looking for doesn't exist or has been deleted."
          action={{
            label: "Back to Library",
            onClick: () => router.push("/library")
          }}
        />
      </div>
    )
  }

  const primaryVolume = currentSeries.volumes.reduce<Volume | null>(
    (best, volume) => {
      if (!volume.isbn) return best
      if (!best || volume.volume_number < best.volume_number) return volume
      return best
    },
    null
  )
  const primaryIsbn = primaryVolume?.isbn ?? null

  return (
    <div className="relative px-6 py-8 lg:px-10">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_30%_20%,var(--warm-glow-strong),transparent_70%)]" />

      {/* Breadcrumb with Go Back */}
      <nav className="animate-fade-in-down mb-8 flex items-center gap-3 text-xs tracking-wider">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
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
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back
        </button>
        <span className="text-muted-foreground">/</span>
        <Link
          href="/library"
          className="text-muted-foreground hover:text-foreground"
        >
          Library
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{currentSeries.title}</span>
      </nav>

      <SeriesHeaderSection
        currentSeries={currentSeries}
        insights={insights}
        primaryIsbn={primaryIsbn}
        descriptionHtml={descriptionHtml}
        formatPrice={formatPrice}
        onEditSeries={() => setSeriesDialogOpen(true)}
        onDeleteSeries={() => setDeleteSeriesDialogOpen(true)}
      />

      <div className="my-10 border-t" />

      <SeriesVolumesSection
        currentSeries={currentSeries}
        selectedVolumeIds={selectedVolumeIds}
        selectedCount={selectedCount}
        totalSelectableCount={totalSelectableCount}
        isAllSelected={isAllSelected}
        onOpenBulkScrape={() => setBulkScrapeDialogOpen(true)}
        onOpenAdd={openAddDialog}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onApplyOwnership={applyVolumeOwnershipStatus}
        onApplyReading={applyVolumeReadingStatus}
        onEditSelected={handleEditSelected}
        onBulkDelete={handleBulkDelete}
        onCancelSelection={clearSelection}
        onVolumeClick={handleVolumeItemClick}
        onEditVolume={openEditDialog}
        onDeleteVolume={openDeleteDialog}
        onToggleRead={handleToggleRead}
        onSelectVolume={toggleVolumeSelection}
      />

      {/* Book Search Dialog */}
      <BookSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectResult={handleSearchSelect}
        onSelectResults={handleSearchSelectMany}
        onAddManual={openManualDialog}
        context="volume"
        existingIsbns={existingIsbns}
      />

      {/* Add/Edit Volume Dialog */}
      <VolumeDialog
        open={volumeDialogOpen}
        onOpenChange={(open) => {
          setVolumeDialogOpen(open)
          if (!open) {
            setEditingVolume(null)
            setSelectedSeriesId(null)
          }
        }}
        volume={editingVolume}
        nextVolumeNumber={insights.nextVolumeNumber}
        onSubmit={editingVolume ? handleEditVolume : handleAddVolume}
        seriesOptions={editingVolume ? series : undefined}
        selectedSeriesId={editingVolume ? selectedSeriesId : undefined}
        onSeriesChange={editingVolume ? setSelectedSeriesId : undefined}
        onCreateSeries={
          editingVolume
            ? () => {
                setVolumeDialogOpen(false)
                setCreateSeriesDialogOpen(true)
              }
            : undefined
        }
        allowNoSeries={Boolean(editingVolume)}
      />

      <SeriesDialog
        open={seriesDialogOpen}
        onOpenChange={setSeriesDialogOpen}
        series={currentSeries}
        onSubmit={handleEditSeries}
      />

      <SeriesDialog
        open={createSeriesDialogOpen}
        onOpenChange={setCreateSeriesDialogOpen}
        onSubmit={handleCreateNewSeries}
      />

      <BulkScrapeDialog
        open={bulkScrapeDialogOpen}
        onOpenChange={setBulkScrapeDialogOpen}
        series={currentSeries}
        editVolume={editVolume}
      />

      <AlertDialog
        open={deleteSeriesDialogOpen}
        onOpenChange={setDeleteSeriesDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Series</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{currentSeries.title}&quot;?{" "}
              {deleteSeriesVolumes
                ? "This will also delete all volumes associated with this series."
                : "The volumes will be kept and moved to Unassigned Books."}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSeriesConfirm}
              disabled={isDeletingSeries}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteVolumeDialogOpen}
        onOpenChange={setDeleteVolumeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Volume</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Volume{" "}
              {deletingVolume?.volume_number}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVolume}
              disabled={isDeletingVolume}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Volumes</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to delete {selectedCount} volume
              {selectedCount === 1 ? "" : "s"}. This action cannot be undone.
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
