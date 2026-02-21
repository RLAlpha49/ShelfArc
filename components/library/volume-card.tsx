"use client"

import { CoverImage } from "@/components/library/cover-image"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  OwnershipBadge,
  ReadingStatusBadge
} from "@/components/ui/status-badge"
import { buildAmazonSearchUrl } from "@/lib/books/amazon-query"
import { useLibraryStore } from "@/lib/store/library-store"
import { useSettingsStore } from "@/lib/store/settings-store"
import type { Volume } from "@/lib/types/database"

/** Props for the {@link VolumeCard} component. @source */
interface VolumeCardProps {
  readonly volume: Volume
  readonly seriesTitle?: string
  readonly onClick: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onToggleRead?: () => void
  readonly onToggleWishlist?: () => void
  readonly onSetRating?: (rating: number | null) => void
  readonly onScrapePrice?: () => void
  readonly onMarkAllAboveAsRead?: () => void
  readonly selected?: boolean
  readonly onSelect?: () => void
  readonly priority?: boolean
}

/**
 * Card displaying a single volume with cover, badges, rating, and overlay action buttons.
 * @param props - {@link VolumeCardProps}
 * @source
 */
export function VolumeCard({
  volume,
  seriesTitle,
  onClick,
  onEdit,
  onDelete,
  onToggleRead,
  onToggleWishlist,
  onSetRating,
  onScrapePrice,
  onMarkAllAboveAsRead,
  selected = false,
  onSelect,
  priority = false
}: VolumeCardProps) {
  const showReadingProgress = useSettingsStore((s) => s.showReadingProgress)
  const amazonDomain = useLibraryStore((s) => s.amazonDomain)
  const amazonPreferKindle = useLibraryStore((s) => s.amazonPreferKindle)
  const showSelection = Boolean(onSelect)
  const isCompleted = volume.reading_status === "completed"
  const isWishlisted = volume.ownership_status === "wishlist"
  const amazonSearchUrl = buildAmazonSearchUrl({
    domain: amazonDomain,
    isbn: volume.isbn,
    seriesTitle,
    volumeTitle: volume.title,
    volumeNumber: volume.volume_number,
    format: volume.format,
    bindingLabel: amazonPreferKindle ? "Kindle" : "Paperback"
  })
  const amazonLink = volume.amazon_url || amazonSearchUrl

  return (
    <div className="card-hover hover-lift press-effect group relative h-full w-full">
      {showSelection && (
        <div
          className={`bg-background/80 absolute top-2 left-2 z-10 rounded-lg p-0.5 shadow-sm backdrop-blur-sm transition-all ${selected ? "opacity-100" : "touch-device:opacity-100 opacity-0 group-hover:opacity-100"}`}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect?.()}
            aria-label={`Select volume ${volume.volume_number}`}
            className="border-foreground/50 h-6 w-6 border-2"
          />
        </div>
      )}

      <button
        type="button"
        className={`group bg-card hover:bg-accent/50 relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl text-left transition-all hover:shadow-lg ${selected ? "ring-primary/40 ring-offset-background ring-2 ring-offset-2" : ""}`}
        onClick={onClick}
        aria-pressed={showSelection ? selected : undefined}
      >
        {/* Cover Image */}
        <div className="bg-muted relative aspect-2/3 overflow-hidden">
          <CoverImage
            isbn={volume.isbn}
            coverImageUrl={volume.cover_image_url}
            alt={`Volume ${volume.volume_number}`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            fallback={
              <div className="from-primary/5 to-copper/5 flex h-full items-center justify-center bg-linear-to-br">
                <span className="font-display text-primary/20 text-4xl font-bold">
                  {volume.volume_number}
                </span>
              </div>
            }
          />

          {/* Rating overlay badge */}
          {volume.rating && (
            <div className="absolute top-2 right-2 z-1 flex items-center gap-0.5 rounded-md bg-black/60 px-1.5 py-0.5 backdrop-blur-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-3 w-3 text-amber-400"
                aria-hidden="true"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-xs font-semibold text-white">
                {volume.rating}
              </span>
            </div>
          )}

          {/* Hover Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        {/* Volume Info */}
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold">
              Vol. {volume.volume_number}
            </span>
            {volume.rating && (
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-gold h-3.5 w-3.5"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {volume.rating}
              </span>
            )}
          </div>

          {volume.title && (
            <p className="text-muted-foreground line-clamp-1 text-sm">
              {volume.title}
            </p>
          )}

          <div className="flex flex-wrap gap-1">
            <OwnershipBadge status={volume.ownership_status} />
            <ReadingStatusBadge status={volume.reading_status} />
          </div>

          {/* Reading Progress — shows a completed indicator */}
          {showReadingProgress && isCompleted && (
            <div className="text-copper flex items-center gap-1 text-xs font-medium">
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
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Completed
            </div>
          )}
        </div>
      </button>
      <div className="touch-device:opacity-100 absolute top-2 right-2 z-10 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="bg-background/80 hover:bg-background text-foreground focus-visible:ring-ring touch-device:border touch-device:border-border/50 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl shadow-sm backdrop-blur-sm transition-colors hover:shadow-md focus-visible:ring-1 focus-visible:outline-none"
            onClick={(event) => event.stopPropagation()}
            aria-label={`Actions for volume ${volume.volume_number}`}
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
              {volume.amazon_url ? (
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
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              )}
              {volume.amazon_url ? "Amazon" : "Search Amazon"}
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
                    value={
                      volume.rating == null ? "none" : String(volume.rating)
                    }
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

            {onMarkAllAboveAsRead && (
              <DropdownMenuItem onClick={() => onMarkAllAboveAsRead()}>
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
                  <path d="M18 6 7 17l-5-5" />
                  <path d="m22 10-7.5 7.5L13 16" />
                </svg>
                Mark this and all previous as Read
              </DropdownMenuItem>
            )}

            {(onToggleWishlist || onSetRating || onMarkAllAboveAsRead) && (
              <DropdownMenuSeparator />
            )}

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
