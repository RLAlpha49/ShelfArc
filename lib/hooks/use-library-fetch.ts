"use client"

import { useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLibraryStore } from "@/lib/store/library-store"
import type {
  Series,
  SeriesWithVolumes,
  Volume
} from "@/lib/types/database"

/** Explicit column list for hot `series` reads (avoid select("*") growth). @source */
export const SERIES_SELECT_FIELDS =
  "id,user_id,title,original_title,description,notes,author,artist,publisher,cover_image_url,type,total_volumes,status,tags,created_at,updated_at"

/** Explicit column list for hot `volumes` reads (avoid select("*") growth). @source */
export const VOLUME_SELECT_FIELDS =
  "id,series_id,user_id,volume_number,title,description,isbn,cover_image_url,edition,format,page_count,publish_date,purchase_date,purchase_price,ownership_status,reading_status,current_page,amazon_url,rating,notes,started_at,finished_at,created_at,updated_at"

export function useLibraryFetch() {
  const supabase = createClient()
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
    setIsLoading(true)
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data: seriesData, error: seriesError } = await supabase
        .from("series")
        .select(SERIES_SELECT_FIELDS)
        .eq("user_id", user.id)
        .order(sortField, { ascending: sortOrder === "asc" })

      if (seriesError) throw seriesError

      // Fetch volumes for all series
      const { data: volumesData, error: volumesError } = await supabase
        .from("volumes")
        .select(VOLUME_SELECT_FIELDS)
        .eq("user_id", user.id)
        .order("volume_number", { ascending: true })

      if (volumesError) throw volumesError

      const allVolumes = (volumesData || []) as Volume[]
      const assignedVolumes = allVolumes.filter((v) => v.series_id)
      const unassigned = allVolumes.filter((v) => !v.series_id)

      // Combine series with their volumes
      const seriesWithVolumes: SeriesWithVolumes[] = (
        (seriesData || []) as Series[]
      ).map((s) => ({
        ...s,
        volumes: assignedVolumes.filter((v) => v.series_id === s.id)
      }))

      setSeries(seriesWithVolumes)
      setUnassignedVolumes(unassigned)
    } catch (error) {
      console.error("Error fetching series:", error)
    } finally {
      setIsLoading(false)
    }
  }, [
    supabase,
    setSeries,
    setUnassignedVolumes,
    setIsLoading,
    sortField,
    sortOrder
  ])

  return { fetchSeries, isLoading }
}
