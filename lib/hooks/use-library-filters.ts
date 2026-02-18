"use client"

import { useCallback, useMemo } from "react"

import { useCollectionsStore } from "@/lib/store/collections-store"
import {
  selectAllSeries,
  selectAllUnassignedVolumes,
  useLibraryStore} from "@/lib/store/library-store"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

/** A volume paired with its parent series, used for flat volume views. @source */
export interface VolumeWithSeries {
  volume: Volume
  series: SeriesWithVolumes
}

const compareStrings = (a?: string | null, b?: string | null) =>
  (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" })

function parseTimestamp(raw: string | null | undefined): number | null {
  if (!raw) return null
  const ts = new Date(raw).getTime()
  return Number.isNaN(ts) ? null : ts
}

/** Build a pre-computed date-based cache over volumes. O(S·V) */
function buildDateCache(
  filtered: SeriesWithVolumes[],
  extract: (v: Volume) => string | null | undefined,
  strategy: "earliest" | "latest"
): Map<string, number> {
  const pick = strategy === "earliest" ? Math.min : Math.max
  const cache = new Map<string, number>()
  for (const s of filtered) {
    const timestamps = s.volumes
      .map((v) => parseTimestamp(extract(v)))
      .filter((ts): ts is number => ts != null)
    cache.set(
      s.id,
      timestamps.length > 0
        ? timestamps.reduce((a, b) => pick(a, b), timestamps[0])
        : 0
    )
  }
  return cache
}

/** Build a pre-computed numeric cache over volumes for the given extractor. O(S·V) */
function buildVolumeCache(
  filtered: SeriesWithVolumes[],
  extract: (v: Volume) => number | null | undefined,
  aggregate: "sum" | "avg"
): Map<string, number> {
  const cache = new Map<string, number>()
  for (const s of filtered) {
    let sum = 0
    let count = 0
    for (const v of s.volumes) {
      const val = extract(v)
      if (val != null) {
        sum += val
        count++
      }
    }
    cache.set(s.id, aggregate === "avg" && count > 0 ? sum / count : sum)
  }
  return cache
}

/** Sort series in-place with pre-computed caches for expensive fields. O(S·V + S·log S) */
function sortSeriesInPlace(
  filtered: SeriesWithVolumes[],
  sortField: string,
  sortOrder: string
): SeriesWithVolumes[] {
  const multiplier = sortOrder === "asc" ? 1 : -1
  let cache: Map<string, number> | undefined

  // Pre-compute expensive per-series values once O(S·V) instead of
  // recomputing them O(S·V·log S) times inside the sort comparator
  if (sortField === "rating") {
    cache = buildVolumeCache(filtered, (v) => v.rating, "avg")
  } else if (sortField === "price") {
    cache = buildVolumeCache(filtered, (v) => v.purchase_price, "sum")
  } else if (sortField === "started_at") {
    cache = buildDateCache(filtered, (v) => v.started_at, "earliest")
  } else if (sortField === "finished_at") {
    cache = buildDateCache(filtered, (v) => v.finished_at, "latest")
  }

  return filtered.sort((a, b) => {
    const primary = getSortValue(a, b, sortField, cache) * multiplier
    return primary || compareStrings(a.title, b.title)
  })
}

/** Return a raw comparison value for the given sort field. */
function getSortValue(
  a: SeriesWithVolumes,
  b: SeriesWithVolumes,
  field: string,
  cache?: Map<string, number>
): number {
  switch (field) {
    case "author":
      return compareStrings(a.author, b.author)
    case "created_at":
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    case "updated_at":
      return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    case "rating":
    case "price":
      return cache!.get(a.id)! - cache!.get(b.id)!
    case "volume_count":
      return a.volumes.length - b.volumes.length
    case "started_at":
    case "finished_at":
      return (cache?.get(a.id) ?? 0) - (cache?.get(b.id) ?? 0)
    default:
      return compareStrings(a.title, b.title)
  }
}

export function useLibraryFilters() {
  const series = useLibraryStore(selectAllSeries)
  const unassignedVolumes = useLibraryStore(selectAllUnassignedVolumes)
  const { filters, sortField, sortOrder } = useLibraryStore()
  const { activeCollectionId, collections } = useCollectionsStore()

  const activeCollectionVolumeIds = useMemo(() => {
    if (!activeCollectionId) return null
    const col = collections.find((c) => c.id === activeCollectionId)
    return col ? new Set(col.volumeIds) : null
  }, [activeCollectionId, collections])

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
    const filtered = series.filter((s) => {
      // Search filter
      if (searchLower) {
        const matchesTitle = s.title.toLowerCase().includes(searchLower)
        const matchesAuthor = s.author?.toLowerCase().includes(searchLower)
        const matchesDescription = s.description
          ?.toLowerCase()
          .includes(searchLower)
        if (!matchesTitle && !matchesAuthor && !matchesDescription) return false
      }

      if (filters.type !== "all" && s.type !== filters.type) return false
      if (!matchesTagFilters(s.tags)) return false

      if (
        filters.ownershipStatus !== "all" &&
        !s.volumes.some((v) => v.ownership_status === filters.ownershipStatus)
      )
        return false

      if (
        filters.readingStatus !== "all" &&
        !s.volumes.some((v) => v.reading_status === filters.readingStatus)
      )
        return false

      if (
        activeCollectionVolumeIds &&
        !s.volumes.some((v) => activeCollectionVolumeIds.has(v.id))
      )
        return false

      return true
    })

    return sortSeriesInPlace(filtered, sortField, sortOrder)
  }, [
    series,
    sortOrder,
    filters.search,
    filters.type,
    filters.ownershipStatus,
    filters.readingStatus,
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
