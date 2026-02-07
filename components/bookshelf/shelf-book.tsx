"use client"

import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
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
  readonly groupPosition?: "start" | "middle" | "end" | "single"
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
  groupPosition = "single",
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

  const handleToggleOrientation = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation()
    onOrientationChange?.(id, isVertical ? "horizontal" : "vertical")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      onRemove?.(id)
    } else if (e.key === "r" || e.key === "R") {
      onOrientationChange?.(id, isVertical ? "horizontal" : "vertical")
    }
  }

  // Group visual styling
  const groupStyles = isInGroup
    ? {
        start: "rounded-l-sm",
        middle: "rounded-none",
        end: "rounded-r-sm",
        single: "rounded-sm"
      }[groupPosition]
    : "rounded-sm"

  // Draggable element for dnd-kit - event handlers are spread via listeners
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group absolute list-none transition-shadow select-none",
        isDragging && "opacity-75 shadow-md",
        isInGroup && "ring-primary/30 ring-1",
        groupStyles
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
          "cursor-grab bg-transparent p-0 transition-shadow",
          "focus-visible:ring-primary focus:outline-none focus-visible:ring-2",
          isDragging && "cursor-grabbing"
        )}
      >
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden shadow-none",
            groupStyles
          )}
          style={{
            width: bookWidth,
            height: bookHeight,
            backgroundColor: spineColor,
            writingMode: isVertical ? "vertical-rl" : "horizontal-tb",
            textOrientation: "mixed"
          }}
        >
          <span
            className={cn(
              "px-1 text-xs font-medium text-white mix-blend-difference",
              !isVertical && "truncate"
            )}
          >
            {volumeTitle}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={handleToggleOrientation}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        aria-label={getToggleLabel(isVertical)}
        title={getToggleLabel(isVertical)}
        className={cn(
          "border-border absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border",
          "bg-background/90 text-foreground text-xs shadow-sm transition-opacity",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none"
        )}
      >
        ↻
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
          "border-border absolute -top-2 -left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border",
          "bg-background/90 text-foreground text-xs shadow-sm transition-opacity",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none"
        )}
      >
        ×
      </button>
    </li>
  )
}

// Helper to generate a consistent color from a string
function getSpineColor(coverUrl: string | null): string {
  if (!coverUrl) return "#6b7280" // gray-500

  // Simple hash from URL to generate a color
  let hash = 0
  for (let i = 0; i < coverUrl.length; i++) {
    const char = coverUrl.codePointAt(i) ?? 0
    hash = (hash << 5) - hash + char
    hash = Math.trunc(hash) // Remove fractional part (does not limit to 32-bit)
  }

  // Generate HSL color with good saturation and lightness
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 45%, 35%)`
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

function getToggleLabel(isVertical: boolean): string {
  return isVertical ? "Rotate to horizontal" : "Rotate to vertical"
}
