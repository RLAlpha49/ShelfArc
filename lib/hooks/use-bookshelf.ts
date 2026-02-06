"use client"

import { useCallback } from "react"
import { useBookshelfStore } from "@/lib/store/bookshelf-store"
import type {
  BookshelfWithItems,
  BookshelfInsert,
  BookshelfUpdate,
  ShelfItemWithVolume,
  BookOrientation
} from "@/lib/types/database"

export function useBookshelf() {
  const {
    bookshelves,
    setBookshelves,
    addBookshelf,
    updateBookshelf,
    deleteBookshelf,
    addShelfItem,
    addShelfItems,
    updateShelfItem,
    removeShelfItem,
    moveShelfItem,
    isLoading,
    setIsLoading
  } = useBookshelfStore()

  const fetchBookshelves = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/bookshelves")
      const data = (await response.json()) as {
        bookshelves?: BookshelfWithItems[]
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fetch bookshelves")
      }

      setBookshelves(data.bookshelves ?? [])
    } catch (error) {
      console.error("Failed to fetch bookshelves:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [setBookshelves, setIsLoading])

  const createBookshelf = useCallback(
    async (data: Omit<BookshelfInsert, "user_id">) => {
      const response = await fetch("/api/bookshelves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })

      const result = (await response.json()) as {
        bookshelf?: BookshelfWithItems
        error?: string
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to create bookshelf")
      }

      if (result.bookshelf) {
        addBookshelf(result.bookshelf)
      }

      return result.bookshelf
    },
    [addBookshelf]
  )

  const editBookshelf = useCallback(
    async (id: string, data: BookshelfUpdate) => {
      const response = await fetch(`/api/bookshelves/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })

      const result = (await response.json()) as {
        bookshelf?: BookshelfWithItems
        error?: string
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to update bookshelf")
      }

      if (result.bookshelf) {
        updateBookshelf(id, result.bookshelf)
      }

      return result.bookshelf
    },
    [updateBookshelf]
  )

  const removeBookshelf = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/bookshelves/${id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        throw new Error(result.error ?? "Failed to delete bookshelf")
      }

      deleteBookshelf(id)
    },
    [deleteBookshelf]
  )

  const addItemToShelf = useCallback(
    async (
      bookshelfId: string,
      volumeId: string,
      rowIndex: number,
      positionX: number,
      orientation: BookOrientation = "vertical"
    ) => {
      const response = await fetch(`/api/bookshelves/${bookshelfId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volume_id: volumeId,
          row_index: rowIndex,
          position_x: positionX,
          orientation
        })
      })

      const result = (await response.json()) as {
        items?: ShelfItemWithVolume[]
        error?: string
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to add item to shelf")
      }

      if (result.items?.[0]) {
        addShelfItem(bookshelfId, result.items[0])
      }

      return result.items?.[0]
    },
    [addShelfItem]
  )

  const addItemsToShelf = useCallback(
    async (
      bookshelfId: string,
      items: Array<{
        volumeId: string
        rowIndex: number
        positionX: number
        orientation?: BookOrientation
      }>
    ) => {
      const response = await fetch(`/api/bookshelves/${bookshelfId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          items.map((item) => ({
            volume_id: item.volumeId,
            row_index: item.rowIndex,
            position_x: item.positionX,
            orientation: item.orientation ?? "vertical"
          }))
        )
      })

      const result = (await response.json()) as {
        items?: ShelfItemWithVolume[]
        error?: string
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Failed to add items to shelf")
      }

      if (result.items && result.items.length > 0) {
        addShelfItems(bookshelfId, result.items)
      }

      return result.items
    },
    [addShelfItems]
  )

  const updateItemPosition = useCallback(
    async (
      bookshelfId: string,
      itemId: string,
      rowIndex: number,
      positionX: number,
      zIndex?: number
    ) => {
      // Optimistic update
      moveShelfItem(bookshelfId, itemId, rowIndex, positionX, zIndex)

      const response = await fetch(`/api/bookshelves/${bookshelfId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [
            {
              id: itemId,
              row_index: rowIndex,
              position_x: positionX,
              z_index: zIndex
            }
          ]
        })
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        const message = result.error ?? "Failed to update item position"
        // Refetch to restore correct state on failure
        try {
          await fetchBookshelves()
        } catch (refetchError) {
          console.error(
            "Failed to refetch bookshelves after item position update error:",
            refetchError
          )
        }
        throw new Error(message)
      }
    },
    [moveShelfItem, fetchBookshelves]
  )

  const updateItemOrientation = useCallback(
    async (
      bookshelfId: string,
      itemId: string,
      orientation: BookOrientation
    ) => {
      // Optimistic update
      updateShelfItem(bookshelfId, itemId, { orientation })

      const response = await fetch(`/api/bookshelves/${bookshelfId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ id: itemId, orientation }]
        })
      })

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        const message = result.error ?? "Failed to update item orientation"
        // Refetch to restore correct state on failure
        try {
          await fetchBookshelves()
        } catch (refetchError) {
          console.error(
            "Failed to refetch bookshelves after item orientation update error:",
            refetchError
          )
        }
        throw new Error(message)
      }
    },
    [updateShelfItem, fetchBookshelves]
  )

  const removeItemFromShelf = useCallback(
    async (bookshelfId: string, itemId: string) => {
      const encodedItemId = encodeURIComponent(itemId)
      const response = await fetch(
        `/api/bookshelves/${bookshelfId}/items?itemId=${encodedItemId}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const result = (await response.json()) as { error?: string }
        throw new Error(result.error ?? "Failed to remove item from shelf")
      }

      removeShelfItem(bookshelfId, itemId)
    },
    [removeShelfItem]
  )

  return {
    bookshelves,
    isLoading,
    fetchBookshelves,
    createBookshelf,
    editBookshelf,
    removeBookshelf,
    addItemToShelf,
    addItemsToShelf,
    updateItemPosition,
    updateItemOrientation,
    removeItemFromShelf
  }
}
