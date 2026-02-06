import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  Bookshelf,
  BookshelfWithItems,
  ShelfItem,
  ShelfItemWithVolume
} from "@/lib/types/database"

interface BookshelfState {
  // Data
  bookshelves: BookshelfWithItems[]
  selectedBookshelfId: string | null
  isLoading: boolean

  // Selector-derived computed values are exposed via hooks below.
  // Actions
  setBookshelves: (bookshelves: BookshelfWithItems[]) => void
  addBookshelf: (bookshelf: BookshelfWithItems) => void
  updateBookshelf: (id: string, updates: Partial<Bookshelf>) => void
  deleteBookshelf: (id: string) => void

  addShelfItem: (bookshelfId: string, item: ShelfItemWithVolume) => void
  addShelfItems: (bookshelfId: string, items: ShelfItemWithVolume[]) => void
  updateShelfItem: (
    bookshelfId: string,
    itemId: string,
    updates: Partial<ShelfItem>
  ) => void
  removeShelfItem: (bookshelfId: string, itemId: string) => void
  moveShelfItem: (
    bookshelfId: string,
    itemId: string,
    rowIndex: number,
    positionX: number,
    zIndex?: number
  ) => void

  setSelectedBookshelfId: (id: string | null) => void
  setIsLoading: (loading: boolean) => void
}

export const useBookshelfStore = create<BookshelfState>()(
  persist(
    (set) => ({
      // Initial state
      bookshelves: [],
      selectedBookshelfId: null,
      isLoading: false,

      // Actions
      setBookshelves: (bookshelves) =>
        set((state) => ({
          bookshelves,
          // Auto-select first shelf if none selected
          selectedBookshelfId:
            state.selectedBookshelfId ||
            (bookshelves.length > 0 ? bookshelves[0].id : null)
        })),

      addBookshelf: (bookshelf) =>
        set((state) => ({
          bookshelves: [...state.bookshelves, bookshelf],
          // Auto-select if first shelf
          selectedBookshelfId: state.selectedBookshelfId || bookshelf.id
        })),

      updateBookshelf: (id, updates) =>
        set((state) => ({
          bookshelves: state.bookshelves.map((shelf) =>
            shelf.id === id ? { ...shelf, ...updates } : shelf
          )
        })),

      deleteBookshelf: (id) =>
        set((state) => {
          const newBookshelves = state.bookshelves.filter(
            (shelf) => shelf.id !== id
          )
          const newSelectedId =
            state.selectedBookshelfId === id
              ? (newBookshelves[0]?.id ?? null)
              : state.selectedBookshelfId
          return {
            bookshelves: newBookshelves,
            selectedBookshelfId: newSelectedId
          }
        }),

      addShelfItem: (bookshelfId, item) =>
        set((state) => ({
          bookshelves: state.bookshelves.map((shelf) =>
            shelf.id === bookshelfId
              ? { ...shelf, items: [...shelf.items, item] }
              : shelf
          )
        })),

      addShelfItems: (bookshelfId, items) =>
        set((state) => ({
          bookshelves: state.bookshelves.map((shelf) =>
            shelf.id === bookshelfId
              ? { ...shelf, items: [...shelf.items, ...items] }
              : shelf
          )
        })),

      updateShelfItem: (bookshelfId, itemId, updates) =>
        set((state) => ({
          bookshelves: state.bookshelves.map((shelf) =>
            shelf.id === bookshelfId
              ? {
                  ...shelf,
                  items: shelf.items.map((item) =>
                    item.id === itemId ? { ...item, ...updates } : item
                  )
                }
              : shelf
          )
        })),

      removeShelfItem: (bookshelfId, itemId) =>
        set((state) => ({
          bookshelves: state.bookshelves.map((shelf) =>
            shelf.id === bookshelfId
              ? {
                  ...shelf,
                  items: shelf.items.filter((item) => item.id !== itemId)
                }
              : shelf
          )
        })),

      moveShelfItem: (bookshelfId, itemId, rowIndex, positionX, zIndex) =>
        set((state) => ({
          bookshelves: state.bookshelves.map((shelf) =>
            shelf.id === bookshelfId
              ? {
                  ...shelf,
                  items: shelf.items.map((item) =>
                    item.id === itemId
                      ? {
                          ...item,
                          row_index: rowIndex,
                          position_x: positionX,
                          z_index: zIndex ?? item.z_index
                        }
                      : item
                  )
                }
              : shelf
          )
        })),

      setSelectedBookshelfId: (id) => set({ selectedBookshelfId: id }),
      setIsLoading: (loading) => set({ isLoading: loading })
    }),
    {
      name: "bookshelf-storage",
      // Only persist selectedBookshelfId, not the data
      partialize: (state) => ({
        selectedBookshelfId: state.selectedBookshelfId
      })
    }
  )
)

// Selector hooks for convenience
const EMPTY_ITEMS: ShelfItemWithVolume[] = []

export const useSelectedBookshelf = () =>
  useBookshelfStore(
    (state) =>
      state.bookshelves.find(
        (shelf) => shelf.id === state.selectedBookshelfId
      ) ?? null
  )

export const useBookshelfItems = (bookshelfId: string | null) =>
  useBookshelfStore((state) => {
    const shelf = state.bookshelves.find((s) => s.id === bookshelfId)
    return shelf?.items ?? EMPTY_ITEMS
  })
