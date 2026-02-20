"use client"

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

export interface VolumeActionsMenuProps {
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
}

/** Action menu for a volume row/card (toggle read/wishlist, rating, edit/delete). */
export function VolumeActionsMenu({
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
}: VolumeActionsMenuProps) {
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
                <DropdownMenuRadioItem value="0">0</DropdownMenuRadioItem>
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
