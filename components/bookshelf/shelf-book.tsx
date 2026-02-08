"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { CoverImage } from "@/components/library/cover-image"
import type { ShelfItemWithVolume, BookOrientation } from "@/lib/types/database"

// Book dimensions aligned to the grid
const BOOK_GRID_SIZE = 24
const BOOK_SPINE_WIDTH = BOOK_GRID_SIZE
const BOOK_LENGTH = BOOK_GRID_SIZE * 6
const BOOK_STACK_OFFSET = BOOK_GRID_SIZE
const BOOK_SHELF_PADDING = 0
const BOOK_MIN_ROW_HEIGHT = BOOK_LENGTH

interface ShelfBookProps {
  readonly item: ShelfItemWithVolume
  readonly isInGroup?: boolean
  readonly stackIndex?: number
  readonly stackOffset?: number
  readonly onOrientationChange?: (
    itemId: string,
    orientation: BookOrientation
  ) => void
  readonly onRemove?: (itemId: string) => void
  readonly disabled?: boolean
}

export function ShelfBook({
  item,
  isInGroup = false,
  stackIndex = 0,
  stackOffset = 0,
  onOrientationChange,
  onRemove,
  disabled = false
}: ShelfBookProps) {
  const { volume, orientation, id, position_x } = item

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      data: {
        item,
        type: "shelf-book"
      },
      disabled
    })

  const style = {
    transform: CSS.Translate.toString(transform),
    left: `${position_x}px`,
    bottom: `${stackOffset}px`,
    zIndex: isDragging ? 1000 : item.z_index + stackIndex
  }

  const isVertical = orientation === "vertical"
  const bookHeight = isVertical ? BOOK_LENGTH : BOOK_SPINE_WIDTH
  const bookWidth = isVertical ? BOOK_SPINE_WIDTH : BOOK_LENGTH

  // Generate spine color from cover or series info
  const spineColor = getSpineColor(volume.cover_image_url)
  const volumeTitle = getVolumeTitle(volume)

  const handleDoubleClick = () => {
    onOrientationChange?.(id, isVertical ? "horizontal" : "vertical")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      onRemove?.(id)
    } else if (e.key === "r" || e.key === "R") {
      onOrientationChange?.(id, isVertical ? "horizontal" : "vertical")
    }
  }

  // Draggable element for dnd-kit - event handlers are spread via listeners
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "book-spine-glow group absolute list-none transition-shadow select-none",
        isDragging && "opacity-75 shadow-lg",
        isInGroup && "ring-primary/30 ring-1"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        aria-label={getAriaLabel(volumeTitle, isVertical)}
        aria-keyshortcuts="Delete Backspace R"
        className={cn(
          "block cursor-grab bg-transparent p-0 leading-none transition-shadow",
          "focus-visible:ring-primary focus:outline-none focus-visible:ring-2",
          isDragging && "cursor-grabbing"
        )}
      >
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden shadow-sm"
          )}
          style={{
            width: bookWidth,
            height: bookHeight,
            backgroundColor: spineColor,
            writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
            textOrientation: "mixed"
          }}
        >
          {/* Cover image background */}
          {(volume.cover_image_url || volume.isbn) && (
            <CoverImage
              isbn={volume.isbn}
              coverImageUrl={volume.cover_image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              aria-hidden="true"
            />
          )}
          {/* Title label with scrim for legibility */}
          <span
            className={cn(
              "relative z-10 px-1 text-[10px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]",
              !isVertical && "truncate"
            )}
          >
            {volumeTitle}
          </span>
        </div>
      </button>
      {/* <button
        type="button"
        onClick={handleToggleOrientation}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        aria-label={getToggleLabel(isVertical)}
        title={getToggleLabel(isVertical)}
        className={cn(
          "absolute -top-2.5 -right-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full",
          "bg-card/95 text-foreground shadow-md backdrop-blur-sm transition-opacity",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none"
        )}
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
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onRemove?.(id)
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        aria-label="Remove from shelf"
        title="Remove from shelf"
        className={cn(
          "absolute -top-2.5 -left-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full",
          "bg-card/95 text-foreground shadow-md backdrop-blur-sm transition-opacity",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none"
        )}
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
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button> */}
    </li>
  )
}

// Helper to generate a consistent color from a string
function getSpineColor(coverUrl: string | null): string {
  if (!coverUrl) return "oklch(0.55 0.02 250)" // neutral warm gray

  // Simple hash from URL to generate a color
  let hash = 0
  for (let i = 0; i < coverUrl.length; i++) {
    const char = coverUrl.codePointAt(i) ?? 0
    hash = (hash << 5) - hash + char
    hash = Math.trunc(hash)
  }

  const hue = Math.abs(hash % 360)
  return `oklch(0.45 0.1 ${hue})`
}

export {
  BOOK_SPINE_WIDTH,
  BOOK_LENGTH,
  BOOK_GRID_SIZE,
  BOOK_STACK_OFFSET,
  BOOK_SHELF_PADDING,
  BOOK_MIN_ROW_HEIGHT
}

function getAriaLabel(title: string, isVertical: boolean): string {
  const orientation = isVertical ? "Vertical" : "Horizontal"
  return (
    title + ". " + orientation + " orientation. Press R or use rotate button."
  )
}

function getVolumeTitle(volume: {
  title: string | null
  volume_number: number | null
}): string {
  const title = volume.title?.trim()
  if (title) return title
  if (Number.isFinite(volume.volume_number)) {
    const volumeNumber = volume.volume_number
    const formattedNumber = String(volumeNumber)
    return `Vol. ${formattedNumber}`
  }
  return "Volume"
}
