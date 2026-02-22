import { create } from "zustand"
import { persist } from "zustand/middleware"

import type {
  OwnershipStatus,
  ReadingStatus,
  SeriesStatus,
  SeriesWithVolumes,
  TitleType,
  Volume
} from "@/lib/types/database"

import type { EntitySlice } from "./slices/entity-slice"
import { createEntitySlice } from "./slices/entity-slice"
import type { FilterSlice } from "./slices/filter-slice"
import { createFilterSlice, normalizeFilterPreset } from "./slices/filter-slice"
import type { PreferencesSlice } from "./slices/preferences-slice"
import { createPreferencesSlice } from "./slices/preferences-slice"
import type { UISlice } from "./slices/ui-slice"
import { createUISlice } from "./slices/ui-slice"

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
export type ViewMode = "grid" | "list" | "shelf"
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
export interface FilterState {
  search: string
  type: TitleType | "all"
  ownershipStatus: OwnershipStatus | "all"
  readingStatus: ReadingStatus | "all"
  seriesStatus: SeriesStatus | "all"
  hasCover: "has" | "missing" | "all"
  hasIsbn: "has" | "missing" | "all"
  tags: string[]
  excludeTags: string[]
}

/** Persisted, user-defined filter preset (optionally includes sort/view). @source */
export interface FilterPreset {
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

/** Combined data, UI, filter, and preferences state for the library store. @source */
export type LibraryState = EntitySlice &
  UISlice &
  FilterSlice &
  PreferencesSlice

/** Zustand store managing library data, UI preferences, and CRUD actions. @source */
export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get, api) => ({
      ...createEntitySlice(set as never, get as never, api as never),
      ...createUISlice(set as never, get as never, api as never),
      ...createFilterSlice(set as never, get as never, api as never),
      ...createPreferencesSlice(set as never, get as never, api as never)
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
        dismissedSuggestions: state.dismissedSuggestions
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
 * React''s useSyncExternalStore.
 *
 * Use `useShallow` from `zustand/react/shallow` at the call site for simple
 * multi-slice selections; use this helper for selectors whose deps must be
 * checked individually (e.g. derived collections built from multiple maps).
 */
export function memoizeSelector<TState, TResult>(
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
