"use client"

import { useCallback, useMemo } from "react"
import { useLibraryStore } from "@/lib/store/library-store"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

/** A volume paired with its parent series, used for flat volume views. @source */
export interface VolumeWithSeries {
  volume: Volume
  series: SeriesWithVolumes
}

export function useLibraryFilters() {
  const {
    series,
    unassignedVolumes,
    filters,
    sortField,
    sortOrder
  } = useLibraryStore()

  const matchesTagFilters = useCallback(
    (seriesTags: string[]) => {
      if (filters.tags.length > 0) {
        if (!filters.tags.every((tag) => seriesTags.includes(tag))) return false
      }
      if (filters.excludeTags.length > 0) {
        if (filters.excludeTags.some((tag) => seriesTags.includes(tag)))
          return false
      }
      return true
    },
    [filters.tags, filters.excludeTags]
  )

  // Filter and sort series based on current filters and sort settings
  const filteredSeries = useMemo(() => {
    const filtered = series.filter((s) => {
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
      if (!matchesTagFilters(s.tags)) return false

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

    const multiplier = sortOrder === "asc" ? 1 : -1
    const compareStrings = (a?: string | null, b?: string | null) =>
      (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" })

    const avgRating = (s: SeriesWithVolumes) => {
      const rated = s.volumes.filter((v) => v.rating != null)
      if (rated.length === 0) return 0
      return rated.reduce((sum, v) => sum + (v.rating ?? 0), 0) / rated.length
    }

    const totalPrice = (s: SeriesWithVolumes) =>
      s.volumes.reduce((sum, v) => sum + (v.purchase_price ?? 0), 0)

    return filtered.sort((a, b) => {
      switch (sortField) {
        case "author":
          return compareStrings(a.author, b.author) * multiplier
        case "created_at":
          return (
            (new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()) *
            multiplier
          )
        case "updated_at":
          return (
            (new Date(a.updated_at).getTime() -
              new Date(b.updated_at).getTime()) *
            multiplier
          )
        case "rating":
          return (
            (avgRating(a) - avgRating(b)) * multiplier ||
            compareStrings(a.title, b.title)
          )
        case "volume_count":
          return (
            (a.volumes.length - b.volumes.length) * multiplier ||
            compareStrings(a.title, b.title)
          )
        case "price":
          return (
            (totalPrice(a) - totalPrice(b)) * multiplier ||
            compareStrings(a.title, b.title)
          )
        case "title":
        default:
          return compareStrings(a.title, b.title) * multiplier
      }
    })
  }, [
    series,
    sortOrder,
    filters.search,
    filters.type,
    filters.ownershipStatus,
    filters.readingStatus,
    matchesTagFilters,
    sortField
  ])

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

      if (!matchesTagFilters(seriesItem.tags)) return false

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
  }, [
    allVolumes,
    filters.ownershipStatus,
    filters.readingStatus,
    filters.search,
    filters.type,
    matchesTagFilters
  ])

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
      if (filters.excludeTags.length > 0) return false

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
        case "rating":
          return (
            ((a.volume.rating ?? 0) - (b.volume.rating ?? 0)) * multiplier ||
            compareStrings(a.series.title, b.series.title)
          )
        case "price":
          return (
            ((a.volume.purchase_price ?? 0) - (b.volume.purchase_price ?? 0)) *
              multiplier || compareStrings(a.series.title, b.series.title)
          )
        case "volume_count":
          return (
            (a.series.volumes.length - b.series.volumes.length) * multiplier ||
            compareStrings(a.series.title, b.series.title)
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

  return {
    filteredSeries,
    filteredVolumes: sortedVolumes,
    filteredUnassignedVolumes,
    allVolumes
  }
}
