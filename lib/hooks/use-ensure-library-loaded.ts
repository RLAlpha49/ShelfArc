"use client"

import { useEffect } from "react"
import { useShallow } from "zustand/react/shallow"

import { selectAllSeries, useLibraryStore } from "@/lib/store/library-store"

import { useLibraryFetch } from "./use-library-fetch"

/**
 * Ensures the library data is loaded, dispatching a fetch only when the store
 * is empty **and** no fetch is already in-flight. Avoids the race condition
 * where components mount during an ongoing load and trigger duplicate requests.
 *
 * @returns `{ series, isLoading, fetchSeries }` — `fetchSeries` is exposed for
 *   components that need to trigger a manual refresh.
 * @source
 */
export function useEnsureLibraryLoaded() {
  const series = useLibraryStore(useShallow(selectAllSeries))
  const { fetchSeries, isLoading } = useLibraryFetch()

  useEffect(() => {
    if (series.length === 0 && !isLoading) {
      fetchSeries()
    }
  }, [series.length, isLoading, fetchSeries])

  return { series, isLoading, fetchSeries }
}
