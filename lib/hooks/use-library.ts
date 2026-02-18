"use client"

import {
  useLibraryStore,
  selectAllSeries,
  selectAllUnassignedVolumes
} from "@/lib/store/library-store"
import { useLibraryFetch } from "./use-library-fetch"
import { useLibraryApiMutations } from "./use-library-api-mutations"
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
  const { fetchSeries, isLoading } = useLibraryFetch()
  const mutations = useLibraryApiMutations()
  const filters = useLibraryFilters()
  const imports = useLibraryImport()

  return {
    series,
    unassignedVolumes,
    isLoading,
    fetchSeries,
    ...mutations,
    ...filters,
    ...imports
  }
}
