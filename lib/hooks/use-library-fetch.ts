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

export function useLibraryFetch() {
  const fetchRunIdRef = useRef(0)
  const {
    setSeries,
    setUnassignedVolumes,
    setIsLoading,
    setLastFetchedAt,
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
    const hasCachedData = state.seriesIds.length > 0
    const isFresh =
      state.lastFetchedAt != null &&
      Date.now() - state.lastFetchedAt < STALE_AFTER_MS

    // If we have fresh cached data, skip the fetch entirely
    if (hasCachedData && isFresh) return

    // If we have stale cached data, keep it visible (no loading skeleton)
    // but still fetch in the background
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
        page: 1,
        limit: API_PAGE_LIMIT,
        sortField,
        sortOrder
      })) as FetchLibrarySeriesResponse

      if (!isLatestRun()) return

      seriesData.push(...firstSeriesResponse.data)
      commitProgress()

      // Stop blocking render after first page; keep loading the rest in background.
      if (showLoadingSkeleton) setIsLoading(false)

      const { totalPages, total: seriesTotal } = firstSeriesResponse.pagination

      // Show progress indicator only when there are more pages to fetch.
      if (totalPages > 1) {
        setSeriesProgress({ loaded: seriesData.length, total: seriesTotal })
      }

      const loadRemainingSeriesPages = async () => {
        for (let page = 2; page <= totalPages; page += 1) {
          const response = (await fetchLibrary({
            view: "series",
            page,
            limit: API_PAGE_LIMIT,
            sortField,
            sortOrder
          })) as FetchLibrarySeriesResponse

          if (!isLatestRun()) return

          seriesData.push(...response.data)
          commitProgress()
          setSeriesProgress({ loaded: seriesData.length, total: seriesTotal })
        }
      }

      const loadVolumePages = async () => {
        let page = 1
        let totalPages = 1

        do {
          const response = (await fetchLibrary({
            view: "volumes",
            page,
            limit: API_PAGE_LIMIT,
            sortField: "volume_count",
            sortOrder: "asc"
          })) as FetchLibraryVolumesResponse

          if (!isLatestRun()) return

          const pageUnassigned = response.data
            .map((entry) => entry.volume as Volume)
            .filter((volume) => !volume.series_id)

          unassignedVolumes.push(...pageUnassigned)
          totalPages = response.pagination.totalPages
          page += 1
          commitProgress()
        } while (page <= totalPages)
      }

      await Promise.all([loadRemainingSeriesPages(), loadVolumePages()])

      if (isLatestRun()) {
        setLastFetchedAt(Date.now())
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
    sortField,
    sortOrder
  ])

  return { fetchSeries, isLoading, error: fetchError, seriesProgress }
}
