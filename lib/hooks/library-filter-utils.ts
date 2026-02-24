/**
 * Pure filtering and sorting utilities extracted from useLibraryFilters.
 * All functions are framework-free and can be imported and tested directly.
 */

import type {
  SeriesStatus,
  SeriesWithVolumes,
  Volume
} from "@/lib/types/database"

/** Inline filter shape used for series filtering. @source */
export type SeriesFilterSnapshot = {
  type: string
  seriesStatus: SeriesStatus | "all"
  ownershipStatus: string
  readingStatus: string
  hasCover: string
  hasIsbn: string
}

/** A volume paired with its parent series, used for flat volume views. @source */
export interface VolumeWithSeries {
  volume: Volume
  series: SeriesWithVolumes
}

/** Case-insensitive, null-safe locale comparator. */
export const compareStrings = (a?: string | null, b?: string | null) =>
  (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" })

/** Parse an ISO-8601 string to a UTC millisecond timestamp; null on failure. */
export function parseTimestamp(raw: string | null | undefined): number | null {
  if (!raw) return null
  const ts = new Date(raw).getTime()
  return Number.isNaN(ts) ? null : ts
}

/** Build a pre-computed date-based cache over volumes. O(S·V) */
export function buildDateCache(
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
export function buildVolumeCache(
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

/** Return a raw comparison value for the given sort field. */
export function getSortValue(
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

/** Sort series in-place with pre-computed caches for expensive fields. O(S·V + S·log S) */
export function sortSeriesInPlace(
  filtered: SeriesWithVolumes[],
  sortField: string,
  sortOrder: string
): SeriesWithVolumes[] {
  const multiplier = sortOrder === "asc" ? 1 : -1
  let cache: Map<string, number> | undefined

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

/** Checks data-completeness filter for cover/isbn fields. */
export function matchesDataFilter(
  volumes: readonly { cover_image_url?: string | null; isbn?: string | null }[],
  hasCover: string,
  hasIsbn: string
): boolean {
  if (hasCover !== "all") {
    const found = volumes.some((v) => Boolean(v.cover_image_url?.trim()))
    if (hasCover === "has" && !found) return false
    if (hasCover === "missing" && found) return false
  }
  if (hasIsbn !== "all") {
    const found = volumes.some((v) => Boolean(v.isbn?.trim()))
    if (hasIsbn === "has" && !found) return false
    if (hasIsbn === "missing" && found) return false
  }
  return true
}

/** Checks whether a series's volumes match ownership/reading/collection filters. */
export function matchesVolumeFilters(
  s: SeriesWithVolumes,
  filters: SeriesFilterSnapshot,
  activeCollectionVolumeIds: Set<string> | null
): boolean {
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
  if (!matchesDataFilter(s.volumes, filters.hasCover, filters.hasIsbn))
    return false
  if (
    activeCollectionVolumeIds &&
    !s.volumes.some((v) => activeCollectionVolumeIds.has(v.id))
  )
    return false
  return true
}

/** Checks whether a series passes the current filter state. */
export function matchesSeriesFilters(
  s: SeriesWithVolumes,
  filters: SeriesFilterSnapshot,
  searchLower: string,
  activeCollectionVolumeIds: Set<string> | null,
  tagFilter: (tags: string[]) => boolean
): boolean {
  if (searchLower) {
    const matchesTitle = s.title.toLowerCase().includes(searchLower)
    const matchesAuthor = s.author?.toLowerCase().includes(searchLower)
    const matchesDesc = s.description?.toLowerCase().includes(searchLower)
    if (!matchesTitle && !matchesAuthor && !matchesDesc) return false
  }
  if (filters.type !== "all" && s.type !== filters.type) return false
  if (filters.seriesStatus !== "all" && s.status !== filters.seriesStatus)
    return false
  if (!tagFilter(s.tags)) return false
  return matchesVolumeFilters(s, filters, activeCollectionVolumeIds)
}
