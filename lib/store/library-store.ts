import { create } from "zustand"
import { persist } from "zustand/middleware"

import type {
  OwnershipStatus,
  ReadingStatus,
  Series,
  SeriesWithVolumes,
  TitleType,
  Volume
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
  | "started_at"
  | "finished_at"
/** Sort direction. @source */
export type SortOrder = "asc" | "desc"
/** Display mode for the library grid. @source */
export type ViewMode = "grid" | "list"
/** Top-level collection grouping. @source */
export type CollectionView = "series" | "volumes"
/** Supported external price source. @source */
export type PriceSource = "amazon" | "bookwalker"
/** Supported ISO currency codes. @source */
export type CurrencyCode = "USD" | "GBP" | "EUR" | "CAD" | "JPY"
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

function omitKey<T extends Record<string, unknown>>(obj: T, key: string): T {
  const result = { ...obj }
  delete result[key]
  return result
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
  // Normalized entities (source of truth)
  seriesById: Record<string, Series>
  volumesById: Record<string, Volume>
  seriesIds: string[]
  volumeIdsBySeriesId: Record<string, string[]>
  unassignedVolumeIds: string[]

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
  isLoading: boolean
  lastFetchedAt: number | null

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
  setIsLoading: (loading: boolean) => void
  setLastFetchedAt: (ts: number | null) => void
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
      // Initial state — normalized only
      seriesById: {},
      volumesById: {},
      seriesIds: [],
      volumeIdsBySeriesId: {},
      unassignedVolumeIds: [],
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
      isLoading: false,
      lastFetchedAt: null,

      // Actions
      setSeries: (seriesArr) => {
        const nextSeriesById: Record<string, Series> = {}
        const nextVolumesById: Record<string, Volume> = {}
        const nextSeriesIds: string[] = []
        const nextVolumeIdsBySeriesId: Record<string, string[]> = {}

        for (const s of seriesArr) {
          const { volumes, ...seriesData } = s
          nextSeriesById[s.id] = seriesData as Series
          nextSeriesIds.push(s.id)
          const vIds: string[] = []
          for (const v of volumes) {
            nextVolumesById[v.id] = v
            vIds.push(v.id)
          }
          nextVolumeIdsBySeriesId[s.id] = vIds
        }

        set((state) => {
          // Re-add unassigned volumes to the volume map
          const mergedVolumesById = { ...nextVolumesById }
          for (const uid of state.unassignedVolumeIds) {
            const uv = state.volumesById[uid]
            if (uv) mergedVolumesById[uid] = uv
          }

          return {
            seriesById: nextSeriesById,
            volumesById: mergedVolumesById,
            seriesIds: nextSeriesIds,
            volumeIdsBySeriesId: nextVolumeIdsBySeriesId
          }
        })
      },

      setUnassignedVolumes: (volumes) =>
        set((state) => {
          const nextVolumesById = { ...state.volumesById }
          // Remove old unassigned entries
          for (const oldId of state.unassignedVolumeIds) {
            if (!state.volumeIdsBySeriesId[oldId]) {
              delete nextVolumesById[oldId]
            }
          }
          // Add new unassigned entries
          const nextUnassignedIds: string[] = []
          for (const v of volumes) {
            nextVolumesById[v.id] = v
            nextUnassignedIds.push(v.id)
          }
          return {
            volumesById: nextVolumesById,
            unassignedVolumeIds: nextUnassignedIds
          }
        }),

      addSeries: (newSeries) =>
        set((state) => {
          const { volumes, ...seriesData } = newSeries
          const nextVolumesById = { ...state.volumesById }
          const vIds: string[] = []
          for (const v of volumes) {
            nextVolumesById[v.id] = v
            vIds.push(v.id)
          }
          return {
            seriesById: {
              ...state.seriesById,
              [newSeries.id]: seriesData as Series
            },
            volumesById: nextVolumesById,
            seriesIds: [...state.seriesIds, newSeries.id],
            volumeIdsBySeriesId: {
              ...state.volumeIdsBySeriesId,
              [newSeries.id]: vIds
            }
          }
        }),

      updateSeries: (id, updates) =>
        set((state) => {
          const existing = state.seriesById[id]
          if (!existing) return state
          const updated = { ...existing, ...updates }
          return {
            seriesById: { ...state.seriesById, [id]: updated },
            selectedSeries:
              state.selectedSeries?.id === id
                ? { ...state.selectedSeries, ...updates }
                : state.selectedSeries
          }
        }),

      deleteSeries: (id) =>
        set((state) => {
          const restSeriesById = omitKey(state.seriesById, id)
          const removedVolumeIds = state.volumeIdsBySeriesId[id]
          const restVolumeIdsBySeriesId = omitKey(state.volumeIdsBySeriesId, id)
          const nextVolumesById = { ...state.volumesById }
          for (const vid of removedVolumeIds ?? []) {
            delete nextVolumesById[vid]
          }
          return {
            seriesById: restSeriesById,
            volumesById: nextVolumesById,
            seriesIds: state.seriesIds.filter((sid) => sid !== id),
            volumeIdsBySeriesId: restVolumeIdsBySeriesId,
            selectedSeries:
              state.selectedSeries?.id === id ? null : state.selectedSeries
          }
        }),

      addVolume: (seriesId, volume) =>
        set((state) => ({
          volumesById: { ...state.volumesById, [volume.id]: volume },
          volumeIdsBySeriesId: {
            ...state.volumeIdsBySeriesId,
            [seriesId]: [
              ...(state.volumeIdsBySeriesId[seriesId] ?? []),
              volume.id
            ]
          },
          selectedSeries:
            state.selectedSeries?.id === seriesId
              ? {
                  ...state.selectedSeries,
                  volumes: [...state.selectedSeries.volumes, volume]
                }
              : state.selectedSeries
        })),

      updateVolume: (seriesId, volumeId, updates) =>
        set((state) => {
          const existing = state.volumesById[volumeId]
          if (!existing) return state
          const updated = { ...existing, ...updates }
          return {
            volumesById: { ...state.volumesById, [volumeId]: updated },
            selectedSeries:
              state.selectedSeries?.id === seriesId
                ? {
                    ...state.selectedSeries,
                    volumes: state.selectedSeries.volumes.map((v) =>
                      v.id === volumeId ? updated : v
                    )
                  }
                : state.selectedSeries
          }
        }),

      deleteVolume: (seriesId, volumeId) =>
        set((state) => {
          const restVolumesById = omitKey(state.volumesById, volumeId)
          return {
            volumesById: restVolumesById,
            volumeIdsBySeriesId: {
              ...state.volumeIdsBySeriesId,
              [seriesId]: (state.volumeIdsBySeriesId[seriesId] ?? []).filter(
                (vid) => vid !== volumeId
              )
            },
            selectedSeries:
              state.selectedSeries?.id === seriesId
                ? {
                    ...state.selectedSeries,
                    volumes: state.selectedSeries.volumes.filter(
                      (v) => v.id !== volumeId
                    )
                  }
                : state.selectedSeries
          }
        }),

      addUnassignedVolume: (volume) =>
        set((state) => ({
          volumesById: { ...state.volumesById, [volume.id]: volume },
          unassignedVolumeIds: [...state.unassignedVolumeIds, volume.id]
        })),

      updateUnassignedVolume: (volumeId, updates) =>
        set((state) => {
          const existing = state.volumesById[volumeId]
          if (!existing) return state
          const updated = { ...existing, ...updates }
          return {
            volumesById: { ...state.volumesById, [volumeId]: updated }
          }
        }),

      deleteUnassignedVolume: (volumeId) =>
        set((state) => {
          const restVolumesById = omitKey(state.volumesById, volumeId)
          return {
            volumesById: restVolumesById,
            unassignedVolumeIds: state.unassignedVolumeIds.filter(
              (id) => id !== volumeId
            )
          }
        }),

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
      setIsLoading: (loading) => set({ isLoading: loading }),
      setLastFetchedAt: (ts) => set({ lastFetchedAt: ts })
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
        showAmazonDisclaimer: state.showAmazonDisclaimer
      })
    }
  )
)

/** Select a single series with its volumes by ID. O(1) lookup. @source */
export function selectSeriesById(
  state: LibraryState,
  id: string
): SeriesWithVolumes | undefined {
  const s = state.seriesById[id]
  if (!s) return undefined
  const volumeIds = state.volumeIdsBySeriesId[id] ?? []
  return {
    ...s,
    volumes: volumeIds
      .map((vid) => state.volumesById[vid])
      .filter((v): v is Volume => v != null)
  }
}

/** Select a single volume by ID. O(1) lookup. @source */
export function selectVolumeById(
  state: LibraryState,
  id: string
): Volume | undefined {
  return state.volumesById[id]
}

/** Select all volumes belonging to a series. O(1) lookup. @source */
export function selectSeriesVolumes(
  state: LibraryState,
  seriesId: string
): Volume[] {
  const volumeIds = state.volumeIdsBySeriesId[seriesId] ?? []
  return volumeIds
    .map((vid) => state.volumesById[vid])
    .filter((v): v is Volume => v != null)
}

/**
 * Lightweight memoizer for Zustand selectors that derive new array/object
 * references. Returns the cached result when all dependency slots are
 * reference-equal, preventing the `getSnapshot` instability warning from
 * React's useSyncExternalStore.
 */
function memoizeSelector<TState, TResult>(
  selector: (state: TState) => TResult,
  getDeps: (state: TState) => readonly unknown[]
): (state: TState) => TResult {
  let lastDeps: readonly unknown[] | undefined
  let lastResult: TResult
  return (state: TState): TResult => {
    const deps = getDeps(state)
    if (
      deps.length === lastDeps?.length &&
      deps.every((d, i) => d === lastDeps![i])
    ) {
      return lastResult
    }
    lastDeps = deps
    lastResult = selector(state)
    return lastResult
  }
}

/** Select all volumes (assigned + unassigned). @source */
export const selectAllVolumes = memoizeSelector(
  (state: LibraryState): Volume[] => Object.values(state.volumesById),
  (state) => [state.volumesById]
)

/** Derive the full SeriesWithVolumes[] array from normalized maps. @source */
export const selectAllSeries = memoizeSelector(
  (state: LibraryState): SeriesWithVolumes[] =>
    state.seriesIds.map((id) => {
      const s = state.seriesById[id]
      const volumeIds = state.volumeIdsBySeriesId[id] ?? []
      return {
        ...s,
        volumes: volumeIds
          .map((vid) => state.volumesById[vid])
          .filter((v): v is Volume => v != null)
      }
    }),
  (state) => [
    state.seriesIds,
    state.seriesById,
    state.volumeIdsBySeriesId,
    state.volumesById
  ]
)

/** Derive the unassigned volumes array from normalized maps. @source */
export const selectAllUnassignedVolumes = memoizeSelector(
  (state: LibraryState): Volume[] =>
    state.unassignedVolumeIds
      .map((id) => state.volumesById[id])
      .filter((v): v is Volume => v != null),
  (state) => [state.unassignedVolumeIds, state.volumesById]
)
