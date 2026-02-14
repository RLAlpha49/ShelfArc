"use client"

import { useCallback, useRef } from "react"
import { fetchLibrary } from "@/lib/api/endpoints"
import type {
  FetchLibrarySeriesResponse,
  FetchLibraryVolumesResponse
} from "@/lib/api/types"
import { useLibraryStore } from "@/lib/store/library-store"
import type {
  SeriesWithVolumes,
  Volume
} from "@/lib/types/database"

/** Keep client requests within route-level max page size. @source */
const API_PAGE_LIMIT = 100

export function useLibraryFetch() {
  const fetchRunIdRef = useRef(0)
  const {
    setSeries,
    setUnassignedVolumes,
    setIsLoading,
    isLoading,
    sortField,
    sortOrder
  } = useLibraryStore()

  // Fetch all series with volumes
  const fetchSeries = useCallback(async () => {
    const fetchRunId = ++fetchRunIdRef.current
    const isLatestRun = () => fetchRunIdRef.current === fetchRunId

    setIsLoading(true)
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
      setIsLoading(false)

      const loadRemainingSeriesPages = async () => {
        for (
          let page = 2;
          page <= firstSeriesResponse.pagination.totalPages;
          page += 1
        ) {
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
    } catch (error) {
      console.error("Error fetching series:", error)
    } finally {
      if (isLatestRun()) {
        setIsLoading(false)
      }
    }
  }, [
    setSeries,
    setUnassignedVolumes,
    setIsLoading,
    sortField,
    sortOrder
  ])

  return { fetchSeries, isLoading }
}
