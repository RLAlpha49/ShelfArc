"use client"

import { CoverImage } from "@/components/library/cover-image"
import { SwipeableCard } from "@/components/library/swipeable-card"
import { VolumeActionsMenu } from "@/components/library/volume-actions-menu"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  OwnershipBadge,
  ReadingStatusBadge
} from "@/components/ui/status-badge"
import { buildAmazonSearchUrl } from "@/lib/books/amazon-query"
import type { VolumeWithSeries } from "@/lib/hooks/use-library-filters"
import { normalizeVolumeTitle } from "@/lib/normalize-title"

export interface VolumeListItemProps {
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
 * List-mode row for a single volume with cover thumbnail and metadata.
 */
export function VolumeListItem({
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
}: VolumeListItemProps) {
  const volumeLabel = `Volume ${item.volume.volume_number}`
  const volumeDescriptor = item.volume.title
    ? `${volumeLabel} • ${item.volume.title}`
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
    <SwipeableCard onSwipeRight={onToggleWishlist} onSwipeLeft={onToggleRead}>
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
              <OwnershipBadge status={item.volume.ownership_status} />
              <ReadingStatusBadge status={item.volume.reading_status} />
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
    </SwipeableCard>
  )
}
