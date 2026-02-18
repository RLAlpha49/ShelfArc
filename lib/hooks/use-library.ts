"use client"

import {
  selectAllSeries,
  selectAllUnassignedVolumes,
  useLibraryStore
} from "@/lib/store/library-store"

import { useLibraryApiMutations } from "./use-library-api-mutations"
import { useLibraryFetch } from "./use-library-fetch"
import { useLibraryFilters } from "./use-library-filters"
import { useLibraryImport } from "./use-library-import"

export type { VolumeWithSeries } from "./use-library-filters"

/**
 * React hook providing CRUD operations, filtering, sorting, and book-import logic for the library.
 * @returns Library state, filtered views, and mutation functions.
 * @source
 */
export function useLibrary() {
  const series = useLibraryStore(selectAllSeries)
  const unassignedVolumes = useLibraryStore(selectAllUnassignedVolumes)
  const { fetchSeries, isLoading, seriesProgress } = useLibraryFetch()
  const mutations = useLibraryApiMutations()
  const filters = useLibraryFilters()
  const imports = useLibraryImport()

  return {
    series,
    unassignedVolumes,
    isLoading,
    seriesProgress,
    fetchSeries,
    ...mutations,
    ...filters,
    ...imports
  }
}
