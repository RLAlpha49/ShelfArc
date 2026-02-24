"use client"

import { useCallback, useMemo } from "react"
import { useShallow } from "zustand/react/shallow"

import { useCollectionsStore } from "@/lib/store/collections-store"
import {
  selectAllSeries,
  selectAllUnassignedVolumes,
  useLibraryStore
} from "@/lib/store/library-store"

import {
  compareStrings,
  matchesSeriesFilters,
  sortSeriesInPlace,
  type VolumeWithSeries
} from "./library-filter-utils"

export type { VolumeWithSeries } from "./library-filter-utils"

export function useLibraryFilters() {
  const series = useLibraryStore(useShallow(selectAllSeries))
  const unassignedVolumes = useLibraryStore(
    useShallow(selectAllUnassignedVolumes)
  )
  const { filters, sortField, sortOrder } = useLibraryStore()
  const { activeCollectionIds, collections } = useCollectionsStore()

  const activeCollectionVolumeIds = useMemo(() => {
    if (activeCollectionIds.length === 0) return null
    const union = new Set<string>()
    for (const aid of activeCollectionIds) {
      const col = collections.find((c) => c.id === aid)
      if (col) {
        for (const vid of col.volumeIds) union.add(vid)
      }
    }
    return union
  }, [activeCollectionIds, collections])

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
    const searchLower = filters.search?.toLowerCase() ?? ""
    const filtered = series.filter((s) =>
      matchesSeriesFilters(
        s,
        filters,
        searchLower,
        activeCollectionVolumeIds,
        matchesTagFilters
      )
    )
    return sortSeriesInPlace(filtered, sortField, sortOrder)
  }, [
    series,
    sortOrder,
    filters,
    matchesTagFilters,
    sortField,
    activeCollectionVolumeIds
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

      if (
        activeCollectionVolumeIds &&
        !activeCollectionVolumeIds.has(volume.id)
      )
        return false

      return true
    })
  }, [
    allVolumes,
    filters.ownershipStatus,
    filters.readingStatus,
    filters.search,
    filters.type,
    matchesTagFilters,
    activeCollectionVolumeIds
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

      if (
        activeCollectionVolumeIds &&
        !activeCollectionVolumeIds.has(volume.id)
      )
        return false

      return true
    })
  }, [filters, unassignedVolumes, activeCollectionVolumeIds])

  const sortedVolumes = useMemo(() => {
    const multiplier = sortOrder === "asc" ? 1 : -1

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
        case "started_at": {
          const aTs = a.volume.started_at
            ? new Date(a.volume.started_at).getTime()
            : 0
          const bTs = b.volume.started_at
            ? new Date(b.volume.started_at).getTime()
            : 0
          return (
            (aTs - bTs) * multiplier ||
            compareStrings(a.series.title, b.series.title)
          )
        }
        case "finished_at": {
          const aTs = a.volume.finished_at
            ? new Date(a.volume.finished_at).getTime()
            : 0
          const bTs = b.volume.finished_at
            ? new Date(b.volume.finished_at).getTime()
            : 0
          return (
            (aTs - bTs) * multiplier ||
            compareStrings(a.series.title, b.series.title)
          )
        }
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
