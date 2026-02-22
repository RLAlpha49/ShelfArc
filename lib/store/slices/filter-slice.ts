import type { StateCreator } from "zustand"

import type { FilterPreset, FilterState, LibraryState } from "../library-store"

/** Filter and preset state slice for the library store. @source */
export interface FilterSlice {
  filters: FilterState
  filterPresets: FilterPreset[]
  filterPresetsInitialized: boolean

  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  applyFilterPreset: (presetId: string) => void
  saveFilterPreset: (
    name: string,
    options?: { includeSortAndView?: boolean }
  ) => void
  renameFilterPreset: (presetId: string, name: string) => void
  updateFilterPreset: (
    presetId: string,
    name: string,
    options?: { includeSortAndView?: boolean }
  ) => void
  deleteFilterPreset: (presetId: string) => void
  ensureDefaultFilterPresets: () => void
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
    seriesStatus: filters.seriesStatus,
    hasCover: filters.hasCover,
    hasIsbn: filters.hasIsbn,
    tags: [...(filters.tags ?? [])],
    excludeTags: [...(filters.excludeTags ?? [])]
  }
}

/** Default filter state with no active filters. @source */
export const defaultFilters: FilterState = {
  search: "",
  type: "all",
  ownershipStatus: "all",
  readingStatus: "all",
  seriesStatus: "all",
  hasCover: "all",
  hasIsbn: "all",
  tags: [],
  excludeTags: []
}

/** Normalizes a persisted filter preset, filling missing fields with defaults. @source */
export function normalizeFilterPreset(preset: FilterPreset): FilterPreset {
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
        seriesStatus: filters?.seriesStatus ?? defaultFilters.seriesStatus,
        hasCover: filters?.hasCover ?? defaultFilters.hasCover,
        hasIsbn: filters?.hasIsbn ?? defaultFilters.hasIsbn,
        tags: filters?.tags ?? defaultFilters.tags,
        excludeTags: filters?.excludeTags ?? defaultFilters.excludeTags
      })
    }
  }
}

const DEFAULT_FILTER_PRESETS: FilterPreset[] = [
  {
    id: "default_wishlist",
    name: "Wishlist",
    createdAt: "2026-02-11T00:00:00.000Z",
    updatedAt: "2026-02-11T00:00:00.000Z",
    state: {
      filters: { ...defaultFilters, ownershipStatus: "wishlist" }
    }
  },
  {
    id: "default_currently_reading",
    name: "Currently reading",
    createdAt: "2026-02-11T00:00:00.000Z",
    updatedAt: "2026-02-11T00:00:00.000Z",
    state: {
      filters: { ...defaultFilters, readingStatus: "reading" }
    }
  }
]

export const createFilterSlice: StateCreator<
  LibraryState,
  [],
  [],
  FilterSlice
> = (set, get) => ({
  filters: defaultFilters,
  filterPresets: [],
  filterPresetsInitialized: false,

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
    }))
})
