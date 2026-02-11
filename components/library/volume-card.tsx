"use client"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { CoverImage } from "@/components/library/cover-image"
import { useSettingsStore } from "@/lib/store/settings-store"
import { useLibraryStore } from "@/lib/store/library-store"
import type { Volume } from "@/lib/types/database"

/** Props for the {@link VolumeCard} component. @source */
interface VolumeCardProps {
  readonly volume: Volume
  readonly seriesTitle?: string
  readonly onClick: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
  readonly onToggleRead?: () => void
  readonly selected?: boolean
  readonly onSelect?: () => void
}

/** Badge color mapping per ownership status. @source */
const OWNERSHIP_COLORS: Record<string, string> = {
  owned: "bg-copper/10 text-copper",
  wishlist: "bg-gold/10 text-gold"
}

/** Badge color mapping per reading status. @source */
const READING_COLORS: Record<string, string> = {
  unread: "bg-muted text-muted-foreground",
  reading: "bg-primary/10 text-primary",
  completed: "bg-copper/10 text-copper",
  on_hold: "bg-gold/10 text-gold",
  dropped: "bg-destructive/10 text-destructive"
}

/**
 * Builds an Amazon search URL for a volume using ISBN or title+number tokens.
 * @param options - Volume metadata used to construct the search query.
 * @returns Fully-qualified Amazon search URL.
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
  selected = false,
  onSelect
}: VolumeCardProps) {
  const showReadingProgress = useSettingsStore((s) => s.showReadingProgress)
  const amazonDomain = useLibraryStore((s) => s.amazonDomain)
  const amazonPreferKindle = useLibraryStore((s) => s.amazonPreferKindle)
  const showSelection = Boolean(onSelect)
  const isCompleted = volume.reading_status === "completed"
  const amazonSearchUrl = buildAmazonSearchUrl({
    amazonDomain,
    isbn: volume.isbn,
    seriesTitle,
    volumeTitle: volume.title,
    volumeNumber: volume.volume_number,
    format: volume.format,
    bindingLabel: amazonPreferKindle ? "Kindle" : "Paperback"
  })
  const amazonLink = volume.amazon_url || amazonSearchUrl
  const amazonLabel = volume.amazon_url
    ? `Open volume ${volume.volume_number} on Amazon`
    : `Search Amazon for volume ${volume.volume_number}`

  return (
    <div className="group relative h-full w-full">
      <button
        type="button"
        className={`group bg-card hover:bg-accent/40 relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl text-left transition-colors ${selected ? "ring-primary/40 ring-offset-background ring-2 ring-offset-2" : ""}`}
        onClick={onClick}
        aria-pressed={showSelection ? selected : undefined}
      >
        {/* Cover Image */}
        <div className="bg-muted relative aspect-2/3">
          <CoverImage
            isbn={volume.isbn}
            coverImageUrl={volume.cover_image_url}
            alt={`Volume ${volume.volume_number}`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            fallback={
              <div className="from-primary/5 to-copper/5 flex h-full items-center justify-center bg-linear-to-br">
                <span className="font-display text-primary/20 text-4xl font-bold">
                  {volume.volume_number}
                </span>
              </div>
            }
          />

          {/* Hover Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100" />

          {showSelection && (
            <div
              className={`absolute top-2 left-2 z-10 transition-opacity ${selected ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => onSelect?.()}
                onClick={(event) => event.stopPropagation()}
                aria-label={`Select volume ${volume.volume_number}`}
                className="h-4 w-4"
              />
            </div>
          )}
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
            <Badge
              variant="secondary"
              className={`rounded-lg text-xs ${OWNERSHIP_COLORS[volume.ownership_status] ?? "bg-muted text-muted-foreground"}`}
            >
              {volume.ownership_status}
            </Badge>
            <Badge
              variant="secondary"
              className={`rounded-lg text-xs ${READING_COLORS[volume.reading_status]}`}
            >
              {volume.reading_status.replace("_", " ")}
            </Badge>
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
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          className="bg-background/80 hover:bg-background text-foreground focus-visible:ring-ring inline-flex h-8 items-center justify-center rounded-xl px-2 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
          onClick={(event) => {
            event.stopPropagation()
            if (amazonLink) {
              window.open(amazonLink, "_blank", "noopener,noreferrer")
            }
          }}
          aria-label={amazonLabel}
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
              className="h-4 w-4"
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
              className="h-4 w-4"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          )}
        </button>
        {onToggleRead && (
          <button
            type="button"
            className="bg-background/80 hover:bg-background text-foreground focus-visible:ring-ring inline-flex h-8 items-center justify-center rounded-xl px-2 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
            onClick={(event) => {
              event.stopPropagation()
              onToggleRead()
            }}
            aria-label={
              isCompleted
                ? `Mark volume ${volume.volume_number} as unread`
                : `Mark volume ${volume.volume_number} as read`
            }
          >
            {isCompleted ? (
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
                className="h-4 w-4"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </button>
        )}
        <button
          type="button"
          className="bg-background/80 hover:bg-background text-foreground focus-visible:ring-ring inline-flex h-8 items-center justify-center rounded-xl px-2 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors focus-visible:ring-1 focus-visible:outline-none"
          onClick={(event) => {
            event.stopPropagation()
            onEdit()
          }}
          aria-label={`Edit volume ${volume.volume_number}`}
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
          aria-label={`Delete volume ${volume.volume_number}`}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
