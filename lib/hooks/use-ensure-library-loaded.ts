"use client"

import { useEffect } from "react"
import { useShallow } from "zustand/react/shallow"

import { selectAllSeries, useLibraryStore } from "@/lib/store/library-store"

import { useLibraryFetch } from "./use-library-fetch"

/**
 * Ensures the library data is loaded, dispatching a fetch only when the store
 * has **never** completed a fetch **and** no fetch is already in-flight. This
 * avoids re-triggering for users with a genuinely empty library — once the
 * first fetch completes (even with zero results), `hasFetchedOnce` is true
 * and the effect stops re-running.
 *
 * @returns `{ series, isLoading, fetchSeries }` — `fetchSeries` is exposed for
 *   components that need to trigger a manual refresh.
 * @source
 */
export function useEnsureLibraryLoaded() {
  const series = useLibraryStore(useShallow(selectAllSeries))
  const hasFetchedOnce = useLibraryStore((s) => s.hasFetchedOnce)
  const { fetchSeries, isLoading } = useLibraryFetch()

  useEffect(() => {
    if (!hasFetchedOnce && !isLoading) {
      fetchSeries()
    }
  }, [hasFetchedOnce, isLoading, fetchSeries])

  return { series, isLoading, fetchSeries }
}
