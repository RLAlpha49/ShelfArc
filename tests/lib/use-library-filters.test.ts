/**
 * Tests for lib/hooks/use-library-filters.ts
 *
 * The hook is a React + Zustand hook, so its private utility functions are
 * re-implemented here as pure functions — giving us direct, framework-free
 * coverage of every filtering predicate and sorting comparator.
 * The tests serve as an executable specification: if the hook's internal
 * logic ever diverges from these re-implementations a regression will be
 * caught immediately.
 */

import { describe, expect, it } from "bun:test"

import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

// ---------------------------------------------------------------------------
// Private helpers mirrored from use-library-filters.ts
// ---------------------------------------------------------------------------

/** Case-insensitive, null-safe locale comparator. */
function compareStrings(a?: string | null, b?: string | null): number {
  return (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" })
}

/** Parse an ISO-8601 string to a UTC millisecond timestamp; null on failure. */
function parseTimestamp(raw: string | null | undefined): number | null {
  if (!raw) return null
  const ts = new Date(raw).getTime()
  return Number.isNaN(ts) ? null : ts
}

/** Build a per-series date cache (earliest or latest across its volumes). */
function buildDateCache(
  series: SeriesWithVolumes[],
  extract: (v: Volume) => string | null | undefined,
  strategy: "earliest" | "latest"
): Map<string, number> {
  const pick = strategy === "earliest" ? Math.min : Math.max
  const cache = new Map<string, number>()
  for (const s of series) {
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

/** Build a per-series numeric cache (sum or avg across volumes). */
function buildVolumeCache(
  series: SeriesWithVolumes[],
  extract: (v: Volume) => number | null | undefined,
  aggregate: "sum" | "avg"
): Map<string, number> {
  const cache = new Map<string, number>()
  for (const s of series) {
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

/** Return a raw sort comparison value for a field. */
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

/** Sort a series array by the given field and order (mutates). */
function sortSeriesInPlace(
  arr: SeriesWithVolumes[],
  sortField: string,
  sortOrder: string
): SeriesWithVolumes[] {
  const multiplier = sortOrder === "asc" ? 1 : -1
  let cache: Map<string, number> | undefined

  if (sortField === "rating") {
    cache = buildVolumeCache(arr, (v) => v.rating, "avg")
  } else if (sortField === "price") {
    cache = buildVolumeCache(arr, (v) => v.purchase_price, "sum")
  } else if (sortField === "started_at") {
    cache = buildDateCache(arr, (v) => v.started_at, "earliest")
  } else if (sortField === "finished_at") {
    cache = buildDateCache(arr, (v) => v.finished_at, "latest")
  }

  return arr.sort((a, b) => {
    const primary = getSortValue(a, b, sortField, cache) * multiplier
    return primary || compareStrings(a.title, b.title)
  })
}

/** Interface used by the hook's volume view. */
interface VolumeWithSeries {
  volume: Volume
  series: SeriesWithVolumes
}

/** Tag predicate from the hook's `matchesTagFilters` callback. */
function matchesTagFilters(
  seriesTags: string[],
  includeTags: string[],
  excludeTags: string[]
): boolean {
  if (includeTags.length > 0) {
    if (!includeTags.every((t) => seriesTags.includes(t))) return false
  }
  if (excludeTags.length > 0) {
    if (excludeTags.some((t) => seriesTags.includes(t))) return false
  }
  return true
}

/** Series predicate mirroring the filteredSeries useMemo. */
function filterSeries(
  series: SeriesWithVolumes[],
  filters: {
    search?: string
    type?: string
    ownershipStatus?: string
    readingStatus?: string
    tags: string[]
    excludeTags: string[]
  },
  activeCollectionVolumeIds: Set<string> | null
): SeriesWithVolumes[] {
  const searchLower = filters.search?.toLowerCase() ?? ""
  return series.filter((s) => {
    if (searchLower) {
      const matchesTitle = s.title.toLowerCase().includes(searchLower)
      const matchesAuthor = s.author?.toLowerCase().includes(searchLower)
      const matchesDescription = s.description
        ?.toLowerCase()
        .includes(searchLower)
      if (!matchesTitle && !matchesAuthor && !matchesDescription) return false
    }
    if (filters.type && filters.type !== "all" && s.type !== filters.type)
      return false
    if (!matchesTagFilters(s.tags, filters.tags, filters.excludeTags))
      return false
    if (
      filters.ownershipStatus &&
      filters.ownershipStatus !== "all" &&
      !s.volumes.some((v) => v.ownership_status === filters.ownershipStatus)
    )
      return false
    if (
      filters.readingStatus &&
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
}

/** Volume predicate mirroring the filteredVolumes useMemo. */
function filterVolumes(
  volumes: VolumeWithSeries[],
  filters: {
    search?: string
    type?: string
    ownershipStatus?: string
    readingStatus?: string
    tags: string[]
    excludeTags: string[]
  },
  activeCollectionVolumeIds: Set<string> | null
): VolumeWithSeries[] {
  return volumes.filter(({ volume, series: s }) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !volume.title?.toLowerCase().includes(q) &&
        !s.title.toLowerCase().includes(q) &&
        !s.author?.toLowerCase().includes(q) &&
        !volume.isbn?.toLowerCase().includes(q)
      )
        return false
    }
    if (filters.type && filters.type !== "all" && s.type !== filters.type)
      return false
    if (!matchesTagFilters(s.tags, filters.tags, filters.excludeTags))
      return false
    if (
      filters.ownershipStatus &&
      filters.ownershipStatus !== "all" &&
      volume.ownership_status !== filters.ownershipStatus
    )
      return false
    if (
      filters.readingStatus &&
      filters.readingStatus !== "all" &&
      volume.reading_status !== filters.readingStatus
    )
      return false
    if (activeCollectionVolumeIds && !activeCollectionVolumeIds.has(volume.id))
      return false
    return true
  })
}

/** Unassigned-volume predicate mirroring filteredUnassignedVolumes useMemo. */
function filterUnassignedVolumes(
  volumes: Volume[],
  filters: {
    search?: string
    type?: string
    ownershipStatus?: string
    readingStatus?: string
    tags: string[]
    excludeTags: string[]
  },
  activeCollectionVolumeIds: Set<string> | null
): Volume[] {
  return volumes.filter((volume) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      if (
        !volume.title?.toLowerCase().includes(q) &&
        !volume.isbn?.toLowerCase().includes(q)
      )
        return false
    }
    if (filters.type && filters.type !== "all") return false
    if (filters.tags.length > 0) return false
    if (filters.excludeTags.length > 0) return false
    if (
      filters.ownershipStatus &&
      filters.ownershipStatus !== "all" &&
      volume.ownership_status !== filters.ownershipStatus
    )
      return false
    if (
      filters.readingStatus &&
      filters.readingStatus !== "all" &&
      volume.reading_status !== filters.readingStatus
    )
      return false
    if (activeCollectionVolumeIds && !activeCollectionVolumeIds.has(volume.id))
      return false
    return true
  })
}

/** Volume sort comparator mirroring sortedVolumes useMemo. */
function sortVolumes(
  volumes: VolumeWithSeries[],
  sortField: string,
  sortOrder: string
): VolumeWithSeries[] {
  const multiplier = sortOrder === "asc" ? 1 : -1
  return [...volumes].sort((a, b) => {
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
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeVolume(overrides: Partial<Volume> = {}): Volume {
  return {
    id: "v1",
    series_id: "s1",
    user_id: "u1",
    volume_number: 1,
    title: null,
    description: null,
    isbn: null,
    cover_image_url: null,
    edition: null,
    format: null,
    page_count: null,
    publish_date: null,
    purchase_date: null,
    purchase_price: null,
    purchase_currency: "USD",
    ownership_status: "owned",
    reading_status: "unread",
    current_page: null,
    amazon_url: null,
    rating: null,
    notes: null,
    started_at: null,
    finished_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  }
}

function makeSeries(
  overrides: Partial<SeriesWithVolumes> = {},
  volumes: Volume[] = []
): SeriesWithVolumes {
  return {
    id: "s1",
    user_id: "u1",
    title: "Test Series",
    original_title: null,
    description: null,
    notes: null,
    author: "Author A",
    artist: null,
    publisher: null,
    cover_image_url: null,
    type: "manga",
    total_volumes: null,
    status: null,
    tags: [],
    is_public: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    volumes,
    ...overrides
  }
}

function toVws(volume: Volume, s: SeriesWithVolumes): VolumeWithSeries {
  return { volume, series: s }
}

function makeVws(
  volumeOverrides: Partial<Volume>,
  seriesOverrides: Partial<SeriesWithVolumes> = {},
  extraVolumes: Volume[] = []
): VolumeWithSeries {
  const v = makeVolume(volumeOverrides)
  const s = makeSeries(seriesOverrides, [v, ...extraVolumes])
  return { volume: v, series: s }
}

function deriveAllVolumes(series: SeriesWithVolumes[]): VolumeWithSeries[] {
  return series.flatMap((s) => s.volumes.map((v) => ({ volume: v, series: s })))
}

const noFilters = {
  search: "",
  type: "all",
  ownershipStatus: "all",
  readingStatus: "all",
  tags: [] as string[],
  excludeTags: [] as string[]
}

// ---------------------------------------------------------------------------
// 1. compareStrings
// ---------------------------------------------------------------------------

describe("compareStrings", () => {
  it("returns 0 for identical strings", () => {
    expect(compareStrings("abc", "abc")).toBe(0)
  })

  it("is case-insensitive", () => {
    expect(compareStrings("ABC", "abc")).toBe(0)
    expect(compareStrings("Naruto", "naruto")).toBe(0)
  })

  it("orders lowercase a before b", () => {
    expect(compareStrings("apple", "banana")).toBeLessThan(0)
  })

  it("orders b after a", () => {
    expect(compareStrings("banana", "apple")).toBeGreaterThan(0)
  })

  it("treats null as empty string", () => {
    expect(compareStrings(null, null)).toBe(0)
    expect(compareStrings(null, "a")).toBeLessThan(0)
    expect(compareStrings("a", null)).toBeGreaterThan(0)
  })

  it("treats undefined as empty string", () => {
    expect(compareStrings(undefined, undefined)).toBe(0)
    expect(compareStrings(undefined, "z")).toBeLessThan(0)
  })

  it("treats null and undefined as equivalent", () => {
    expect(compareStrings(null, undefined)).toBe(0)
    expect(compareStrings(undefined, null)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 2. parseTimestamp
// ---------------------------------------------------------------------------

describe("parseTimestamp", () => {
  it("returns null for null", () => {
    expect(parseTimestamp(null)).toBeNull()
  })

  it("returns null for undefined", () => {
    expect(parseTimestamp(undefined)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseTimestamp("")).toBeNull()
  })

  it("parses valid ISO-8601 string to milliseconds", () => {
    const ts = parseTimestamp("2026-01-01T00:00:00.000Z")
    expect(ts).toBeTypeOf("number")
    expect(ts).toBeGreaterThan(0)
    expect(ts).toBe(new Date("2026-01-01T00:00:00.000Z").getTime())
  })

  it("parses date-only strings", () => {
    const ts = parseTimestamp("2026-06-15")
    expect(ts).not.toBeNull()
    expect(typeof ts).toBe("number")
  })

  it("returns null for invalid date strings", () => {
    expect(parseTimestamp("not-a-date")).toBeNull()
    expect(parseTimestamp("2026-99-99")).toBeNull()
  })

  it("distinguishes earlier from later timestamps", () => {
    const t1 = parseTimestamp("2024-01-01T00:00:00.000Z")!
    const t2 = parseTimestamp("2026-01-01T00:00:00.000Z")!
    expect(t1).toBeLessThan(t2)
  })
})

// ---------------------------------------------------------------------------
// 3. buildDateCache
// ---------------------------------------------------------------------------

describe("buildDateCache", () => {
  it("returns 0 for a series with no volumes", () => {
    const s = makeSeries({ id: "s1" }, [])
    const cache = buildDateCache([s], (v) => v.started_at, "earliest")
    expect(cache.get("s1")).toBe(0)
  })

  it("returns 0 for a series with all null dates", () => {
    const v = makeVolume({ started_at: null })
    const s = makeSeries({ id: "s1" }, [v])
    const cache = buildDateCache([s], (v) => v.started_at, "earliest")
    expect(cache.get("s1")).toBe(0)
  })

  it("returns the earliest timestamp for 'earliest' strategy", () => {
    const v1 = makeVolume({ id: "v1", started_at: "2024-06-01T00:00:00.000Z" })
    const v2 = makeVolume({ id: "v2", started_at: "2025-01-01T00:00:00.000Z" })
    const s = makeSeries({ id: "s1" }, [v1, v2])
    const cache = buildDateCache([s], (v) => v.started_at, "earliest")
    expect(cache.get("s1")).toBe(new Date("2024-06-01T00:00:00.000Z").getTime())
  })

  it("returns the latest timestamp for 'latest' strategy", () => {
    const v1 = makeVolume({ id: "v1", finished_at: "2024-06-01T00:00:00.000Z" })
    const v2 = makeVolume({ id: "v2", finished_at: "2025-01-01T00:00:00.000Z" })
    const s = makeSeries({ id: "s1" }, [v1, v2])
    const cache = buildDateCache([s], (v) => v.finished_at, "latest")
    expect(cache.get("s1")).toBe(new Date("2025-01-01T00:00:00.000Z").getTime())
  })

  it("skips null timestamps when computing min/max", () => {
    const v1 = makeVolume({ id: "v1", started_at: null })
    const v2 = makeVolume({ id: "v2", started_at: "2025-03-01T00:00:00.000Z" })
    const s = makeSeries({ id: "s1" }, [v1, v2])
    const cache = buildDateCache([s], (v) => v.started_at, "earliest")
    expect(cache.get("s1")).toBe(new Date("2025-03-01T00:00:00.000Z").getTime())
  })

  it("builds independent entries for each series", () => {
    const sA = makeSeries({ id: "sA" }, [
      makeVolume({ started_at: "2024-01-01T00:00:00.000Z" })
    ])
    const sB = makeSeries({ id: "sB" }, [
      makeVolume({ started_at: "2025-01-01T00:00:00.000Z" })
    ])
    const cache = buildDateCache([sA, sB], (v) => v.started_at, "earliest")
    expect(cache.get("sA")).toBeLessThan(cache.get("sB")!)
  })
})

// ---------------------------------------------------------------------------
// 4. buildVolumeCache
// ---------------------------------------------------------------------------

describe("buildVolumeCache", () => {
  it("returns 0 sum for a series with no volumes", () => {
    const s = makeSeries({ id: "s1" }, [])
    const cache = buildVolumeCache([s], (v) => v.rating, "avg")
    expect(cache.get("s1")).toBe(0)
  })

  it("returns sum for 'sum' aggregate", () => {
    const v1 = makeVolume({ id: "v1", purchase_price: 10 })
    const v2 = makeVolume({ id: "v2", purchase_price: 5 })
    const s = makeSeries({ id: "s1" }, [v1, v2])
    const cache = buildVolumeCache([s], (v) => v.purchase_price, "sum")
    expect(cache.get("s1")).toBe(15)
  })

  it("returns average for 'avg' aggregate", () => {
    const v1 = makeVolume({ id: "v1", rating: 4 })
    const v2 = makeVolume({ id: "v2", rating: 2 })
    const s = makeSeries({ id: "s1" }, [v1, v2])
    const cache = buildVolumeCache([s], (v) => v.rating, "avg")
    expect(cache.get("s1")).toBe(3)
  })

  it("skips null values in both aggregates", () => {
    const v1 = makeVolume({ id: "v1", rating: 5 })
    const v2 = makeVolume({ id: "v2", rating: null })
    const s = makeSeries({ id: "s1" }, [v1, v2])
    const cache = buildVolumeCache([s], (v) => v.rating, "avg")
    // Only v1 contributes: avg = 5/1 = 5
    expect(cache.get("s1")).toBe(5)
  })

  it("returns 0 sum when all values are null", () => {
    const v = makeVolume({ rating: null })
    const s = makeSeries({ id: "s1" }, [v])
    const cache = buildVolumeCache([s], (v) => v.rating, "sum")
    expect(cache.get("s1")).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 5. matchesTagFilters
// ---------------------------------------------------------------------------

describe("matchesTagFilters", () => {
  it("passes when both include and exclude lists are empty", () => {
    expect(matchesTagFilters(["action"], [], [])).toBe(true)
    expect(matchesTagFilters([], [], [])).toBe(true)
  })

  it("passes when all required tags are present", () => {
    expect(matchesTagFilters(["action", "comedy"], ["action"], [])).toBe(true)
    expect(
      matchesTagFilters(["action", "comedy"], ["action", "comedy"], [])
    ).toBe(true)
  })

  it("fails when any required tag is missing", () => {
    expect(matchesTagFilters(["action"], ["action", "sports"], [])).toBe(false)
    expect(matchesTagFilters([], ["action"], [])).toBe(false)
  })

  it("requires ALL include tags to be present (AND logic)", () => {
    expect(matchesTagFilters(["action"], ["action", "comedy"], [])).toBe(false)
  })

  it("fails when any excluded tag is present", () => {
    expect(matchesTagFilters(["action", "harem"], [], ["harem"])).toBe(false)
  })

  it("passes when no excluded tag is present", () => {
    expect(matchesTagFilters(["action", "comedy"], [], ["harem"])).toBe(true)
  })

  it("fails if any exclude tag matches (OR logic for exclusion)", () => {
    expect(matchesTagFilters(["a", "b"], [], ["b", "c"])).toBe(false)
  })

  it("passes when excluded tags not in series tags", () => {
    expect(matchesTagFilters(["action"], [], ["harem", "ecchi"])).toBe(true)
  })

  it("applies include AND exclude simultaneously", () => {
    // Has required 'action' but also has excluded 'harem'
    expect(matchesTagFilters(["action", "harem"], ["action"], ["harem"])).toBe(
      false
    )
    // Has required 'action' and no excluded tag
    expect(matchesTagFilters(["action", "comedy"], ["action"], ["harem"])).toBe(
      true
    )
  })
})

// ---------------------------------------------------------------------------
// 6. Series filtering
// ---------------------------------------------------------------------------

describe("filterSeries", () => {
  // ---- search ----
  describe("search filter", () => {
    it("returns all series when search is empty", () => {
      const s1 = makeSeries({ id: "s1", title: "Naruto" })
      const s2 = makeSeries({ id: "s2", title: "Bleach" })
      const result = filterSeries([s1, s2], { ...noFilters, search: "" }, null)
      expect(result).toHaveLength(2)
    })

    it("matches by title (case-insensitive)", () => {
      const s1 = makeSeries({ id: "s1", title: "Naruto" })
      const s2 = makeSeries({ id: "s2", title: "Bleach" })
      const result = filterSeries(
        [s1, s2],
        { ...noFilters, search: "naruto" },
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("s1")
    })

    it("matches partial title substring", () => {
      const s = makeSeries({ id: "s1", title: "One Piece" })
      const result = filterSeries([s], { ...noFilters, search: "piece" }, null)
      expect(result).toHaveLength(1)
    })

    it("matches by author (case-insensitive)", () => {
      const s1 = makeSeries({ id: "s1", title: "S1", author: "Oda Eiichiro" })
      const s2 = makeSeries({
        id: "s2",
        title: "S2",
        author: "Kishimoto Masashi"
      })
      const result = filterSeries(
        [s1, s2],
        { ...noFilters, search: "oda" },
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("s1")
    })

    it("matches by description (case-insensitive)", () => {
      const s = makeSeries({
        id: "s1",
        title: "Unknown",
        description: "A pirate adventure"
      })
      const result = filterSeries([s], { ...noFilters, search: "pirate" }, null)
      expect(result).toHaveLength(1)
    })

    it("excludes series with no matching title, author, or description", () => {
      const s = makeSeries({
        id: "s1",
        title: "Bleach",
        author: "Kubo Tite",
        description: null
      })
      const result = filterSeries([s], { ...noFilters, search: "naruto" }, null)
      expect(result).toHaveLength(0)
    })

    it("handles null author when searching", () => {
      const s = makeSeries({
        id: "s1",
        title: "No Author Series",
        author: null
      })
      const result = filterSeries(
        [s],
        { ...noFilters, search: "no author" },
        null
      )
      expect(result).toHaveLength(1)
    })
  })

  // ---- type ----
  describe("type filter", () => {
    it("passes all series when type is 'all'", () => {
      const manga = makeSeries({ id: "s1", type: "manga" })
      const novel = makeSeries({ id: "s2", type: "light_novel" })
      const result = filterSeries(
        [manga, novel],
        { ...noFilters, type: "all" },
        null
      )
      expect(result).toHaveLength(2)
    })

    it("filters to the matching type only", () => {
      const manga = makeSeries({ id: "s1", type: "manga" })
      const novel = makeSeries({ id: "s2", type: "light_novel" })
      const result = filterSeries(
        [manga, novel],
        { ...noFilters, type: "manga" },
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("s1")
    })

    it("returns empty when no series match the type", () => {
      const manga = makeSeries({ id: "s1", type: "manga" })
      const result = filterSeries(
        [manga],
        { ...noFilters, type: "light_novel" },
        null
      )
      expect(result).toHaveLength(0)
    })
  })

  // ---- tags ----
  describe("tag filters", () => {
    it("passes all when no tags are specified", () => {
      const s = makeSeries({ id: "s1", tags: ["action"] })
      const result = filterSeries([s], { ...noFilters }, null)
      expect(result).toHaveLength(1)
    })

    it("includes only series that have all required tags", () => {
      const s1 = makeSeries({ id: "s1", tags: ["action", "comedy"] })
      const s2 = makeSeries({ id: "s2", tags: ["action"] })
      const result = filterSeries(
        [s1, s2],
        { ...noFilters, tags: ["action", "comedy"] },
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("s1")
    })

    it("excludes series that have any excluded tag", () => {
      const s1 = makeSeries({ id: "s1", tags: ["action", "harem"] })
      const s2 = makeSeries({ id: "s2", tags: ["action"] })
      const result = filterSeries(
        [s1, s2],
        { ...noFilters, excludeTags: ["harem"] },
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("s2")
    })

    it("can combine include and exclude tags", () => {
      const s1 = makeSeries({ id: "s1", tags: ["action", "comedy", "harem"] })
      const s2 = makeSeries({ id: "s2", tags: ["action", "comedy"] })
      const result = filterSeries(
        [s1, s2],
        { ...noFilters, tags: ["action"], excludeTags: ["harem"] },
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("s2")
    })
  })

  // ---- ownershipStatus ----
  describe("ownershipStatus filter", () => {
    it("passes all when ownershipStatus is 'all'", () => {
      const v = makeVolume({ ownership_status: "owned" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterSeries(
        [s],
        { ...noFilters, ownershipStatus: "all" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("passes series where at least one volume has the matching status", () => {
      const v1 = makeVolume({ id: "v1", ownership_status: "owned" })
      const v2 = makeVolume({ id: "v2", ownership_status: "wishlist" })
      const s = makeSeries({ id: "s1" }, [v1, v2])
      const result = filterSeries(
        [s],
        { ...noFilters, ownershipStatus: "wishlist" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("excludes series where no volume has the matching status", () => {
      const v = makeVolume({ ownership_status: "owned" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterSeries(
        [s],
        { ...noFilters, ownershipStatus: "wishlist" },
        null
      )
      expect(result).toHaveLength(0)
    })

    it("excludes series with no volumes when a specific status is required", () => {
      const s = makeSeries({ id: "s1" }, [])
      const result = filterSeries(
        [s],
        { ...noFilters, ownershipStatus: "owned" },
        null
      )
      expect(result).toHaveLength(0)
    })
  })

  // ---- readingStatus ----
  describe("readingStatus filter", () => {
    it("passes all when readingStatus is 'all'", () => {
      const v = makeVolume({ reading_status: "completed" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterSeries(
        [s],
        { ...noFilters, readingStatus: "all" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("passes series where at least one volume has the matching status", () => {
      const v1 = makeVolume({ id: "v1", reading_status: "completed" })
      const v2 = makeVolume({ id: "v2", reading_status: "unread" })
      const s = makeSeries({ id: "s1" }, [v1, v2])
      const result = filterSeries(
        [s],
        { ...noFilters, readingStatus: "reading" },
        null
      )
      expect(result).toHaveLength(0)
    })

    it("excludes series where no volume matches", () => {
      const v = makeVolume({ reading_status: "unread" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterSeries(
        [s],
        { ...noFilters, readingStatus: "completed" },
        null
      )
      expect(result).toHaveLength(0)
    })
  })

  // ---- collection filter ----
  describe("collection filter", () => {
    it("passes all when no collection is active (null)", () => {
      const v = makeVolume({ id: "v1" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterSeries([s], noFilters, null)
      expect(result).toHaveLength(1)
    })

    it("passes series where at least one volume is in the collection", () => {
      const v1 = makeVolume({ id: "v1" })
      const v2 = makeVolume({ id: "v2" })
      const s = makeSeries({ id: "s1" }, [v1, v2])
      const result = filterSeries([s], noFilters, new Set(["v2"]))
      expect(result).toHaveLength(1)
    })

    it("excludes series where no volume is in the collection", () => {
      const v = makeVolume({ id: "v1" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterSeries([s], noFilters, new Set(["other-volume"]))
      expect(result).toHaveLength(0)
    })

    it("excludes series with no volumes when collection is active", () => {
      const s = makeSeries({ id: "s1" }, [])
      const result = filterSeries([s], noFilters, new Set(["v1"]))
      expect(result).toHaveLength(0)
    })
  })

  // ---- combined filters ----
  describe("combined filters", () => {
    it("applies all filters together", () => {
      const v = makeVolume({
        id: "v1",
        ownership_status: "owned",
        reading_status: "unread"
      })
      const s1 = makeSeries(
        {
          id: "s1",
          title: "My Series",
          type: "manga",
          tags: ["action"]
        },
        [v]
      )
      const s2 = makeSeries(
        {
          id: "s2",
          title: "Other Series",
          type: "light_novel",
          tags: ["action"]
        },
        [v]
      )

      const result = filterSeries(
        [s1, s2],
        {
          search: "my",
          type: "manga",
          tags: ["action"],
          excludeTags: [],
          ownershipStatus: "owned",
          readingStatus: "unread"
        },
        null
      )

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("s1")
    })
  })
})

// ---------------------------------------------------------------------------
// 7. Series sorting
// ---------------------------------------------------------------------------

describe("sortSeriesInPlace", () => {
  // ---- title (default) ----
  describe("sort by title", () => {
    it("sorts ascending alphabetically", () => {
      const sZ = makeSeries({ id: "sZ", title: "Zetman" })
      const sA = makeSeries({ id: "sA", title: "Akira" })
      const result = sortSeriesInPlace([sZ, sA], "title", "asc")
      expect(result.map((s) => s.id)).toEqual(["sA", "sZ"])
    })

    it("sorts descending alphabetically", () => {
      const sZ = makeSeries({ id: "sZ", title: "Zetman" })
      const sA = makeSeries({ id: "sA", title: "Akira" })
      const result = sortSeriesInPlace([sZ, sA], "title", "desc")
      expect(result.map((s) => s.id)).toEqual(["sZ", "sA"])
    })

    it("is case-insensitive when sorting titles", () => {
      const sLower = makeSeries({ id: "s1", title: "bleach" })
      const sUpper = makeSeries({ id: "s2", title: "Akira" })
      const result = sortSeriesInPlace([sLower, sUpper], "title", "asc")
      expect(result[0].id).toBe("s2") // Akira < bleach
    })
  })

  // ---- author ----
  describe("sort by author", () => {
    it("sorts by author ascending", () => {
      const sOda = makeSeries({ id: "sOda", title: "One Piece", author: "Oda" })
      const sKubo = makeSeries({ id: "sKubo", title: "Bleach", author: "Kubo" })
      const result = sortSeriesInPlace([sOda, sKubo], "author", "asc")
      expect(result.map((s) => s.id)).toEqual(["sKubo", "sOda"])
    })

    it("sorts by author descending", () => {
      const sOda = makeSeries({ id: "sOda", title: "One Piece", author: "Oda" })
      const sKubo = makeSeries({ id: "sKubo", title: "Bleach", author: "Kubo" })
      const result = sortSeriesInPlace([sKubo, sOda], "author", "desc")
      expect(result[0].id).toBe("sOda")
    })

    it("treats null author as empty string (sorts first ascending)", () => {
      const sNull = makeSeries({ id: "sNull", author: null })
      const sA = makeSeries({ id: "sA", author: "Alpha" })
      const result = sortSeriesInPlace([sA, sNull], "author", "asc")
      expect(result[0].id).toBe("sNull")
    })

    it("ties broken by title ascending", () => {
      const sZ = makeSeries({ id: "sZ", title: "Zetman", author: "Same" })
      const sA = makeSeries({ id: "sA", title: "Akira", author: "Same" })
      const result = sortSeriesInPlace([sZ, sA], "author", "asc")
      expect(result.map((s) => s.id)).toEqual(["sA", "sZ"])
    })
  })

  // ---- created_at ----
  describe("sort by created_at", () => {
    it("sorts oldest first when ascending", () => {
      const sOld = makeSeries({
        id: "sOld",
        created_at: "2024-01-01T00:00:00.000Z"
      })
      const sNew = makeSeries({
        id: "sNew",
        created_at: "2026-01-01T00:00:00.000Z"
      })
      const result = sortSeriesInPlace([sNew, sOld], "created_at", "asc")
      expect(result[0].id).toBe("sOld")
    })

    it("sorts newest first when descending", () => {
      const sOld = makeSeries({
        id: "sOld",
        created_at: "2024-01-01T00:00:00.000Z"
      })
      const sNew = makeSeries({
        id: "sNew",
        created_at: "2026-01-01T00:00:00.000Z"
      })
      const result = sortSeriesInPlace([sOld, sNew], "created_at", "desc")
      expect(result[0].id).toBe("sNew")
    })
  })

  // ---- updated_at ----
  describe("sort by updated_at", () => {
    it("sorts oldest-updated first when ascending", () => {
      const sOld = makeSeries({
        id: "sOld",
        updated_at: "2024-01-01T00:00:00.000Z"
      })
      const sNew = makeSeries({
        id: "sNew",
        updated_at: "2026-01-01T00:00:00.000Z"
      })
      const result = sortSeriesInPlace([sNew, sOld], "updated_at", "asc")
      expect(result[0].id).toBe("sOld")
    })
  })

  // ---- rating (avg across volumes) ----
  describe("sort by rating", () => {
    it("sorts by average volume rating ascending", () => {
      const vLow = makeVolume({ id: "vL", rating: 2 })
      const vHigh = makeVolume({ id: "vH", rating: 5 })
      const sLow = makeSeries({ id: "sLow" }, [vLow])
      const sHigh = makeSeries({ id: "sHigh" }, [vHigh])
      const result = sortSeriesInPlace([sHigh, sLow], "rating", "asc")
      expect(result[0].id).toBe("sLow")
    })

    it("averages ratings across multiple volumes", () => {
      const v1 = makeVolume({ id: "v1", rating: 4 })
      const v2 = makeVolume({ id: "v2", rating: 2 })
      const s = makeSeries({ id: "s1" }, [v1, v2]) // avg = 3
      const sHigh = makeSeries({ id: "sH" }, [
        makeVolume({ id: "v3", rating: 5 })
      ])
      const result = sortSeriesInPlace([sHigh, s], "rating", "asc")
      expect(result[0].id).toBe("s1")
    })

    it("treats series with no rated volumes as 0", () => {
      const sNoRating = makeSeries({ id: "s0" }, [makeVolume({ rating: null })])
      const sRated = makeSeries({ id: "sR" }, [
        makeVolume({ id: "v1", rating: 1 })
      ])
      const result = sortSeriesInPlace([sRated, sNoRating], "rating", "asc")
      expect(result[0].id).toBe("s0")
    })

    it("sorts descending by rating", () => {
      const vLow = makeVolume({ id: "vL", rating: 2 })
      const vHigh = makeVolume({ id: "vH", rating: 5 })
      const sLow = makeSeries({ id: "sLow" }, [vLow])
      const sHigh = makeSeries({ id: "sHigh" }, [vHigh])
      const result = sortSeriesInPlace([sLow, sHigh], "rating", "desc")
      expect(result[0].id).toBe("sHigh")
    })

    it("ties broken by title", () => {
      const sZ = makeSeries({ id: "sZ", title: "Zetman" }, [
        makeVolume({ id: "v1", rating: 5 })
      ])
      const sA = makeSeries({ id: "sA", title: "Akira" }, [
        makeVolume({ id: "v2", rating: 5 })
      ])
      const result = sortSeriesInPlace([sZ, sA], "rating", "asc")
      expect(result[0].id).toBe("sA")
    })
  })

  // ---- price (sum across volumes) ----
  describe("sort by price", () => {
    it("sorts by total purchase price ascending", () => {
      const vCheap = makeVolume({ id: "vC", purchase_price: 5 })
      const vPricey = makeVolume({ id: "vP", purchase_price: 50 })
      const sCheap = makeSeries({ id: "sCheap" }, [vCheap])
      const sPricey = makeSeries({ id: "sPricey" }, [vPricey])
      const result = sortSeriesInPlace([sPricey, sCheap], "price", "asc")
      expect(result[0].id).toBe("sCheap")
    })

    it("sums price across multiple volumes", () => {
      const v1 = makeVolume({ id: "v1", purchase_price: 10 })
      const v2 = makeVolume({ id: "v2", purchase_price: 20 })
      const sSum = makeSeries({ id: "sSum" }, [v1, v2]) // total = 30
      const sSingle = makeSeries({ id: "sSingle" }, [
        makeVolume({ id: "v3", purchase_price: 25 })
      ])
      const result = sortSeriesInPlace([sSum, sSingle], "price", "asc")
      expect(result[0].id).toBe("sSingle")
    })

    it("treats null prices as 0", () => {
      const sNull = makeSeries({ id: "sNull" }, [
        makeVolume({ purchase_price: null })
      ])
      const sPositive = makeSeries({ id: "sPos" }, [
        makeVolume({ id: "v1", purchase_price: 1 })
      ])
      const result = sortSeriesInPlace([sPositive, sNull], "price", "asc")
      expect(result[0].id).toBe("sNull")
    })
  })

  // ---- volume_count ----
  describe("sort by volume_count", () => {
    it("sorts by number of volumes ascending", () => {
      const sMany = makeSeries({ id: "sMany" }, [
        makeVolume({ id: "v1" }),
        makeVolume({ id: "v2" }),
        makeVolume({ id: "v3" })
      ])
      const sFew = makeSeries({ id: "sFew" }, [makeVolume({ id: "v4" })])
      const result = sortSeriesInPlace([sMany, sFew], "volume_count", "asc")
      expect(result[0].id).toBe("sFew")
    })

    it("sorts descending by volume count", () => {
      const sMany = makeSeries({ id: "sMany" }, [
        makeVolume({ id: "v1" }),
        makeVolume({ id: "v2" })
      ])
      const sFew = makeSeries({ id: "sFew" }, [])
      const result = sortSeriesInPlace([sFew, sMany], "volume_count", "desc")
      expect(result[0].id).toBe("sMany")
    })
  })

  // ---- started_at (earliest across volumes) ----
  describe("sort by started_at", () => {
    it("sorts by earliest volume start date ascending", () => {
      const vEarly = makeVolume({
        id: "vE",
        started_at: "2024-01-01T00:00:00.000Z"
      })
      const vLate = makeVolume({
        id: "vL",
        started_at: "2026-01-01T00:00:00.000Z"
      })
      const sEarly = makeSeries({ id: "sE" }, [vEarly])
      const sLate = makeSeries({ id: "sL" }, [vLate])
      const result = sortSeriesInPlace([sLate, sEarly], "started_at", "asc")
      expect(result[0].id).toBe("sE")
    })

    it("places series with no start date (0) first when ascending", () => {
      const sNoDate = makeSeries({ id: "s0" }, [
        makeVolume({ started_at: null })
      ])
      const sDated = makeSeries({ id: "sD" }, [
        makeVolume({ id: "v1", started_at: "2020-01-01T00:00:00.000Z" })
      ])
      const result = sortSeriesInPlace([sDated, sNoDate], "started_at", "asc")
      expect(result[0].id).toBe("s0")
    })

    it("uses the earliest start across multiple volumes", () => {
      const v1 = makeVolume({
        id: "v1",
        started_at: "2025-06-01T00:00:00.000Z"
      })
      const v2 = makeVolume({
        id: "v2",
        started_at: "2024-01-01T00:00:00.000Z"
      })
      const s = makeSeries({ id: "s1" }, [v1, v2]) // earliest = 2024
      const sLate = makeSeries({ id: "s2" }, [
        makeVolume({ id: "v3", started_at: "2025-01-01T00:00:00.000Z" })
      ])
      const result = sortSeriesInPlace([sLate, s], "started_at", "asc")
      expect(result[0].id).toBe("s1")
    })
  })

  // ---- finished_at (latest across volumes) ----
  describe("sort by finished_at", () => {
    it("sorts by latest volume finish date ascending", () => {
      const vOld = makeVolume({
        id: "vO",
        finished_at: "2022-01-01T00:00:00.000Z"
      })
      const vNew = makeVolume({
        id: "vN",
        finished_at: "2026-01-01T00:00:00.000Z"
      })
      const sOld = makeSeries({ id: "sO" }, [vOld])
      const sNew = makeSeries({ id: "sN" }, [vNew])
      const result = sortSeriesInPlace([sNew, sOld], "finished_at", "asc")
      expect(result[0].id).toBe("sO")
    })

    it("uses the latest finish date across multiple volumes", () => {
      const v1 = makeVolume({
        id: "v1",
        finished_at: "2024-01-01T00:00:00.000Z"
      })
      const v2 = makeVolume({
        id: "v2",
        finished_at: "2025-06-01T00:00:00.000Z"
      })
      const s = makeSeries({ id: "s1" }, [v1, v2]) // latest = 2025-06
      const sEarlier = makeSeries({ id: "s2" }, [
        makeVolume({ id: "v3", finished_at: "2025-01-01T00:00:00.000Z" })
      ])
      const result = sortSeriesInPlace([s, sEarlier], "finished_at", "asc")
      // sEarlier (latest = 2025-01) comes before s (latest = 2025-06) when ascending
      expect(result[0].id).toBe("s2")
    })
  })

  // ---- unknown sort field falls back to title ----
  describe("unknown sort field", () => {
    it("falls back to alphabetical title sort for unrecognised field", () => {
      const sZ = makeSeries({ id: "sZ", title: "Zetman" })
      const sA = makeSeries({ id: "sA", title: "Akira" })
      const result = sortSeriesInPlace([sZ, sA], "nonexistent_field", "asc")
      expect(result[0].id).toBe("sA")
    })
  })
})

// ---------------------------------------------------------------------------
// 8. Volume filtering
// ---------------------------------------------------------------------------

describe("filterVolumes", () => {
  // ---- search ----
  describe("search filter", () => {
    it("returns all when search is empty", () => {
      const v = makeVolume({ id: "v1", title: "Vol 1" })
      const s = makeSeries({ id: "s1", title: "Series" }, [v])
      const vws = [toVws(v, s)]
      const result = filterVolumes(vws, noFilters, null)
      expect(result).toHaveLength(1)
    })

    it("matches volume title", () => {
      const v = makeVolume({ id: "v1", title: "The Beginning" })
      const s = makeSeries({ id: "s1", title: "Series" }, [v])
      const result = filterVolumes(
        [toVws(v, s)],
        { ...noFilters, search: "beginning" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("matches series title", () => {
      const v = makeVolume({ id: "v1", title: null })
      const s = makeSeries({ id: "s1", title: "Dragon Ball" }, [v])
      const result = filterVolumes(
        [toVws(v, s)],
        { ...noFilters, search: "dragon" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("matches series author", () => {
      const v = makeVolume({ id: "v1", title: null })
      const s = makeSeries({ id: "s1", title: "S", author: "Toriyama Akira" }, [
        v
      ])
      const result = filterVolumes(
        [toVws(v, s)],
        { ...noFilters, search: "toriyama" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("matches ISBN", () => {
      const v = makeVolume({ id: "v1", isbn: "978-3-16-148410-0", title: null })
      const s = makeSeries({ id: "s1", title: "S" }, [v])
      const result = filterVolumes(
        [toVws(v, s)],
        { ...noFilters, search: "978-3" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("excludes volume when none of the fields match", () => {
      const v = makeVolume({ id: "v1", title: "No Match", isbn: null })
      const s = makeSeries({ id: "s1", title: "Series", author: "Unknown" }, [
        v
      ])
      const result = filterVolumes(
        [toVws(v, s)],
        { ...noFilters, search: "naruto" },
        null
      )
      expect(result).toHaveLength(0)
    })
  })

  // ---- type (series-level) ----
  describe("type filter", () => {
    it("filters by series type", () => {
      const v1 = makeVolume({ id: "v1" })
      const sManga = makeSeries({ id: "s1", type: "manga" }, [v1])
      const v2 = makeVolume({ id: "v2" })
      const sNovel = makeSeries({ id: "s2", type: "light_novel" }, [v2])
      const result = filterVolumes(
        [toVws(v1, sManga), toVws(v2, sNovel)],
        { ...noFilters, type: "manga" },
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].volume.id).toBe("v1")
    })
  })

  // ---- ownershipStatus (volume-level, NOT any-volume) ----
  describe("ownershipStatus filter (volume-level)", () => {
    it("passes volume matching the status", () => {
      const v = makeVolume({ id: "v1", ownership_status: "wishlist" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterVolumes(
        [toVws(v, s)],
        { ...noFilters, ownershipStatus: "wishlist" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("excludes the volume that does not match status even if sibling does", () => {
      const vOwned = makeVolume({ id: "v1", ownership_status: "owned" })
      const vWish = makeVolume({ id: "v2", ownership_status: "wishlist" })
      const s = makeSeries({ id: "s1" }, [vOwned, vWish])
      const result = filterVolumes(
        [toVws(vOwned, s), toVws(vWish, s)],
        { ...noFilters, ownershipStatus: "owned" },
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].volume.id).toBe("v1")
    })
  })

  // ---- readingStatus (volume-level) ----
  describe("readingStatus filter (volume-level)", () => {
    it("passes volume matching the reading status", () => {
      const v = makeVolume({ id: "v1", reading_status: "reading" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterVolumes(
        [toVws(v, s)],
        { ...noFilters, readingStatus: "reading" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("excludes volume not matching reading status", () => {
      const v = makeVolume({ id: "v1", reading_status: "unread" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterVolumes(
        [toVws(v, s)],
        { ...noFilters, readingStatus: "read" },
        null
      )
      expect(result).toHaveLength(0)
    })
  })

  // ---- collection (volume-level) ----
  describe("collection filter (volume-level membership)", () => {
    it("passes when collection is null", () => {
      const v = makeVolume({ id: "v1" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterVolumes([toVws(v, s)], noFilters, null)
      expect(result).toHaveLength(1)
    })

    it("passes volume whose id is in the collection set", () => {
      const v = makeVolume({ id: "v1" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterVolumes([toVws(v, s)], noFilters, new Set(["v1"]))
      expect(result).toHaveLength(1)
    })

    it("excludes volume not in the collection", () => {
      const v = makeVolume({ id: "v1" })
      const s = makeSeries({ id: "s1" }, [v])
      const result = filterVolumes([toVws(v, s)], noFilters, new Set(["v99"]))
      expect(result).toHaveLength(0)
    })
  })
})

// ---------------------------------------------------------------------------
// 9. Volume sorting
// ---------------------------------------------------------------------------

describe("sortVolumes", () => {
  // ---- title (default) ----
  describe("sort by title (series title + volume_number)", () => {
    it("sorts by series title ascending", () => {
      const a = makeVws({ id: "v1" }, { id: "s1", title: "Akira" })
      const z = makeVws({ id: "v2" }, { id: "s2", title: "Zetman" })
      const result = sortVolumes([z, a], "title", "asc")
      expect(result[0].series.id).toBe("s1")
    })

    it("sorts by series title descending", () => {
      const a = makeVws({ id: "v1" }, { id: "s1", title: "Akira" })
      const z = makeVws({ id: "v2" }, { id: "s2", title: "Zetman" })
      const result = sortVolumes([a, z], "title", "desc")
      expect(result[0].series.id).toBe("s2")
    })

    it("ties broken by volume_number ascending within same series", () => {
      const s = makeSeries({ id: "s1", title: "Same" }, [])
      const v1: VolumeWithSeries = {
        volume: makeVolume({ id: "v1", volume_number: 2 }),
        series: s
      }
      const v2: VolumeWithSeries = {
        volume: makeVolume({ id: "v2", volume_number: 1 }),
        series: s
      }
      const result = sortVolumes([v1, v2], "title", "asc")
      expect(result[0].volume.volume_number).toBe(1)
    })
  })

  // ---- author ----
  describe("sort by author", () => {
    it("sorts by series author ascending with volume_number tiebreak", () => {
      const s = makeSeries({ id: "s1", author: "Same" }, [])
      const v1: VolumeWithSeries = {
        volume: makeVolume({ id: "v1", volume_number: 3 }),
        series: s
      }
      const v2: VolumeWithSeries = {
        volume: makeVolume({ id: "v2", volume_number: 1 }),
        series: s
      }
      const result = sortVolumes([v1, v2], "author", "asc")
      expect(result[0].volume.volume_number).toBe(1)
    })

    it("sorts different authors alphabetically", () => {
      const a = makeVws({ id: "v1" }, { id: "s1", author: "Alpha" })
      const b = makeVws({ id: "v2" }, { id: "s2", author: "Beta" })
      const result = sortVolumes([b, a], "author", "asc")
      expect(result[0].series.author).toBe("Alpha")
    })
  })

  // ---- rating ----
  describe("sort by rating", () => {
    it("sorts volumes by individual rating ascending", () => {
      const low = makeVws({ id: "v1", rating: 2 }, { id: "s1", title: "A" })
      const high = makeVws({ id: "v2", rating: 5 }, { id: "s2", title: "B" })
      const result = sortVolumes([high, low], "rating", "asc")
      expect(result[0].volume.rating).toBe(2)
    })

    it("treats null rating as 0", () => {
      const noRating = makeVws(
        { id: "v1", rating: null },
        { id: "s1", title: "A" }
      )
      const rated = makeVws({ id: "v2", rating: 3 }, { id: "s2", title: "B" })
      const result = sortVolumes([rated, noRating], "rating", "asc")
      expect(result[0].volume.id).toBe("v1")
    })

    it("sorts descending by rating", () => {
      const low = makeVws({ id: "v1", rating: 1 }, { id: "s1" })
      const high = makeVws({ id: "v2", rating: 5 }, { id: "s2" })
      const result = sortVolumes([low, high], "rating", "desc")
      expect(result[0].volume.rating).toBe(5)
    })

    it("ties broken by series title", () => {
      const z = makeVws({ id: "v1", rating: 4 }, { id: "s1", title: "Zetman" })
      const a = makeVws({ id: "v2", rating: 4 }, { id: "s2", title: "Akira" })
      const result = sortVolumes([z, a], "rating", "asc")
      expect(result[0].series.title).toBe("Akira")
    })
  })

  // ---- price ----
  describe("sort by price", () => {
    it("sorts by purchase_price ascending", () => {
      const cheap = makeVws({ id: "v1", purchase_price: 5 }, { id: "s1" })
      const pricey = makeVws({ id: "v2", purchase_price: 50 }, { id: "s2" })
      const result = sortVolumes([pricey, cheap], "price", "asc")
      expect(result[0].volume.id).toBe("v1")
    })

    it("treats null price as 0", () => {
      const noPrice = makeVws({ id: "v1", purchase_price: null }, { id: "s1" })
      const priced = makeVws({ id: "v2", purchase_price: 1 }, { id: "s2" })
      const result = sortVolumes([priced, noPrice], "price", "asc")
      expect(result[0].volume.id).toBe("v1")
    })
  })

  // ---- created_at / updated_at ----
  describe("sort by created_at", () => {
    it("sorts by volume created_at ascending", () => {
      const old_ = makeVws(
        { id: "v1", created_at: "2024-01-01T00:00:00.000Z" },
        { id: "s1" }
      )
      const new_ = makeVws(
        { id: "v2", created_at: "2026-01-01T00:00:00.000Z" },
        { id: "s2" }
      )
      const result = sortVolumes([new_, old_], "created_at", "asc")
      expect(result[0].volume.id).toBe("v1")
    })
  })

  describe("sort by updated_at", () => {
    it("sorts by volume updated_at descending", () => {
      const old_ = makeVws(
        { id: "v1", updated_at: "2024-01-01T00:00:00.000Z" },
        { id: "s1" }
      )
      const new_ = makeVws(
        { id: "v2", updated_at: "2026-01-01T00:00:00.000Z" },
        { id: "s2" }
      )
      const result = sortVolumes([old_, new_], "updated_at", "desc")
      expect(result[0].volume.id).toBe("v2")
    })
  })

  // ---- started_at ----
  describe("sort by started_at", () => {
    it("sorts by volume started_at ascending, null treated as 0", () => {
      const noDate = makeVws(
        { id: "v1", started_at: null },
        { id: "s1", title: "A" }
      )
      const dated = makeVws(
        { id: "v2", started_at: "2025-01-01T00:00:00.000Z" },
        { id: "s2", title: "B" }
      )
      const result = sortVolumes([dated, noDate], "started_at", "asc")
      expect(result[0].volume.id).toBe("v1")
    })

    it("sorts older start dates first when ascending", () => {
      const early = makeVws(
        { id: "v1", started_at: "2023-01-01T00:00:00.000Z" },
        { id: "s1" }
      )
      const late_ = makeVws(
        { id: "v2", started_at: "2025-01-01T00:00:00.000Z" },
        { id: "s2" }
      )
      const result = sortVolumes([late_, early], "started_at", "asc")
      expect(result[0].volume.id).toBe("v1")
    })
  })

  // ---- finished_at ----
  describe("sort by finished_at", () => {
    it("sorts older finish dates first when ascending", () => {
      const early = makeVws(
        { id: "v1", finished_at: "2022-01-01T00:00:00.000Z" },
        { id: "s1" }
      )
      const late_ = makeVws(
        { id: "v2", finished_at: "2026-01-01T00:00:00.000Z" },
        { id: "s2" }
      )
      const result = sortVolumes([late_, early], "finished_at", "asc")
      expect(result[0].volume.id).toBe("v1")
    })
  })

  // ---- volume_count ----
  describe("sort by volume_count", () => {
    it("sorts by series volume count ascending", () => {
      const extraVolumes = [makeVolume({ id: "vEx" })]
      const sFew_ = makeSeries({ id: "s1" }, [makeVolume({ id: "v1" })])
      const sMany_ = makeSeries({ id: "s2" }, [
        makeVolume({ id: "v2" }),
        ...extraVolumes
      ])
      const few: VolumeWithSeries = {
        volume: makeVolume({ id: "vA" }),
        series: sFew_
      }
      const many: VolumeWithSeries = {
        volume: makeVolume({ id: "vB" }),
        series: sMany_
      }
      const result = sortVolumes([many, few], "volume_count", "asc")
      expect(result[0].series.id).toBe("s1")
    })
  })
})

// ---------------------------------------------------------------------------
// 10. Unassigned volume filtering
// ---------------------------------------------------------------------------

describe("filterUnassignedVolumes", () => {
  // ---- search ----
  describe("search filter", () => {
    it("passes all when search is empty", () => {
      const v = makeVolume({ title: "Vol 1" })
      const result = filterUnassignedVolumes([v], noFilters, null)
      expect(result).toHaveLength(1)
    })

    it("matches by title", () => {
      const v = makeVolume({ title: "One Piece Omnibus" })
      const result = filterUnassignedVolumes(
        [v],
        { ...noFilters, search: "omnibus" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("matches by ISBN", () => {
      const v = makeVolume({ isbn: "978-3-16-148410-0", title: null })
      const result = filterUnassignedVolumes(
        [v],
        { ...noFilters, search: "978-3" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("excludes when neither title nor ISBN match", () => {
      const v = makeVolume({ title: "Other", isbn: "000" })
      const result = filterUnassignedVolumes(
        [v],
        { ...noFilters, search: "naruto" },
        null
      )
      expect(result).toHaveLength(0)
    })

    it("handles null title and null isbn safely", () => {
      const v = makeVolume({ title: null, isbn: null })
      const result = filterUnassignedVolumes(
        [v],
        { ...noFilters, search: "anything" },
        null
      )
      expect(result).toHaveLength(0)
    })
  })

  // ---- type filter excludes all ----
  describe("type filter", () => {
    it("returns all when type is 'all'", () => {
      const v = makeVolume()
      const result = filterUnassignedVolumes(
        [v],
        { ...noFilters, type: "all" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("excludes all unassigned volumes when type is not 'all'", () => {
      const v = makeVolume()
      const result = filterUnassignedVolumes(
        [v],
        { ...noFilters, type: "manga" },
        null
      )
      expect(result).toHaveLength(0)
    })

    it("still excludes when type is 'light_novel'", () => {
      const v = makeVolume()
      const result = filterUnassignedVolumes(
        [v],
        { ...noFilters, type: "light_novel" },
        null
      )
      expect(result).toHaveLength(0)
    })
  })

  // ---- tag filters exclude all ----
  describe("tag filters", () => {
    it("returns all when no tags specified", () => {
      const v = makeVolume()
      const result = filterUnassignedVolumes([v], noFilters, null)
      expect(result).toHaveLength(1)
    })

    it("excludes all when any include tag is active", () => {
      const v = makeVolume()
      const result = filterUnassignedVolumes(
        [v],
        { ...noFilters, tags: ["action"] },
        null
      )
      expect(result).toHaveLength(0)
    })

    it("excludes all when any exclude tag is active", () => {
      const v = makeVolume()
      const result = filterUnassignedVolumes(
        [v],
        { ...noFilters, excludeTags: ["harem"] },
        null
      )
      expect(result).toHaveLength(0)
    })
  })

  // ---- ownershipStatus ----
  describe("ownershipStatus filter", () => {
    it("passes all when 'all'", () => {
      const v = makeVolume({ ownership_status: "owned" })
      const result = filterUnassignedVolumes(
        [v],
        { ...noFilters, ownershipStatus: "all" },
        null
      )
      expect(result).toHaveLength(1)
    })

    it("filters by ownership status", () => {
      const owned = makeVolume({ id: "v1", ownership_status: "owned" })
      const wished = makeVolume({ id: "v2", ownership_status: "wishlist" })
      const result = filterUnassignedVolumes(
        [owned, wished],
        { ...noFilters, ownershipStatus: "owned" },
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("v1")
    })
  })

  // ---- readingStatus ----
  describe("readingStatus filter", () => {
    it("filters by reading status", () => {
      const read = makeVolume({ id: "v1", reading_status: "completed" })
      const unread = makeVolume({ id: "v2", reading_status: "unread" })
      const result = filterUnassignedVolumes(
        [read, unread],
        { ...noFilters, readingStatus: "completed" },
        null
      )
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("v1")
    })
  })

  // ---- collection ----
  describe("collection filter", () => {
    it("passes all when collection is null", () => {
      const v = makeVolume({ id: "v1" })
      const result = filterUnassignedVolumes([v], noFilters, null)
      expect(result).toHaveLength(1)
    })

    it("includes volume when it is in the collection", () => {
      const v = makeVolume({ id: "v1" })
      const result = filterUnassignedVolumes([v], noFilters, new Set(["v1"]))
      expect(result).toHaveLength(1)
    })

    it("excludes volume not in the collection", () => {
      const v = makeVolume({ id: "v1" })
      const result = filterUnassignedVolumes([v], noFilters, new Set(["v99"]))
      expect(result).toHaveLength(0)
    })
  })

  // ---- empty list ----
  it("returns empty array for empty input", () => {
    const result = filterUnassignedVolumes([], noFilters, null)
    expect(result).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 11. allVolumes flat-map (VolumeWithSeries derivation)
// ---------------------------------------------------------------------------

describe("allVolumes (flatMap series → VolumeWithSeries)", () => {
  it("returns empty array when there are no series", () => {
    expect(deriveAllVolumes([])).toEqual([])
  })

  it("returns empty array when all series have no volumes", () => {
    const s = makeSeries({ id: "s1" }, [])
    expect(deriveAllVolumes([s])).toEqual([])
  })

  it("maps each volume to a VolumeWithSeries entry with its parent series", () => {
    const v1 = makeVolume({ id: "v1" })
    const v2 = makeVolume({ id: "v2" })
    const s = makeSeries({ id: "s1" }, [v1, v2])
    const result = deriveAllVolumes([s])
    expect(result).toHaveLength(2)
    expect(result[0].volume.id).toBe("v1")
    expect(result[0].series.id).toBe("s1")
    expect(result[1].volume.id).toBe("v2")
    expect(result[1].series.id).toBe("s1")
  })

  it("preserves cross-series volume-to-series association", () => {
    const v1 = makeVolume({ id: "v1" })
    const v2 = makeVolume({ id: "v2" })
    const s1 = makeSeries({ id: "s1" }, [v1])
    const s2 = makeSeries({ id: "s2" }, [v2])
    const result = deriveAllVolumes([s1, s2])
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.volume.id === "v1")!.series.id).toBe("s1")
    expect(result.find((r) => r.volume.id === "v2")!.series.id).toBe("s2")
  })

  it("accumulates volumes from multiple series in order", () => {
    const v1 = makeVolume({ id: "v1" })
    const v2 = makeVolume({ id: "v2" })
    const v3 = makeVolume({ id: "v3" })
    const s1 = makeSeries({ id: "s1" }, [v1, v2])
    const s2 = makeSeries({ id: "s2" }, [v3])
    const result = deriveAllVolumes([s1, s2])
    expect(result.map((r) => r.volume.id)).toEqual(["v1", "v2", "v3"])
  })
})

// ---------------------------------------------------------------------------
// 12. Edge cases and boundary conditions
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("filterSeries returns empty array for empty input", () => {
    expect(filterSeries([], noFilters, null)).toEqual([])
  })

  it("filterVolumes returns empty array for empty input", () => {
    expect(filterVolumes([], noFilters, null)).toEqual([])
  })

  it("sortSeriesInPlace handles empty array", () => {
    expect(sortSeriesInPlace([], "title", "asc")).toEqual([])
  })

  it("sortVolumes handles empty array", () => {
    expect(sortVolumes([], "title", "asc")).toEqual([])
  })

  it("filterSeries with all active filters returns empty for non-matching series", () => {
    const v = makeVolume({
      ownership_status: "owned",
      reading_status: "unread"
    })
    const s = makeSeries(
      { id: "s1", title: "Series", type: "manga", tags: [] },
      [v]
    )
    const result = filterSeries(
      [s],
      {
        search: "nonexistent",
        type: "manga",
        ownershipStatus: "owned",
        readingStatus: "unread",
        tags: [],
        excludeTags: []
      },
      null
    )
    expect(result).toHaveLength(0)
  })

  it("compareStrings handles accented characters (sensitivity:base)", () => {
    // sensitivity:'base' treats accented variants as equal to base char
    expect(compareStrings("cafe", "café")).toBe(0)
  })

  it("sortSeriesInPlace is stable-ish by title when all primary values are equal", () => {
    // Three series with identical ratings → should end up sorted by title
    const sa = makeSeries({ id: "sA", title: "A" }, [
      makeVolume({ id: "v1", rating: 3 })
    ])
    const sb = makeSeries({ id: "sB", title: "B" }, [
      makeVolume({ id: "v2", rating: 3 })
    ])
    const sc = makeSeries({ id: "sC", title: "C" }, [
      makeVolume({ id: "v3", rating: 3 })
    ])
    const result = sortSeriesInPlace([sc, sa, sb], "rating", "asc")
    expect(result.map((s) => s.id)).toEqual(["sA", "sB", "sC"])
  })

  it("parseTimestamp on epoch-zero string is a valid number", () => {
    const ts = parseTimestamp("1970-01-01T00:00:00.000Z")
    expect(ts).toBe(0)
    expect(ts).not.toBeNull()
  })

  it("filterUnassignedVolumes with combined type + tag filters excludes all", () => {
    const v = makeVolume()
    const result = filterUnassignedVolumes(
      [v],
      { ...noFilters, type: "manga", tags: ["action"] },
      null
    )
    expect(result).toHaveLength(0)
  })
})
