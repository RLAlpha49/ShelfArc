"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { BookshelfCanvas } from "@/components/bookshelf/bookshelf-canvas"
import { BookshelfToolbar } from "@/components/bookshelf/bookshelf-toolbar"
import { BookshelfSettingsDialog } from "@/components/bookshelf/bookshelf-settings-dialog"
import { AddToShelfDialog } from "@/components/bookshelf/add-to-shelf-dialog"
import { EmptyState } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useBookshelf } from "@/lib/hooks/use-bookshelf"
import { useBookshelfStore } from "@/lib/store/bookshelf-store"
import { useLibrary } from "@/lib/hooks/use-library"
import type {
  BookshelfUpdate,
  BookOrientation,
  BookshelfWithItems
} from "@/lib/types/database"
import {
  BOOK_GRID_SIZE,
  BOOK_LENGTH,
  BOOK_SPINE_WIDTH,
  BOOK_SHELF_PADDING
} from "@/components/bookshelf/shelf-book"

if (BOOK_GRID_SIZE <= 0) {
  throw new Error("BOOK_GRID_SIZE must be greater than 0.")
}

export default function BookshelfPage() {
  const {
    bookshelves,
    isLoading,
    fetchBookshelves,
    createBookshelf,
    editBookshelf,
    removeBookshelf,
    addItemsToShelf,
    updateItemPosition,
    updateItemOrientation,
    removeItemFromShelf
  } = useBookshelf()
  const { fetchSeries } = useLibrary()
  const { selectedBookshelfId, setSelectedBookshelfId } = useBookshelfStore()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isNewBookshelf, setIsNewBookshelf] = useState(false)
  const [addBooksOpen, setAddBooksOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"volumes" | "series">("volumes")

  const selectedBookshelf = bookshelves.find(
    (b) => b.id === selectedBookshelfId
  )

  const existingVolumeIds = useMemo(
    () => new Set(selectedBookshelf?.items.map((i) => i.volume_id) ?? []),
    [selectedBookshelf?.items]
  )

  // Fetch data on mount
  useEffect(() => {
    fetchBookshelves().catch(() => {
      toast.error("Failed to load bookshelves")
    })
    fetchSeries().catch(() => {
      toast.error("Failed to load library")
    })
  }, [fetchBookshelves, fetchSeries])

  const handleCreateBookshelf = useCallback(() => {
    setIsNewBookshelf(true)
    setSettingsOpen(true)
  }, [])

  const handleEditBookshelf = useCallback(() => {
    setIsNewBookshelf(false)
    setSettingsOpen(true)
  }, [])

  const handleSaveBookshelf = useCallback(
    async (data: BookshelfUpdate) => {
      try {
        if (isNewBookshelf) {
          await createBookshelf({ name: data.name ?? "New Shelf", ...data })
          toast.success("Bookshelf created")
        } else if (selectedBookshelfId) {
          await editBookshelf(selectedBookshelfId, data)
          toast.success("Bookshelf updated")
        }
      } catch {
        toast.error(
          isNewBookshelf
            ? "Failed to create bookshelf"
            : "Failed to update bookshelf"
        )
      }
    },
    [isNewBookshelf, selectedBookshelfId, createBookshelf, editBookshelf]
  )

  const handleDeleteBookshelf = useCallback(async () => {
    if (!selectedBookshelfId) return
    try {
      await removeBookshelf(selectedBookshelfId)
      toast.success("Bookshelf deleted")
    } catch {
      toast.error("Failed to delete bookshelf")
    }
  }, [selectedBookshelfId, removeBookshelf])

  const handleAddBooks = useCallback(
    async (volumeIds: string[]) => {
      if (!selectedBookshelf) return

      const rowWidth = alignToGrid(selectedBookshelf.row_width)
      const rowCount = selectedBookshelf.row_count
      const nextItems: PlacementItem[] = [...selectedBookshelf.items]
      const items: Array<{
        volumeId: string
        rowIndex: number
        positionX: number
        orientation: "vertical"
      }> = []

      for (const volumeId of volumeIds) {
        const slot = findNextAvailableSlot({
          items: nextItems,
          rowCount,
          rowWidth,
          itemWidth: BOOK_SPINE_WIDTH,
          preferredRow: 0
        })

        if (!slot) break

        items.push({
          volumeId,
          rowIndex: slot.rowIndex,
          positionX: slot.positionX,
          orientation: "vertical"
        })

        nextItems.push({
          id: volumeId,
          row_index: slot.rowIndex,
          position_x: slot.positionX,
          orientation: "vertical"
        })
      }

      if (items.length === 0) {
        toast.error("No space available on this bookshelf")
        return
      }

      try {
        await addItemsToShelf(selectedBookshelf.id, items)
        toast.success("Books added to shelf")
        if (items.length < volumeIds.length) {
          toast.warning("Some books could not be added due to limited space")
        }
      } catch {
        toast.error("Failed to add books")
      }
    },
    [selectedBookshelf, addItemsToShelf]
  )

  const handleItemMove = useCallback(
    async (
      itemId: string,
      rowIndex: number,
      positionX: number,
      zIndex?: number
    ) => {
      if (!selectedBookshelfId) return
      try {
        await updateItemPosition(
          selectedBookshelfId,
          itemId,
          rowIndex,
          positionX,
          zIndex
        )
      } catch {
        toast.error("Failed to move book")
      }
    },
    [selectedBookshelfId, updateItemPosition]
  )

  const handleItemOrientationChange = useCallback(
    async (itemId: string, orientation: BookOrientation) => {
      if (!selectedBookshelfId) return
      const shelf = selectedBookshelf
      const item = shelf?.items.find((current) => current.id === itemId)
      if (!shelf || !item) return

      const rowWidth = alignToGrid(shelf.row_width)
      const itemWidth = getItemWidthForOrientation(orientation)
      const desiredX = snapToGrid(item.position_x)

      const itemsByRow = groupItemsByRow(shelf.items)
      const rowItems = itemsByRow.get(item.row_index) ?? []
      const orientationError = getOrientationChangeError({
        desiredX,
        rowWidth,
        itemWidth,
        item,
        rowItems,
        orientation
      })
      if (orientationError) {
        toast.error(orientationError)
        return
      }

      const originalPosition = {
        rowIndex: item.row_index,
        positionX: item.position_x,
        zIndex: item.z_index
      }
      const moveNeeded = desiredX !== item.position_x
      let moved = false
      let orientationAttempted = false

      try {
        if (moveNeeded) {
          await updateItemPosition(
            selectedBookshelfId,
            item.id,
            item.row_index,
            desiredX,
            item.z_index
          )
          moved = true
        }
        orientationAttempted = true
        await updateItemOrientation(selectedBookshelfId, itemId, orientation)
      } catch {
        if (!orientationAttempted) {
          toast.error("Failed to move book for orientation change")
          return
        }

        if (moved) {
          try {
            await updateItemPosition(
              selectedBookshelfId,
              item.id,
              originalPosition.rowIndex,
              originalPosition.positionX,
              originalPosition.zIndex
            )
            toast.error(
              "Failed to update book orientation. Position was restored."
            )
          } catch {
            toast.error(
              "Failed to update book orientation and restore position"
            )
          }
        } else {
          toast.error("Failed to update book orientation")
        }
      }
    },
    [
      selectedBookshelf,
      selectedBookshelfId,
      updateItemOrientation,
      updateItemPosition
    ]
  )

  const handleItemRemove = useCallback(
    async (itemId: string) => {
      if (!selectedBookshelfId) return
      try {
        await removeItemFromShelf(selectedBookshelfId, itemId)
        toast.success("Book removed from shelf")
      } catch {
        toast.error("Failed to remove book")
      }
    },
    [selectedBookshelfId, removeItemFromShelf]
  )

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-10 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Bookshelf
        </h1>
        <p className="text-muted-foreground mt-1">
          Organize your books on virtual bookshelves
        </p>
      </div>

      <BookshelfToolbar
        bookshelves={bookshelves}
        selectedBookshelfId={selectedBookshelfId}
        onBookshelfSelect={setSelectedBookshelfId}
        onCreateBookshelf={handleCreateBookshelf}
        onEditBookshelf={handleEditBookshelf}
        onDeleteBookshelf={handleDeleteBookshelf}
        onAddBooks={() => setAddBooksOpen(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        disabled={isLoading}
      />

      {renderBookshelfContent(
        bookshelves,
        selectedBookshelf,
        handleCreateBookshelf,
        handleItemMove,
        handleItemOrientationChange,
        handleItemRemove,
        viewMode
      )}

      <BookshelfSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        bookshelf={isNewBookshelf ? null : selectedBookshelf}
        onSave={handleSaveBookshelf}
        onDelete={handleDeleteBookshelf}
        isNew={isNewBookshelf}
      />

      {selectedBookshelf && (
        <AddToShelfDialog
          open={addBooksOpen}
          onOpenChange={setAddBooksOpen}
          existingVolumeIds={existingVolumeIds}
          onAdd={handleAddBooks}
        />
      )}
    </div>
  )
}

function renderBookshelfContent(
  bookshelves: BookshelfWithItems[],
  selectedBookshelf: BookshelfWithItems | undefined,
  handleCreateBookshelf: () => void,
  handleItemMove: (
    itemId: string,
    rowIndex: number,
    positionX: number,
    zIndex?: number
  ) => Promise<void>,
  handleItemOrientationChange: (
    itemId: string,
    orientation: BookOrientation
  ) => Promise<void>,
  handleItemRemove: (itemId: string) => Promise<void>,
  viewMode: "volumes" | "series"
) {
  if (bookshelves.length === 0) {
    return (
      <EmptyState
        title="No bookshelves yet"
        description="Create your first virtual bookshelf to start organizing your collection."
        action={{
          label: "Create Bookshelf",
          onClick: handleCreateBookshelf
        }}
      />
    )
  }

  if (!selectedBookshelf) {
    return (
      <EmptyState
        title="Select a bookshelf"
        description="Choose a bookshelf from the dropdown above to view and organize your books."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <BookshelfCanvas
        bookshelf={selectedBookshelf}
        onItemMove={handleItemMove}
        onItemOrientationChange={handleItemOrientationChange}
        onItemRemove={handleItemRemove}
        viewMode={viewMode}
      />
    </div>
  )
}

type PlacementItem = {
  id: string
  row_index: number
  position_x: number
  orientation: BookOrientation
  z_index?: number
}

function getOrientationChangeError({
  desiredX,
  rowWidth,
  itemWidth,
  item,
  rowItems,
  orientation
}: {
  desiredX: number
  rowWidth: number
  itemWidth: number
  item: PlacementItem
  rowItems: PlacementItem[]
  orientation: BookOrientation
}): string | null {
  const minX = BOOK_SHELF_PADDING
  const maxX = rowWidth - itemWidth - BOOK_SHELF_PADDING

  if (desiredX < minX || desiredX > maxX) {
    return "No space available for this orientation"
  }

  const targetZIndex = item.z_index ?? 0
  const blockingItems =
    orientation === "horizontal"
      ? rowItems.filter((rowItem) => (rowItem.z_index ?? 0) === targetZIndex)
      : rowItems

  if (!isPositionFree(desiredX, itemWidth, blockingItems, item.id)) {
    return "No space available for this orientation"
  }

  if (
    orientation === "horizontal" &&
    targetZIndex > 0 &&
    !hasHorizontalSupportInRow({
      positionX: desiredX,
      itemWidth,
      supportItems: rowItems.filter(
        (rowItem) => (rowItem.z_index ?? 0) < targetZIndex
      )
    })
  ) {
    return "Horizontal books need support from the grid below"
  }

  return null
}

function alignToGrid(value: number): number {
  const step = getGridStep()
  return Math.ceil(value / step) * step
}

function snapToGrid(value: number): number {
  const step = getGridStep()
  return Math.round(value / step) * step
}

function getGridStep(): number {
  return BOOK_GRID_SIZE
}

function getItemWidthForOrientation(orientation: BookOrientation): number {
  return orientation === "vertical" ? BOOK_SPINE_WIDTH : BOOK_LENGTH
}

function groupItemsByRow(items: PlacementItem[]): Map<number, PlacementItem[]> {
  const rows = new Map<number, PlacementItem[]>()
  for (const item of items) {
    const rowItems = rows.get(item.row_index) ?? []
    rowItems.push(item)
    rows.set(item.row_index, rowItems)
  }
  return rows
}

function findNextAvailableSlot({
  items,
  rowCount,
  rowWidth,
  itemWidth,
  preferredRow
}: {
  items: PlacementItem[]
  rowCount: number
  rowWidth: number
  itemWidth: number
  preferredRow: number
}): { rowIndex: number; positionX: number } | null {
  const itemsByRow = groupItemsByRow(items)
  const rowOrder = Array.from(
    { length: rowCount },
    (_, index) => (preferredRow + index) % rowCount
  )

  for (const rowIndex of rowOrder) {
    const rowItems = itemsByRow.get(rowIndex) ?? []
    const minX = BOOK_SHELF_PADDING
    const maxX = rowWidth - itemWidth - BOOK_SHELF_PADDING
    const gridStep = getGridStep()
    for (let x = minX; x <= maxX; x += gridStep) {
      if (isPositionFree(x, itemWidth, rowItems, "")) {
        return { rowIndex, positionX: x }
      }
    }
  }

  return null
}

function hasHorizontalSupportInRow({
  positionX,
  itemWidth,
  supportItems
}: {
  positionX: number
  itemWidth: number
  supportItems: PlacementItem[]
}): boolean {
  if (supportItems.length === 0) return false

  const gridStep = getGridStep()

  for (let x = positionX; x < positionX + itemWidth; x += gridStep) {
    const cellStart = x
    const cellEnd = x + gridStep
    const covered = supportItems.some((item) => {
      const start = item.position_x
      const end = item.position_x + getItemWidthForOrientation(item.orientation)
      return cellStart < end && cellEnd > start
    })
    if (!covered) return false
  }

  return true
}

function isPositionFree(
  positionX: number,
  itemWidth: number,
  rowItems: PlacementItem[],
  activeId: string
): boolean {
  const itemStart = positionX
  const itemEnd = positionX + itemWidth
  return rowItems.every((item) => {
    if (item.id === activeId) return true
    const otherStart = item.position_x
    const otherEnd =
      item.position_x + getItemWidthForOrientation(item.orientation)
    return itemEnd <= otherStart || itemStart >= otherEnd
  })
}
