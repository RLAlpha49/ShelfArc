import type { StateCreator } from "zustand"

import type {
  CollectionView,
  SortField,
  SortOrder,
  ViewMode
} from "../library-store"

/** View/sort/loading state slice for the library store. @source */
export interface UISlice {
  collectionView: CollectionView
  viewMode: ViewMode
  sortField: SortField
  sortOrder: SortOrder
  activeFilterPresetId: string | null
  isLoading: boolean
  lastFetchedAt: number | null

  setCollectionView: (view: CollectionView) => void
  setViewMode: (mode: ViewMode) => void
  setSortField: (field: SortField) => void
  setSortOrder: (order: SortOrder) => void
  setIsLoading: (loading: boolean) => void
  setLastFetchedAt: (ts: number | null) => void
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  collectionView: "series",
  viewMode: "grid",
  sortField: "title",
  sortOrder: "asc",
  activeFilterPresetId: null,
  isLoading: false,
  lastFetchedAt: null,

  setCollectionView: (view) =>
    set({ collectionView: view, activeFilterPresetId: null }),
  setViewMode: (mode) => set({ viewMode: mode, activeFilterPresetId: null }),
  setSortField: (field) =>
    set({ sortField: field, activeFilterPresetId: null }),
  setSortOrder: (order) =>
    set({ sortOrder: order, activeFilterPresetId: null }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setLastFetchedAt: (ts) => set({ lastFetchedAt: ts })
})
