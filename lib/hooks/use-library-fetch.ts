"use client"

import { useCallback, useRef, useState } from "react"

import { fetchLibrary } from "@/lib/api/endpoints"
import type {
  FetchLibrarySeriesResponse,
  FetchLibraryVolumesResponse
} from "@/lib/api/types"
import { useLibraryStore } from "@/lib/store/library-store"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

/** Keep client requests within route-level max page size. @source */
const API_PAGE_LIMIT = 100

/** Data is considered fresh for this duration (ms). @source */
const STALE_AFTER_MS = 30_000

/**
 * Returns true when a recent fetch has already completed so the caller can
 * skip re-fetching. An empty library counts as "fetched" once `hasFetchedOnce`
 * is set, preventing the infinite re-fetch loop for users with no content.
 * @source
 */
function isLibraryFresh(state: ReturnType<typeof useLibraryStore.getState>) {
  if (state.lastFetchedAt == null) return false
  const age = Date.now() - state.lastFetchedAt
  if (age >= STALE_AFTER_MS) return false
  return state.hasFetchedOnce || state.seriesIds.length > 0
}

export function useLibraryFetch() {
  const fetchRunIdRef = useRef(0)
  const {
    setSeries,
    setUnassignedVolumes,
    setIsLoading,
    setLastFetchedAt,
    setHasFetchedOnce,
    isLoading,
    sortField,
    sortOrder
  } = useLibraryStore()
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [seriesProgress, setSeriesProgress] = useState<{
    loaded: number
    total: number
  } | null>(null)

  // Fetch all series with volumes (stale-while-revalidate)
  const fetchSeries = useCallback(async () => {
    const state = useLibraryStore.getState()

    // If a recent fetch already completed (even for an empty library), skip.
    if (isLibraryFresh(state)) return

    // If we have stale cached data, keep it visible (no loading skeleton)
    // but still fetch in the background.
    const hasCachedData = state.seriesIds.length > 0
    const showLoadingSkeleton = !hasCachedData

    const fetchRunId = ++fetchRunIdRef.current
    const isLatestRun = () => fetchRunIdRef.current === fetchRunId

    if (showLoadingSkeleton) setIsLoading(true)

    try {
      const seriesData: FetchLibrarySeriesResponse["data"] = []
      const unassignedVolumes: Volume[] = []

      const commitProgress = () => {
        if (!isLatestRun()) return

        const seriesWithVolumes: SeriesWithVolumes[] = seriesData.map(
          (series) => ({
            ...series,
            volumes: series.volumes as Volume[]
          })
        ) as SeriesWithVolumes[]

        setSeries(seriesWithVolumes)
        setUnassignedVolumes([...unassignedVolumes])
      }

      const firstSeriesResponse = (await fetchLibrary({
        view: "series",
        cursor: null,
        includeCount: true,
        limit: API_PAGE_LIMIT,
        sortField,
        sortOrder
      })) as FetchLibrarySeriesResponse

      if (!isLatestRun()) return

      seriesData.push(...firstSeriesResponse.data)
      commitProgress()

      // Stop blocking render after first page; keep loading the rest in background.
      if (showLoadingSkeleton) setIsLoading(false)

      let nextCursor = firstSeriesResponse.pagination.nextCursor
      let hasMore = firstSeriesResponse.pagination.hasMore
      const seriesTotal = firstSeriesResponse.pagination.total

      // Show progress indicator only when there are more pages to fetch.
      if (hasMore && seriesTotal) {
        setSeriesProgress({ loaded: seriesData.length, total: seriesTotal })
      }

      const loadRemainingSeriesPages = async () => {
        while (hasMore && nextCursor) {
          const response = (await fetchLibrary({
            view: "series",
            cursor: nextCursor,
            limit: API_PAGE_LIMIT,
            sortField,
            sortOrder
          })) as FetchLibrarySeriesResponse

          if (!isLatestRun()) return

          seriesData.push(...response.data)
          commitProgress()
          if (seriesTotal) {
            setSeriesProgress({ loaded: seriesData.length, total: seriesTotal })
          }
          nextCursor = response.pagination.nextCursor
          hasMore = response.pagination.hasMore
        }
      }

      const loadVolumePages = async () => {
        let cursor: string | null = null
        let hasMoreVolumes = true

        do {
          const response = (await fetchLibrary({
            view: "volumes",
            cursor: cursor ?? undefined,
            limit: API_PAGE_LIMIT,
            sortField: "volume_count",
            sortOrder: "asc"
          })) as FetchLibraryVolumesResponse

          if (!isLatestRun()) return

          const pageUnassigned = response.data
            .map((entry) => entry.volume as Volume)
            .filter((volume) => !volume.series_id)

          unassignedVolumes.push(...pageUnassigned)
          cursor = response.pagination.nextCursor ?? null
          hasMoreVolumes = response.pagination.hasMore ?? false
          commitProgress()
        } while (hasMoreVolumes && cursor)
      }

      await Promise.all([loadRemainingSeriesPages(), loadVolumePages()])

      if (isLatestRun()) {
        setLastFetchedAt(Date.now())
        setHasFetchedOnce(true)
      }
    } catch (error) {
      console.error("Error fetching series:", error)
      if (isLatestRun()) {
        setFetchError(
          error instanceof Error ? error.message : "Failed to load library"
        )
      }
    } finally {
      if (isLatestRun()) {
        setIsLoading(false)
        setSeriesProgress(null)
      }
    }
  }, [
    setSeries,
    setUnassignedVolumes,
    setIsLoading,
    setLastFetchedAt,
    setHasFetchedOnce,
    sortField,
    sortOrder
  ])

  return { fetchSeries, isLoading, error: fetchError, seriesProgress }
}
