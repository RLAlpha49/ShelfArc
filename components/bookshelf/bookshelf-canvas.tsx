"use client"

import { useCallback, useMemo } from "react"
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter
} from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import { ShelfRow } from "./shelf-row"
import { detectAdjacentSeriesGroups } from "@/lib/bookshelf/series-grouping"
import type {
  BookshelfWithItems,
  BookOrientation,
  ShelfItemWithVolume
} from "@/lib/types/database"
import {
  BOOK_SPINE_WIDTH,
  BOOK_LENGTH,
  BOOK_GRID_SIZE,
  BOOK_SHELF_PADDING,
  BOOK_MIN_ROW_HEIGHT
} from "./shelf-book"

interface BookshelfCanvasProps {
  readonly bookshelf: BookshelfWithItems
  readonly onItemMove?: (
    itemId: string,
    rowIndex: number,
    positionX: number,
    zIndex?: number
  ) => void
  readonly onItemOrientationChange?: (
    itemId: string,
    orientation: BookOrientation
  ) => void
  readonly onItemRemove?: (itemId: string) => void
  readonly viewMode?: "volumes" | "series"
  readonly disabled?: boolean
  readonly className?: string
}

export function BookshelfCanvas({
  bookshelf,
  onItemMove,
  onItemOrientationChange,
  onItemRemove,
  viewMode = "volumes",
  disabled = false,
  className
}: BookshelfCanvasProps) {
  const { row_count, row_height, row_width, items } = bookshelf
  const rowHeight = Math.max(
    alignToGrid(row_height, BOOK_GRID_SIZE),
    BOOK_MIN_ROW_HEIGHT
  )
  const rowWidth = alignToGrid(row_width, BOOK_GRID_SIZE)

  // Group items by row
  const itemsByRow = useMemo(() => {
    const grouped: Map<number, ShelfItemWithVolume[]> = new Map()
    for (let i = 0; i < row_count; i++) {
      grouped.set(i, [])
    }
    for (const item of items) {
      const rowItems = grouped.get(item.row_index)
      if (rowItems) {
        rowItems.push(item)
      }
    }
    // Sort items by position within each row
    grouped.forEach((rowItems) => {
      rowItems.sort((a, b) => a.position_x - b.position_x)
    })
    return grouped
  }, [items, row_count])

  // Detect series groups for visual grouping
  const seriesGroups = useMemo(() => detectAdjacentSeriesGroups(items), [items])

  // Configure sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor)
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || !onItemMove) return

      const activeData = active.data.current
      if (!isShelfBookDragData(activeData)) return

      const overData = over.data.current
      if (!isShelfRowDragData(overData)) return

      const item = activeData.item
      const newRowIndex = overData.rowIndex
      const itemWidth = getItemWidth(item)
      const rawPositionX = item.position_x + (event.delta?.x ?? 0)
      const desiredX = snapToGrid(rawPositionX, BOOK_GRID_SIZE)
      const minX = BOOK_SHELF_PADDING
      const maxX = rowWidth - itemWidth - BOOK_SHELF_PADDING
      const currentZ = item.z_index ?? 0
      const maxStackLevel =
        Math.max(1, Math.floor(rowHeight / BOOK_GRID_SIZE)) - 1
      const stackDelta =
        item.orientation === "horizontal"
          ? Math.round(-(event.delta?.y ?? 0) / BOOK_GRID_SIZE)
          : 0
      const targetZIndex = clamp(currentZ + stackDelta, 0, maxStackLevel)

      if (desiredX < minX || desiredX > maxX) return

      const rowItems = itemsByRow.get(newRowIndex) ?? []
      const blockingItems =
        item.orientation === "horizontal"
          ? rowItems.filter(
              (rowItem) => (rowItem.z_index ?? 0) === targetZIndex
            )
          : rowItems
      if (!isPositionFree(desiredX, itemWidth, blockingItems, item.id)) return

      if (
        item.orientation === "horizontal" &&
        targetZIndex > 0 &&
        !hasHorizontalSupportInRow({
          positionX: desiredX,
          itemWidth,
          supportItems: rowItems.filter(
            (rowItem) =>
              rowItem.id !== item.id && (rowItem.z_index ?? 0) < targetZIndex
          )
        })
      ) {
        return
      }

      // Only trigger move if something changed
      if (
        item.row_index !== newRowIndex ||
        item.position_x !== desiredX ||
        (item.orientation === "horizontal" && targetZIndex !== currentZ)
      ) {
        onItemMove(item.id, newRowIndex, desiredX, targetZIndex)
      }
    },
    [itemsByRow, onItemMove, rowHeight, rowWidth]
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          "relative inline-block overflow-auto rounded-lg",
          "bg-amber-950 p-4 shadow-2xl",
          "border-8 border-amber-900",
          className
        )}
        style={{
          maxWidth: "100%"
        }}
      >
        {/* Bookshelf frame */}
        <div className="space-y-0">
          {Array.from({ length: row_count }, (_, index) => (
            <ShelfRow
              key={index}
              rowIndex={index}
              items={itemsByRow.get(index) ?? []}
              height={rowHeight}
              width={rowWidth}
              seriesGroups={seriesGroups}
              viewMode={viewMode}
              onItemOrientationChange={onItemOrientationChange}
              onItemRemove={onItemRemove}
              disabled={disabled}
            />
          ))}
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-amber-300/60">
              Drag books here or click &quot;Add Books&quot; to get started
            </p>
          </div>
        )}
      </div>
    </DndContext>
  )
}

function getItemWidth(item: ShelfItemWithVolume): number {
  return item.orientation === "vertical" ? BOOK_SPINE_WIDTH : BOOK_LENGTH
}

function alignToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value
  return Math.ceil(value / gridSize) * gridSize
}

function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value
  return Math.round(value / gridSize) * gridSize
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function hasHorizontalSupportInRow({
  positionX,
  itemWidth,
  supportItems
}: {
  positionX: number
  itemWidth: number
  supportItems: ShelfItemWithVolume[]
}): boolean {
  if (!Number.isFinite(itemWidth) || itemWidth <= 0) return false
  if (supportItems.length === 0) return false

  for (let x = positionX; x < positionX + itemWidth; x += BOOK_GRID_SIZE) {
    const cellStart = x
    const cellEnd = x + BOOK_GRID_SIZE
    const covered = supportItems.some((item) => {
      const start = item.position_x
      const end = item.position_x + getItemWidth(item)
      return cellStart < end && cellEnd > start
    })
    if (!covered) return false
  }

  return true
}

type ShelfBookDragData = {
  type: "shelf-book"
  item: ShelfItemWithVolume
}

type ShelfRowDragData = {
  type: "shelf-row"
  rowIndex: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isShelfBookDragData(value: unknown): value is ShelfBookDragData {
  if (!isRecord(value)) return false
  if (value.type !== "shelf-book") return false
  if (!isRecord(value.item)) return false
  if (typeof value.item.id !== "string") return false
  if (typeof value.item.position_x !== "number") return false
  if (!Number.isFinite(value.item.position_x)) return false
  if (typeof value.item.row_index !== "number") return false
  if (!Number.isFinite(value.item.row_index)) return false
  if (
    value.item.orientation !== "horizontal" &&
    value.item.orientation !== "vertical"
  ) {
    return false
  }
  return true
}

function isShelfRowDragData(value: unknown): value is ShelfRowDragData {
  if (!isRecord(value)) return false
  if (value.type !== "shelf-row") return false
  return typeof value.rowIndex === "number" && Number.isFinite(value.rowIndex)
}

function isPositionFree(
  positionX: number,
  itemWidth: number,
  rowItems: ShelfItemWithVolume[],
  activeId: string
): boolean {
  const itemStart = positionX
  const itemEnd = positionX + itemWidth
  return rowItems.every((item) => {
    if (item.id === activeId) return true
    const otherStart = item.position_x
    const otherEnd = item.position_x + getItemWidth(item)
    return itemEnd <= otherStart || itemStart >= otherEnd
  })
}
