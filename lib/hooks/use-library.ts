"use client"

import { useLibraryStore } from "@/lib/store/library-store"
import { useLibraryFetch } from "./use-library-fetch"
import { useLibraryMutations } from "./use-library-mutations"
import { useLibraryFilters } from "./use-library-filters"
import { useLibraryImport } from "./use-library-import"

export type { VolumeWithSeries } from "./use-library-filters"

/**
 * React hook providing CRUD operations, filtering, sorting, and book-import logic for the library.
 * @returns Library state, filtered views, and mutation functions.
 * @source
 */
export function useLibrary() {
  const { series, unassignedVolumes } = useLibraryStore()
  const { fetchSeries, isLoading } = useLibraryFetch()
  const mutations = useLibraryMutations()
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
