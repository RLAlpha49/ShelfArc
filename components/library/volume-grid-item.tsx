"use client"

import { CoverImage } from "@/components/library/cover-image"
import { VolumeActionsMenu } from "@/components/library/volume-actions-menu"
import { Checkbox } from "@/components/ui/checkbox"
import {
  OwnershipBadge,
  ReadingStatusBadge
} from "@/components/ui/status-badge"
import { buildAmazonSearchUrl } from "@/lib/books/amazon-query"
import { normalizeVolumeTitle } from "@/lib/normalize-title"
import type { VolumeWithSeries } from "@/lib/hooks/use-library-filters"

export interface VolumeGridItemProps {
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
}

/**
 * Grid-mode card for a single volume with cover image and action overlays.
 */
export function VolumeGridItem({
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
}: VolumeGridItemProps) {
  const volumeLabel = `Volume ${item.volume.volume_number}`
  const volumeDescriptor = item.volume.title
    ? `${volumeLabel} • ${normalizeVolumeTitle(item.volume.title)}`
    : volumeLabel
  const coverAlt = `${item.series.title} — ${volumeDescriptor}`
  const showSelection = Boolean(onSelect)
  const isCompleted = item.volume.reading_status === "completed"
  const isWishlisted = item.volume.ownership_status === "wishlist"
  const amazonSearchUrl = buildAmazonSearchUrl({
    domain: amazonDomain,
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
            <OwnershipBadge status={item.volume.ownership_status} />
            <ReadingStatusBadge status={item.volume.reading_status} />
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
