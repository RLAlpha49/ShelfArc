import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  Series,
  SeriesWithVolumes,
  Volume,
  TitleType,
  OwnershipStatus,
  ReadingStatus
} from "@/lib/types/database"

export type SortField = "title" | "created_at" | "updated_at" | "author"
export type SortOrder = "asc" | "desc"
export type ViewMode = "grid" | "list"

interface FilterState {
  search: string
  type: TitleType | "all"
  ownershipStatus: OwnershipStatus | "all"
  readingStatus: ReadingStatus | "all"
  tags: string[]
}

interface LibraryState {
  // Data
  series: SeriesWithVolumes[]
  selectedSeries: SeriesWithVolumes | null

  // UI State
  viewMode: ViewMode
  sortField: SortField
  sortOrder: SortOrder
  filters: FilterState
  isLoading: boolean

  // Actions
  setSeries: (series: SeriesWithVolumes[]) => void
  addSeries: (series: SeriesWithVolumes) => void
  updateSeries: (id: string, updates: Partial<Series>) => void
  deleteSeries: (id: string) => void

  addVolume: (seriesId: string, volume: Volume) => void
  updateVolume: (
    seriesId: string,
    volumeId: string,
    updates: Partial<Volume>
  ) => void
  deleteVolume: (seriesId: string, volumeId: string) => void

  setSelectedSeries: (series: SeriesWithVolumes | null) => void
  setViewMode: (mode: ViewMode) => void
  setSortField: (field: SortField) => void
  setSortOrder: (order: SortOrder) => void
  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  setIsLoading: (loading: boolean) => void
}

const defaultFilters: FilterState = {
  search: "",
  type: "all",
  ownershipStatus: "all",
  readingStatus: "all",
  tags: []
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      // Initial state
      series: [],
      selectedSeries: null,
      viewMode: "grid",
      sortField: "title",
      sortOrder: "asc",
      filters: defaultFilters,
      isLoading: false,

      // Actions
      setSeries: (series) => set({ series }),

      addSeries: (newSeries) =>
        set((state) => ({ series: [...state.series, newSeries] })),

      updateSeries: (id, updates) =>
        set((state) => ({
          series: state.series.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
          selectedSeries:
            state.selectedSeries?.id === id
              ? { ...state.selectedSeries, ...updates }
              : state.selectedSeries
        })),

      deleteSeries: (id) =>
        set((state) => ({
          series: state.series.filter((s) => s.id !== id),
          selectedSeries:
            state.selectedSeries?.id === id ? null : state.selectedSeries
        })),

      addVolume: (seriesId, volume) =>
        set((state) => ({
          series: state.series.map((s) =>
            s.id === seriesId ? { ...s, volumes: [...s.volumes, volume] } : s
          ),
          selectedSeries:
            state.selectedSeries?.id === seriesId
              ? {
                  ...state.selectedSeries,
                  volumes: [...state.selectedSeries.volumes, volume]
                }
              : state.selectedSeries
        })),

      updateVolume: (seriesId, volumeId, updates) =>
        set((state) => ({
          series: state.series.map((s) =>
            s.id === seriesId
              ? {
                  ...s,
                  volumes: s.volumes.map((v) =>
                    v.id === volumeId ? { ...v, ...updates } : v
                  )
                }
              : s
          ),
          selectedSeries:
            state.selectedSeries?.id === seriesId
              ? {
                  ...state.selectedSeries,
                  volumes: state.selectedSeries.volumes.map((v) =>
                    v.id === volumeId ? { ...v, ...updates } : v
                  )
                }
              : state.selectedSeries
        })),

      deleteVolume: (seriesId, volumeId) =>
        set((state) => ({
          series: state.series.map((s) =>
            s.id === seriesId
              ? { ...s, volumes: s.volumes.filter((v) => v.id !== volumeId) }
              : s
          ),
          selectedSeries:
            state.selectedSeries?.id === seriesId
              ? {
                  ...state.selectedSeries,
                  volumes: state.selectedSeries.volumes.filter(
                    (v) => v.id !== volumeId
                  )
                }
              : state.selectedSeries
        })),

      setSelectedSeries: (series) => set({ selectedSeries: series }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSortField: (field) => set({ sortField: field }),
      setSortOrder: (order) => set({ sortOrder: order }),
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),
      resetFilters: () => set({ filters: defaultFilters }),
      setIsLoading: (loading) => set({ isLoading: loading })
    }),
    {
      name: "shelfarc-library",
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortField: state.sortField,
        sortOrder: state.sortOrder
      })
    }
  )
)
