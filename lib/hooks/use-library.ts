"use client"

import { useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLibraryStore } from "@/lib/store/library-store"
import type { BookSearchResult } from "@/lib/books/search"
import type {
  Series,
  SeriesWithVolumes,
  SeriesInsert,
  Volume,
  VolumeInsert
} from "@/lib/types/database"

export interface VolumeWithSeries {
  volume: Volume
  series: SeriesWithVolumes
}

export function useLibrary() {
  const supabase = createClient()
  const {
    series,
    setSeries,
    unassignedVolumes,
    setUnassignedVolumes,
    addSeries,
    updateSeries,
    deleteSeries,
    addVolume,
    updateVolume,
    deleteVolume,
    addUnassignedVolume,
    updateUnassignedVolume,
    deleteUnassignedVolume,
    setIsLoading,
    isLoading,
    filters,
    sortField,
    sortOrder
  } = useLibraryStore()

  const normalizeText = useCallback((value?: string | null) => {
    return (value ?? "")
      .normalize("NFKD")
      .replaceAll(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replaceAll(/\s+/g, " ")
  }, [])

  const normalizeSeriesTitle = useCallback(
    (value: string) => {
      const base = normalizeText(value)
      return base
        .replaceAll(/\(.*?\)/g, " ")
        .replaceAll(/\b(vol(?:ume)?|book|part|no\.?|#)\s*\d+\b/g, " ")
        .replaceAll(
          /\b(omnibus|collector'?s|special|edition|deluxe|complete|box\s*set|boxset)\b/g,
          " "
        )
        .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
        .replaceAll(/\s+/g, " ")
        .trim()
    },
    [normalizeText]
  )

  const findMatchingSeries = useCallback(
    (title: string, author?: string | null) => {
      const normalizedTitle = normalizeSeriesTitle(title)
      const normalizedAuthor = normalizeText(author ?? "")

      return series.find((item) => {
        if (normalizeSeriesTitle(item.title) !== normalizedTitle) return false
        if (author) {
          return normalizeText(item.author) === normalizedAuthor
        }
        return true
      })
    },
    [normalizeSeriesTitle, normalizeText, series]
  )

  const getNextVolumeNumber = useCallback(
    (targetSeries?: SeriesWithVolumes) => {
      if (!targetSeries) return 1
      const maxVolume = targetSeries.volumes.reduce(
        (max, volume) => Math.max(max, volume.volume_number),
        0
      )
      return maxVolume + 1
    },
    []
  )

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
        .select("*")
        .eq("user_id", user.id)
        .order(sortField, { ascending: sortOrder === "asc" })

      if (seriesError) throw seriesError

      // Fetch volumes for all series
      const { data: volumesData, error: volumesError } = await supabase
        .from("volumes")
        .select("*")
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

  // Create new series
  const createSeries = useCallback(
    async (data: Omit<SeriesInsert, "user_id">) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newSeries, error } = await (supabase as any)
          .from("series")
          .insert({ ...data, user_id: user.id })
          .select()
          .single()

        if (error) throw error

        const seriesWithVolumes: SeriesWithVolumes = {
          ...(newSeries as Series),
          volumes: []
        }
        addSeries(seriesWithVolumes)
        return seriesWithVolumes
      } catch (error) {
        console.error("Error creating series:", error)
        throw error
      }
    },
    [supabase, addSeries]
  )

  // Update existing series
  const editSeries = useCallback(
    async (id: string, data: Partial<Series>) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("series")
          .update(data)
          .eq("id", id)
          .eq("user_id", user.id)

        if (error) throw error

        updateSeries(id, data)
      } catch (error) {
        console.error("Error updating series:", error)
        throw error
      }
    },
    [supabase, updateSeries]
  )

  // Delete series
  const removeSeries = useCallback(
    async (id: string) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("series")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id)

        if (error) throw error

        deleteSeries(id)
      } catch (error) {
        console.error("Error deleting series:", error)
        throw error
      }
    },
    [supabase, deleteSeries]
  )

  // Create new volume
  const createVolume = useCallback(
    async (
      seriesId: string | null,
      data: Omit<VolumeInsert, "user_id" | "series_id">
    ) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newVolume, error } = await (supabase as any)
          .from("volumes")
          .insert({ ...data, series_id: seriesId, user_id: user.id })
          .select()
          .single()

        if (error) throw error

        if (seriesId) {
          addVolume(seriesId, newVolume as Volume)
        } else {
          addUnassignedVolume(newVolume as Volume)
        }
        return newVolume as Volume
      } catch (error) {
        console.error("Error creating volume:", error)
        throw error
      }
    },
    [supabase, addVolume, addUnassignedVolume]
  )

  // Update volume
  const editVolume = useCallback(
    async (
      seriesId: string | null,
      volumeId: string,
      data: Partial<Volume>
    ) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const nextSeriesId = data.series_id ?? seriesId
        if (nextSeriesId && !series.some((item) => item.id === nextSeriesId)) {
          throw new Error("Series not found")
        }
        const updatePayload = {
          ...data,
          series_id: nextSeriesId
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("volumes")
          .update(updatePayload)
          .eq("id", volumeId)
          .eq("user_id", user.id)

        if (error) throw error

        const currentVolume =
          series
            .flatMap((item) => item.volumes)
            .find((volume) => volume.id === volumeId) ??
          unassignedVolumes.find((volume) => volume.id === volumeId)

        if (!currentVolume) {
          return
        }

        const updatedVolume: Volume = {
          ...currentVolume,
          ...updatePayload
        }

        if (nextSeriesId === seriesId) {
          if (seriesId) {
            updateVolume(seriesId, volumeId, updatePayload)
          } else {
            updateUnassignedVolume(volumeId, updatePayload)
          }
          return
        }

        if (seriesId) {
          deleteVolume(seriesId, volumeId)
        } else {
          deleteUnassignedVolume(volumeId)
        }

        if (nextSeriesId) {
          addVolume(nextSeriesId, updatedVolume)
        } else {
          addUnassignedVolume(updatedVolume)
        }
      } catch (error) {
        console.error("Error updating volume:", error)
        throw error
      }
    },
    [
      supabase,
      series,
      unassignedVolumes,
      updateVolume,
      updateUnassignedVolume,
      deleteVolume,
      deleteUnassignedVolume,
      addVolume,
      addUnassignedVolume
    ]
  )

  // Delete volume
  const removeVolume = useCallback(
    async (seriesId: string | null, volumeId: string) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("volumes")
          .delete()
          .eq("id", volumeId)
          .eq("user_id", user.id)

        if (error) throw error

        if (seriesId) {
          deleteVolume(seriesId, volumeId)
        } else {
          deleteUnassignedVolume(volumeId)
        }
      } catch (error) {
        console.error("Error deleting volume:", error)
        throw error
      }
    },
    [supabase, deleteVolume, deleteUnassignedVolume]
  )

  // Filter series based on current filters
  const filteredSeries = series.filter((s) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesTitle = s.title.toLowerCase().includes(searchLower)
      const matchesAuthor = s.author?.toLowerCase().includes(searchLower)
      const matchesDescription = s.description
        ?.toLowerCase()
        .includes(searchLower)
      if (!matchesTitle && !matchesAuthor && !matchesDescription) return false
    }

    // Type filter
    if (filters.type !== "all" && s.type !== filters.type) return false

    // Tags filter
    if (filters.tags.length > 0) {
      const hasTags = filters.tags.every((tag) => s.tags.includes(tag))
      if (!hasTags) return false
    }

    // Ownership status filter (check volumes)
    if (filters.ownershipStatus !== "all") {
      const hasMatchingVolume = s.volumes.some(
        (v) => v.ownership_status === filters.ownershipStatus
      )
      if (!hasMatchingVolume) return false
    }

    // Reading status filter (check volumes)
    if (filters.readingStatus !== "all") {
      const hasMatchingVolume = s.volumes.some(
        (v) => v.reading_status === filters.readingStatus
      )
      if (!hasMatchingVolume) return false
    }

    return true
  })

  const allVolumes = useMemo<VolumeWithSeries[]>(() => {
    return series.flatMap((item) =>
      item.volumes.map((volume) => ({ volume, series: item }))
    )
  }, [series])

  const filteredVolumes = useMemo(() => {
    return allVolumes.filter(({ volume, series: seriesItem }) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesVolumeTitle = volume.title
          ?.toLowerCase()
          .includes(searchLower)
        const matchesSeriesTitle = seriesItem.title
          .toLowerCase()
          .includes(searchLower)
        const matchesAuthor = seriesItem.author
          ?.toLowerCase()
          .includes(searchLower)
        const matchesIsbn = volume.isbn?.toLowerCase().includes(searchLower)

        if (
          !matchesVolumeTitle &&
          !matchesSeriesTitle &&
          !matchesAuthor &&
          !matchesIsbn
        ) {
          return false
        }
      }

      if (filters.type !== "all" && seriesItem.type !== filters.type)
        return false

      if (filters.tags.length > 0) {
        const hasTags = filters.tags.every((tag) =>
          seriesItem.tags.includes(tag)
        )
        if (!hasTags) return false
      }

      if (
        filters.ownershipStatus !== "all" &&
        volume.ownership_status !== filters.ownershipStatus
      ) {
        return false
      }

      if (
        filters.readingStatus !== "all" &&
        volume.reading_status !== filters.readingStatus
      ) {
        return false
      }

      return true
    })
  }, [allVolumes, filters])

  const filteredUnassignedVolumes = useMemo(() => {
    return unassignedVolumes.filter((volume) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesTitle = volume.title?.toLowerCase().includes(searchLower)
        const matchesIsbn = volume.isbn?.toLowerCase().includes(searchLower)

        if (!matchesTitle && !matchesIsbn) {
          return false
        }
      }

      if (filters.type !== "all") return false
      if (filters.tags.length > 0) return false

      if (
        filters.ownershipStatus !== "all" &&
        volume.ownership_status !== filters.ownershipStatus
      ) {
        return false
      }

      if (
        filters.readingStatus !== "all" &&
        volume.reading_status !== filters.readingStatus
      ) {
        return false
      }

      return true
    })
  }, [filters, unassignedVolumes])

  const sortedVolumes = useMemo(() => {
    const multiplier = sortOrder === "asc" ? 1 : -1
    const compareStrings = (a?: string | null, b?: string | null) => {
      return (a ?? "").localeCompare(b ?? "", undefined, {
        sensitivity: "base"
      })
    }

    return [...filteredVolumes].sort((a, b) => {
      switch (sortField) {
        case "author":
          return (
            compareStrings(a.series.author, b.series.author) * multiplier ||
            (a.volume.volume_number - b.volume.volume_number) * multiplier
          )
        case "created_at":
          return (
            (new Date(a.volume.created_at).getTime() -
              new Date(b.volume.created_at).getTime()) *
            multiplier
          )
        case "updated_at":
          return (
            (new Date(a.volume.updated_at).getTime() -
              new Date(b.volume.updated_at).getTime()) *
            multiplier
          )
        case "title":
        default:
          return (
            compareStrings(a.series.title, b.series.title) * multiplier ||
            (a.volume.volume_number - b.volume.volume_number) * multiplier
          )
      }
    })
  }, [filteredVolumes, sortField, sortOrder])

  const addBookFromSearchResult = useCallback(
    async (result: BookSearchResult) => {
      const seriesTitle = result.seriesTitle ?? result.title
      if (!seriesTitle) throw new Error("Missing title")

      const author = result.authors[0] ?? null
      let targetSeries = findMatchingSeries(seriesTitle, author)
      targetSeries ??= await createSeries({
        title: seriesTitle,
        author: author || null,
        description: result.description || null,
        publisher: result.publisher || null,
        cover_image_url: result.coverUrl || null,
        type: "other",
        tags: []
      })

      const volumeNumber = getNextVolumeNumber(targetSeries)
      await createVolume(targetSeries.id, {
        volume_number: volumeNumber,
        title: result.title || null,
        isbn: result.isbn || null,
        cover_image_url: result.coverUrl || null,
        publish_date: result.publishedDate || null,
        ownership_status: "owned",
        reading_status: "unread"
      })

      return targetSeries
    },
    [createSeries, createVolume, findMatchingSeries, getNextVolumeNumber]
  )

  const addVolumeFromSearchResult = useCallback(
    async (seriesId: string, result: BookSearchResult) => {
      const targetSeries = series.find((item) => item.id === seriesId)
      const volumeNumber = getNextVolumeNumber(targetSeries)

      await createVolume(seriesId, {
        volume_number: volumeNumber,
        title: result.title || null,
        isbn: result.isbn || null,
        cover_image_url: result.coverUrl || null,
        publish_date: result.publishedDate || null,
        ownership_status: "owned",
        reading_status: "unread"
      })
    },
    [createVolume, getNextVolumeNumber, series]
  )

  return {
    series,
    unassignedVolumes,
    filteredSeries,
    filteredVolumes: sortedVolumes,
    filteredUnassignedVolumes,
    isLoading,
    fetchSeries,
    createSeries,
    editSeries,
    removeSeries,
    createVolume,
    editVolume,
    removeVolume,
    addBookFromSearchResult,
    addVolumeFromSearchResult
  }
}
