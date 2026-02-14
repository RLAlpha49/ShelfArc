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

/** Sort field options for the library view. @source */
export type SortField =
  | "title"
  | "created_at"
  | "updated_at"
  | "author"
  | "rating"
  | "volume_count"
  | "price"
/** Sort direction. @source */
export type SortOrder = "asc" | "desc"
/** Display mode for the library grid. @source */
export type ViewMode = "grid" | "list"
/** Top-level collection grouping. @source */
export type CollectionView = "series" | "volumes"
/** Supported external price source. @source */
export type PriceSource = "amazon"
/** Supported ISO currency codes. @source */
export type CurrencyCode = "USD" | "GBP" | "EUR" | "CAD" | "JPY"
/** Navigation layout mode. @source */
export type NavigationMode = "sidebar" | "header"
/** Default currency code used throughout the app. @source */
export const DEFAULT_CURRENCY_CODE: CurrencyCode = "USD"
/** Supported Amazon regional domains. @source */
export type AmazonDomain =
  | "amazon.com"
  | "amazon.co.uk"
  | "amazon.ca"
  | "amazon.de"
  | "amazon.co.jp"

/** Active filter state for the library view. @source */
interface FilterState {
  search: string
  type: TitleType | "all"
  ownershipStatus: OwnershipStatus | "all"
  readingStatus: ReadingStatus | "all"
  tags: string[]
  excludeTags: string[]
}

/** Persisted, user-defined filter preset (optionally includes sort/view). @source */
interface FilterPreset {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  state: {
    filters: FilterState
    sortField?: SortField
    sortOrder?: SortOrder
    viewMode?: ViewMode
    collectionView?: CollectionView
  }
}

function getNowIso() {
  return new Date().toISOString()
}

function createPresetId() {
  const cryptoObj = globalThis.crypto
  if (
    cryptoObj &&
    "randomUUID" in cryptoObj &&
    typeof cryptoObj.randomUUID === "function"
  ) {
    return cryptoObj.randomUUID()
  }
  return `preset_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function cloneFilters(filters: FilterState): FilterState {
  return {
    search: filters.search,
    type: filters.type,
    ownershipStatus: filters.ownershipStatus,
    readingStatus: filters.readingStatus,
    tags: [...(filters.tags ?? [])],
    excludeTags: [...(filters.excludeTags ?? [])]
  }
}

function normalizeFilterPreset(preset: FilterPreset): FilterPreset {
  const filters = preset.state?.filters
  return {
    ...preset,
    state: {
      ...preset.state,
      filters: cloneFilters({
        search: filters?.search ?? defaultFilters.search,
        type: filters?.type ?? defaultFilters.type,
        ownershipStatus:
          filters?.ownershipStatus ?? defaultFilters.ownershipStatus,
        readingStatus: filters?.readingStatus ?? defaultFilters.readingStatus,
        tags: filters?.tags ?? defaultFilters.tags,
        excludeTags: filters?.excludeTags ?? defaultFilters.excludeTags
      })
    }
  }
}

/** Combined data, UI, and action state for the library Zustand store. @source */
interface LibraryState {
  // Data
  series: SeriesWithVolumes[]
  unassignedVolumes: Volume[]
  selectedSeries: SeriesWithVolumes | null

  // UI State
  collectionView: CollectionView
  viewMode: ViewMode
  sortField: SortField
  sortOrder: SortOrder
  filters: FilterState
  filterPresets: FilterPreset[]
  activeFilterPresetId: string | null
  filterPresetsInitialized: boolean
  deleteSeriesVolumes: boolean
  priceSource: PriceSource
  amazonDomain: AmazonDomain
  amazonPreferKindle: boolean
  amazonFallbackToKindle: boolean
  priceDisplayCurrency: CurrencyCode
  showAmazonDisclaimer: boolean
  navigationMode: NavigationMode
  isLoading: boolean

  // Actions
  setSeries: (series: SeriesWithVolumes[]) => void
  setUnassignedVolumes: (volumes: Volume[]) => void
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

  addUnassignedVolume: (volume: Volume) => void
  updateUnassignedVolume: (volumeId: string, updates: Partial<Volume>) => void
  deleteUnassignedVolume: (volumeId: string) => void

  setSelectedSeries: (series: SeriesWithVolumes | null) => void
  setCollectionView: (view: CollectionView) => void
  setViewMode: (mode: ViewMode) => void
  setSortField: (field: SortField) => void
  setSortOrder: (order: SortOrder) => void
  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  applyFilterPreset: (presetId: string) => void
  saveFilterPreset: (
    name: string,
    options?: {
      includeSortAndView?: boolean
    }
  ) => void
  renameFilterPreset: (presetId: string, name: string) => void
  updateFilterPreset: (
    presetId: string,
    name: string,
    options?: { includeSortAndView?: boolean }
  ) => void
  deleteFilterPreset: (presetId: string) => void
  ensureDefaultFilterPresets: () => void
  setDeleteSeriesVolumes: (value: boolean) => void
  setPriceSource: (value: PriceSource) => void
  setAmazonDomain: (value: AmazonDomain) => void
  setAmazonPreferKindle: (value: boolean) => void
  setAmazonFallbackToKindle: (value: boolean) => void
  setPriceDisplayCurrency: (value: CurrencyCode) => void
  setShowAmazonDisclaimer: (value: boolean) => void
  setNavigationMode: (value: NavigationMode) => void
  setIsLoading: (loading: boolean) => void
}

/** Default filter state with no active filters. @source */
const defaultFilters: FilterState = {
  search: "",
  type: "all",
  ownershipStatus: "all",
  readingStatus: "all",
  tags: [],
  excludeTags: []
}

const DEFAULT_FILTER_PRESETS: FilterPreset[] = [
  {
    id: "default_wishlist",
    name: "Wishlist",
    createdAt: "2026-02-11T00:00:00.000Z",
    updatedAt: "2026-02-11T00:00:00.000Z",
    state: {
      filters: {
        ...defaultFilters,
        ownershipStatus: "wishlist"
      }
    }
  },
  {
    id: "default_currently_reading",
    name: "Currently reading",
    createdAt: "2026-02-11T00:00:00.000Z",
    updatedAt: "2026-02-11T00:00:00.000Z",
    state: {
      filters: {
        ...defaultFilters,
        readingStatus: "reading"
      }
    }
  }
]

/** Zustand store managing library data, UI preferences, and CRUD actions. @source */
export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      // Initial state
      series: [],
      unassignedVolumes: [],
      selectedSeries: null,
      collectionView: "series",
      viewMode: "grid",
      sortField: "title",
      sortOrder: "asc",
      filters: defaultFilters,
      filterPresets: [],
      activeFilterPresetId: null,
      filterPresetsInitialized: false,
      deleteSeriesVolumes: false,
      priceSource: "amazon",
      amazonDomain: "amazon.com",
      amazonPreferKindle: false,
      amazonFallbackToKindle: false,
      priceDisplayCurrency: "USD",
      showAmazonDisclaimer: true,
      navigationMode: "sidebar",
      isLoading: false,

      // Actions
      setSeries: (series) => set({ series }),
      setUnassignedVolumes: (volumes) => set({ unassignedVolumes: volumes }),

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

      addUnassignedVolume: (volume) =>
        set((state) => ({
          unassignedVolumes: [...state.unassignedVolumes, volume]
        })),

      updateUnassignedVolume: (volumeId, updates) =>
        set((state) => ({
          unassignedVolumes: state.unassignedVolumes.map((volume) =>
            volume.id === volumeId ? { ...volume, ...updates } : volume
          )
        })),

      deleteUnassignedVolume: (volumeId) =>
        set((state) => ({
          unassignedVolumes: state.unassignedVolumes.filter(
            (volume) => volume.id !== volumeId
          )
        })),

      setSelectedSeries: (series) => set({ selectedSeries: series }),
      setCollectionView: (view) =>
        set({ collectionView: view, activeFilterPresetId: null }),
      setViewMode: (mode) =>
        set({ viewMode: mode, activeFilterPresetId: null }),
      setSortField: (field) =>
        set({ sortField: field, activeFilterPresetId: null }),
      setSortOrder: (order) =>
        set({ sortOrder: order, activeFilterPresetId: null }),
      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
          activeFilterPresetId: null
        })),
      resetFilters: () =>
        set({ filters: defaultFilters, activeFilterPresetId: null }),

      ensureDefaultFilterPresets: () => {
        const state = get()
        if (state.filterPresetsInitialized) return
        if (state.filterPresets.length > 0) {
          set({ filterPresetsInitialized: true })
          return
        }

        set({
          filterPresets: DEFAULT_FILTER_PRESETS,
          filterPresetsInitialized: true
        })
      },

      saveFilterPreset: (rawName, options) => {
        const name = rawName.trim()
        if (!name) return

        const includeSortAndView = options?.includeSortAndView ?? false
        const state = get()
        const now = getNowIso()

        const preset: FilterPreset = {
          id: createPresetId(),
          name,
          createdAt: now,
          updatedAt: now,
          state: {
            filters: cloneFilters(state.filters),
            ...(includeSortAndView
              ? {
                  sortField: state.sortField,
                  sortOrder: state.sortOrder,
                  viewMode: state.viewMode,
                  collectionView: state.collectionView
                }
              : {})
          }
        }

        set((prev) => ({
          filterPresets: [...prev.filterPresets, preset],
          activeFilterPresetId: preset.id,
          filterPresetsInitialized: true
        }))
      },

      applyFilterPreset: (presetId) => {
        const state = get()
        const preset = state.filterPresets.find((p) => p.id === presetId)
        if (!preset) return

        set({
          filters: cloneFilters(preset.state.filters),
          sortField: preset.state.sortField ?? state.sortField,
          sortOrder: preset.state.sortOrder ?? state.sortOrder,
          viewMode: preset.state.viewMode ?? state.viewMode,
          collectionView: preset.state.collectionView ?? state.collectionView,
          activeFilterPresetId: preset.id
        })
      },

      renameFilterPreset: (presetId, rawName) => {
        const name = rawName.trim()
        if (!name) return

        const now = getNowIso()
        set((state) => ({
          filterPresets: state.filterPresets.map((p) =>
            p.id === presetId ? { ...p, name, updatedAt: now } : p
          )
        }))
      },

      updateFilterPreset: (presetId, rawName, options) => {
        const name = rawName.trim()
        if (!name) return

        const includeSortAndView = options?.includeSortAndView ?? false
        const state = get()
        const now = getNowIso()

        set((prev) => ({
          filterPresets: prev.filterPresets.map((p) =>
            p.id === presetId
              ? {
                  ...p,
                  name,
                  updatedAt: now,
                  state: {
                    filters: cloneFilters(state.filters),
                    ...(includeSortAndView
                      ? {
                          sortField: state.sortField,
                          sortOrder: state.sortOrder,
                          viewMode: state.viewMode,
                          collectionView: state.collectionView
                        }
                      : {})
                  }
                }
              : p
          )
        }))
      },

      deleteFilterPreset: (presetId) =>
        set((state) => ({
          filterPresets: state.filterPresets.filter((p) => p.id !== presetId),
          activeFilterPresetId:
            state.activeFilterPresetId === presetId
              ? null
              : state.activeFilterPresetId
        })),

      setDeleteSeriesVolumes: (value) => set({ deleteSeriesVolumes: value }),
      setPriceSource: (value) => set({ priceSource: value }),
      setAmazonDomain: (value) => set({ amazonDomain: value }),
      setAmazonPreferKindle: (value) => set({ amazonPreferKindle: value }),
      setAmazonFallbackToKindle: (value) =>
        set({ amazonFallbackToKindle: value }),
      setPriceDisplayCurrency: (value) => set({ priceDisplayCurrency: value }),
      setShowAmazonDisclaimer: (value) => set({ showAmazonDisclaimer: value }),
      setNavigationMode: (value) => set({ navigationMode: value }),
      setIsLoading: (loading) => set({ isLoading: loading })
    }),
    {
      name: "shelfarc-library",
      onRehydrateStorage: () => (state) => {
        if (state?.filterPresets.length) {
          state.filterPresets = state.filterPresets.map(normalizeFilterPreset)
        }
        state?.ensureDefaultFilterPresets()
      },
      partialize: (state) => ({
        collectionView: state.collectionView,
        viewMode: state.viewMode,
        sortField: state.sortField,
        sortOrder: state.sortOrder,
        filterPresets: state.filterPresets,
        filterPresetsInitialized: state.filterPresetsInitialized,
        deleteSeriesVolumes: state.deleteSeriesVolumes,
        priceSource: state.priceSource,
        amazonDomain: state.amazonDomain,
        amazonPreferKindle: state.amazonPreferKindle,
        amazonFallbackToKindle: state.amazonFallbackToKindle,
        priceDisplayCurrency: state.priceDisplayCurrency,
        showAmazonDisclaimer: state.showAmazonDisclaimer,
        navigationMode: state.navigationMode
      })
    }
  )
)
