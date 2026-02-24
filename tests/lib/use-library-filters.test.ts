/**
 * Behavior tests for lib/hooks/library-filter-utils.ts
 *
 * All production filter/sort functions are imported directly — no logic is
 * re-implemented here. Tests assert on filter/sort outcomes, not on the
 * shape of private helper implementations.
 */

import { describe, expect, it } from "bun:test"

import {
  buildDateCache,
  buildVolumeCache,
  compareStrings,
  matchesDataFilter,
  matchesSeriesFilters,
  matchesVolumeFilters,
  parseTimestamp,
  type SeriesFilterSnapshot,
  sortSeriesInPlace
} from "@/lib/hooks/library-filter-utils"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

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
    release_reminder: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides
  }
}

function makeSeries(
  overrides: Partial<Omit<SeriesWithVolumes, "volumes">> = {},
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
    owned_volume_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    volumes,
    ...overrides
  }
}

/** Default pass-through filter snapshot (nothing filtered). */
const allFilters: SeriesFilterSnapshot = {
  type: "all",
  seriesStatus: "all",
  ownershipStatus: "all",
  readingStatus: "all",
  hasCover: "all",
  hasIsbn: "all"
}

/** Tag callback that always passes. */
const noTags = () => true

// ---------------------------------------------------------------------------
// compareStrings
// ---------------------------------------------------------------------------

describe("compareStrings", () => {
  it("returns 0 for identical strings", () => {
    expect(compareStrings("abc", "abc")).toBe(0)
  })

  it("is case-insensitive", () => {
    expect(compareStrings("ABC", "abc")).toBe(0)
  })

  it("sorts a before b", () => {
    expect(compareStrings("apple", "banana")).toBeLessThan(0)
    expect(compareStrings("banana", "apple")).toBeGreaterThan(0)
  })

  it("treats null/undefined as empty string", () => {
    expect(compareStrings(null, null)).toBe(0)
    expect(compareStrings(undefined, undefined)).toBe(0) //NOSONAR
    expect(compareStrings(null, undefined)).toBe(0) //NOSONAR
    expect(compareStrings(null, "a")).toBeLessThan(0)
    expect(compareStrings("a", null)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// parseTimestamp
// ---------------------------------------------------------------------------

describe("parseTimestamp", () => {
  it("returns null for null/undefined/empty", () => {
    expect(parseTimestamp(null)).toBeNull()
    expect(parseTimestamp(undefined)).toBeNull()
    expect(parseTimestamp("")).toBeNull()
  })

  it("parses a valid ISO-8601 date to a positive number", () => {
    const ts = parseTimestamp("2026-01-01T00:00:00.000Z")
    expect(ts).toBeTypeOf("number")
    expect(ts).toBeGreaterThan(0)
  })

  it("returns null for an invalid date string", () => {
    expect(parseTimestamp("not-a-date")).toBeNull()
  })

  it("earlier dates produce smaller timestamps than later dates", () => {
    const a = parseTimestamp("2020-01-01T00:00:00.000Z")!
    const b = parseTimestamp("2025-06-15T12:00:00.000Z")!
    expect(a).toBeLessThan(b)
  })
})

// ---------------------------------------------------------------------------
// matchesDataFilter — cover / isbn completeness
// ---------------------------------------------------------------------------

describe("matchesDataFilter", () => {
  it("passes when both filters are 'all'", () => {
    expect(
      matchesDataFilter([{ cover_image_url: null, isbn: null }], "all", "all")
    ).toBe(true)
  })

  it("requires a cover when hasCover='has'", () => {
    expect(matchesDataFilter([{ cover_image_url: null }], "has", "all")).toBe(
      false
    )
    expect(matchesDataFilter([{ cover_image_url: "  " }], "has", "all")).toBe(
      false
    )
    expect(
      matchesDataFilter(
        [{ cover_image_url: "https://img.example.com/cover.jpg" }],
        "has",
        "all"
      )
    ).toBe(true)
  })

  it("requires missing cover when hasCover='missing'", () => {
    expect(
      matchesDataFilter(
        [{ cover_image_url: "https://img.example.com/cover.jpg" }],
        "missing",
        "all"
      )
    ).toBe(false)
    expect(
      matchesDataFilter([{ cover_image_url: null }], "missing", "all")
    ).toBe(true)
  })

  it("applies isbn filter independently of cover filter", () => {
    expect(
      matchesDataFilter([{ isbn: "978-0-06-112008-4" }], "all", "has")
    ).toBe(true)
    expect(
      matchesDataFilter([{ isbn: "978-0-06-112008-4" }], "all", "missing")
    ).toBe(false)
    expect(matchesDataFilter([{ isbn: null }], "all", "has")).toBe(false)
    expect(matchesDataFilter([{ isbn: null }], "all", "missing")).toBe(true)
  })

  it("passes when ANY volume satisfies the requirement (not all)", () => {
    const vols = [
      { cover_image_url: null },
      { cover_image_url: "https://img.example.com/cover.jpg" }
    ]
    expect(matchesDataFilter(vols, "has", "all")).toBe(true)
  })

  it("whitespace-only cover treats it as missing", () => {
    expect(matchesDataFilter([{ cover_image_url: "   " }], "has", "all")).toBe(
      false
    )
    expect(
      matchesDataFilter([{ cover_image_url: "   " }], "missing", "all")
    ).toBe(true)
  })

  it("passes for empty volumes array with 'missing' filter", () => {
    expect(matchesDataFilter([], "missing", "missing")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// matchesVolumeFilters — ownership / reading / collection
// ---------------------------------------------------------------------------

describe("matchesVolumeFilters", () => {
  it("passes for 'all' ownership and reading with null collection", () => {
    const s = makeSeries({}, [makeVolume()])
    expect(matchesVolumeFilters(s, allFilters, null)).toBe(true)
  })

  it("filters by ownership status", () => {
    const s = makeSeries({}, [makeVolume({ ownership_status: "owned" })])
    const ownedFilter: SeriesFilterSnapshot = {
      ...allFilters,
      ownershipStatus: "owned"
    }
    expect(matchesVolumeFilters(s, ownedFilter, null)).toBe(true)

    const digitalFilter: SeriesFilterSnapshot = {
      ...allFilters,
      ownershipStatus: "digital"
    }
    expect(matchesVolumeFilters(s, digitalFilter, null)).toBe(false)
  })

  it("passes when at least one volume matches the ownership status", () => {
    const s = makeSeries({}, [
      makeVolume({ id: "v1", ownership_status: "owned" }),
      makeVolume({ id: "v2", ownership_status: "wishlist" })
    ])
    const ownedFilter: SeriesFilterSnapshot = {
      ...allFilters,
      ownershipStatus: "owned"
    }
    expect(matchesVolumeFilters(s, ownedFilter, null)).toBe(true)
  })

  it("filters by reading status", () => {
    const s = makeSeries({}, [makeVolume({ reading_status: "reading" })])
    const readingFilter: SeriesFilterSnapshot = {
      ...allFilters,
      readingStatus: "reading"
    }
    expect(matchesVolumeFilters(s, readingFilter, null)).toBe(true)

    const completedFilter: SeriesFilterSnapshot = {
      ...allFilters,
      readingStatus: "completed"
    }
    expect(matchesVolumeFilters(s, completedFilter, null)).toBe(false)
  })

  it("filters by active collection volume ids", () => {
    const v = makeVolume({ id: "v1" })
    const s = makeSeries({}, [v])
    expect(matchesVolumeFilters(s, allFilters, new Set(["v1"]))).toBe(true)
    expect(matchesVolumeFilters(s, allFilters, new Set(["other-id"]))).toBe(
      false
    )
  })

  it("null collection set disables collection filtering", () => {
    const s = makeSeries({}, [makeVolume()])
    expect(matchesVolumeFilters(s, allFilters, null)).toBe(true)
  })

  it("series with no volumes fails any non-all ownership filter", () => {
    const s = makeSeries({}, [])
    const f: SeriesFilterSnapshot = { ...allFilters, ownershipStatus: "owned" }
    expect(matchesVolumeFilters(s, f, null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// matchesSeriesFilters — full series predicate
// ---------------------------------------------------------------------------

describe("matchesSeriesFilters", () => {
  it("passes for an all-inclusive filter snapshot", () => {
    const s = makeSeries({}, [makeVolume()])
    expect(matchesSeriesFilters(s, allFilters, "", null, noTags)).toBe(true)
  })

  describe("search", () => {
    it("matches on title (case-insensitive)", () => {
      const s = makeSeries({ title: "One Piece" })
      expect(
        matchesSeriesFilters(s, allFilters, "one piece", null, noTags)
      ).toBe(true)
      // searchLower is already lowercased by the hook before passing here
      expect(matchesSeriesFilters(s, allFilters, "one", null, noTags)).toBe(
        true
      )
      expect(matchesSeriesFilters(s, allFilters, "naruto", null, noTags)).toBe(
        false
      )
    })

    it("matches on author", () => {
      const s = makeSeries({ title: "Series", author: "Eiichiro Oda" })
      expect(matchesSeriesFilters(s, allFilters, "oda", null, noTags)).toBe(
        true
      )
    })

    it("matches on description", () => {
      const s = makeSeries({
        title: "Series",
        description: "A pirate adventure"
      })
      expect(matchesSeriesFilters(s, allFilters, "pirate", null, noTags)).toBe(
        true
      )
    })

    it("excludes when search matches none of title/author/description", () => {
      const s = makeSeries({
        title: "Bleach",
        author: "Tite Kubo",
        description: "Soul reapers"
      })
      expect(matchesSeriesFilters(s, allFilters, "dragon", null, noTags)).toBe(
        false
      )
    })

    it("null author/description do not throw", () => {
      const s = makeSeries({ author: null, description: null })
      expect(() =>
        matchesSeriesFilters(s, allFilters, "anything", null, noTags)
      ).not.toThrow()
    })
  })

  describe("type filter", () => {
    it("passes when type matches", () => {
      const s = makeSeries({ type: "manga" })
      expect(
        matchesSeriesFilters(
          s,
          { ...allFilters, type: "manga" },
          "",
          null,
          noTags
        )
      ).toBe(true)
    })

    it("excludes when type differs", () => {
      const s = makeSeries({ type: "manga" })
      expect(
        matchesSeriesFilters(
          s,
          { ...allFilters, type: "light-novel" },
          "",
          null,
          noTags
        )
      ).toBe(false)
    })
  })

  describe("series status filter", () => {
    it("passes when status matches", () => {
      const s = makeSeries({ status: "ongoing" })
      expect(
        matchesSeriesFilters(
          s,
          { ...allFilters, seriesStatus: "ongoing" },
          "",
          null,
          noTags
        )
      ).toBe(true)
    })

    it("excludes when status differs", () => {
      const s = makeSeries({ status: "completed" })
      expect(
        matchesSeriesFilters(
          s,
          { ...allFilters, seriesStatus: "ongoing" },
          "",
          null,
          noTags
        )
      ).toBe(false)
    })
  })

  describe("tag filter callback", () => {
    it("excludes when tag callback returns false", () => {
      const s = makeSeries({ tags: ["shonen"] })
      expect(matchesSeriesFilters(s, allFilters, "", null, () => false)).toBe(
        false
      )
    })

    it("passes when tag callback returns true", () => {
      const s = makeSeries({ tags: ["shonen"] })
      expect(matchesSeriesFilters(s, allFilters, "", null, () => true)).toBe(
        true
      )
    })
  })
})

// ---------------------------------------------------------------------------
// buildVolumeCache — sum / avg aggregation
// ---------------------------------------------------------------------------

describe("buildVolumeCache", () => {
  it("computes sum of purchase prices across volumes", () => {
    const s = makeSeries({}, [
      makeVolume({ id: "v1", purchase_price: 10 }),
      makeVolume({ id: "v2", purchase_price: 20 })
    ])
    expect(
      buildVolumeCache([s], (v) => v.purchase_price, "sum").get("s1")
    ).toBe(30)
  })

  it("computes average rating across volumes", () => {
    const s = makeSeries({}, [
      makeVolume({ id: "v1", rating: 4 }),
      makeVolume({ id: "v2", rating: 2 })
    ])
    expect(buildVolumeCache([s], (v) => v.rating, "avg").get("s1")).toBe(3)
  })

  it("returns 0 for a series with no volumes", () => {
    expect(
      buildVolumeCache([makeSeries({})], (v) => v.purchase_price, "sum").get(
        "s1"
      )
    ).toBe(0)
  })

  it("skips null values and avg is based only on non-null entries", () => {
    const s = makeSeries({}, [
      makeVolume({ id: "v1", rating: null }),
      makeVolume({ id: "v2", rating: 5 })
    ])
    expect(buildVolumeCache([s], (v) => v.rating, "avg").get("s1")).toBe(5)
  })

  it("avg returns 0 (not NaN) when all values are null", () => {
    const s = makeSeries({}, [makeVolume({ rating: null })])
    expect(buildVolumeCache([s], (v) => v.rating, "avg").get("s1")).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// buildDateCache — earliest / latest strategy
// ---------------------------------------------------------------------------

describe("buildDateCache", () => {
  it("picks the earliest started_at date across volumes", () => {
    const s = makeSeries({}, [
      makeVolume({ id: "v1", started_at: "2024-01-01T00:00:00.000Z" }),
      makeVolume({ id: "v2", started_at: "2022-06-01T00:00:00.000Z" }),
      makeVolume({ id: "v3", started_at: "2025-03-15T00:00:00.000Z" })
    ])
    const expected = new Date("2022-06-01T00:00:00.000Z").getTime()
    expect(buildDateCache([s], (v) => v.started_at, "earliest").get("s1")).toBe(
      expected
    )
  })

  it("picks the latest finished_at date across volumes", () => {
    const s = makeSeries({}, [
      makeVolume({ id: "v1", finished_at: "2023-09-01T00:00:00.000Z" }),
      makeVolume({ id: "v2", finished_at: "2025-11-30T00:00:00.000Z" })
    ])
    const expected = new Date("2025-11-30T00:00:00.000Z").getTime()
    expect(buildDateCache([s], (v) => v.finished_at, "latest").get("s1")).toBe(
      expected
    )
  })

  it("returns 0 when all volumes have no date", () => {
    const s = makeSeries({}, [makeVolume({ started_at: null })])
    expect(buildDateCache([s], (v) => v.started_at, "earliest").get("s1")).toBe(
      0
    )
  })

  it("ignores invalid date strings and uses only valid ones", () => {
    const s = makeSeries({}, [
      makeVolume({ id: "v1", started_at: "not-a-date" }),
      makeVolume({ id: "v2", started_at: "2023-01-01T00:00:00.000Z" })
    ])
    const expected = new Date("2023-01-01T00:00:00.000Z").getTime()
    expect(buildDateCache([s], (v) => v.started_at, "earliest").get("s1")).toBe(
      expected
    )
  })
})

// ---------------------------------------------------------------------------
// sortSeriesInPlace — sort field / direction combinations
// ---------------------------------------------------------------------------

describe("sortSeriesInPlace", () => {
  it("sorts by title ascending", () => {
    const result = sortSeriesInPlace(
      [
        makeSeries({ id: "a", title: "Zoro" }),
        makeSeries({ id: "b", title: "Attack on Titan" })
      ],
      "title",
      "asc"
    )
    expect(result.map((s) => s.title)).toEqual(["Attack on Titan", "Zoro"])
  })

  it("sorts by title descending", () => {
    const result = sortSeriesInPlace(
      [
        makeSeries({ id: "a", title: "Attack on Titan" }),
        makeSeries({ id: "b", title: "Zoro" })
      ],
      "title",
      "desc"
    )
    expect(result.map((s) => s.title)).toEqual(["Zoro", "Attack on Titan"])
  })

  it("sorts by author ascending", () => {
    const result = sortSeriesInPlace(
      [
        makeSeries({ id: "a", title: "S1", author: "Zeta" }),
        makeSeries({ id: "b", title: "S2", author: "Alpha" })
      ],
      "author",
      "asc"
    )
    expect(result[0].author).toBe("Alpha")
  })

  it("sorts by volume_count ascending", () => {
    const few = makeSeries({ id: "a", title: "Few" }, [makeVolume()])
    const many = makeSeries({ id: "b", title: "Many" }, [
      makeVolume({ id: "v1" }),
      makeVolume({ id: "v2" }),
      makeVolume({ id: "v3" })
    ])
    const result = sortSeriesInPlace([many, few], "volume_count", "asc")
    expect(result[0].title).toBe("Few")
  })

  it("sorts by average rating descending", () => {
    const high = makeSeries({ id: "a", title: "High" }, [
      makeVolume({ id: "v1", rating: 5 })
    ])
    const low = makeSeries({ id: "b", title: "Low" }, [
      makeVolume({ id: "v2", rating: 2 })
    ])
    const result = sortSeriesInPlace([low, high], "rating", "desc")
    expect(result[0].title).toBe("High")
  })

  it("sorts by total purchase price (sum) ascending", () => {
    const cheap = makeSeries({ id: "a", title: "Cheap" }, [
      makeVolume({ id: "v1", purchase_price: 5 })
    ])
    const expensive = makeSeries({ id: "b", title: "Expensive" }, [
      makeVolume({ id: "v2", purchase_price: 50 }),
      makeVolume({ id: "v3", purchase_price: 50 })
    ])
    const result = sortSeriesInPlace([expensive, cheap], "price", "asc")
    expect(result[0].title).toBe("Cheap")
  })

  it("sorts by earliest started_at ascending", () => {
    const early = makeSeries({ id: "a", title: "Early" }, [
      makeVolume({ id: "v1", started_at: "2020-01-01T00:00:00.000Z" })
    ])
    const late = makeSeries({ id: "b", title: "Late" }, [
      makeVolume({ id: "v2", started_at: "2025-01-01T00:00:00.000Z" })
    ])
    expect(sortSeriesInPlace([late, early], "started_at", "asc")[0].title).toBe(
      "Early"
    )
  })

  it("sorts by latest finished_at descending", () => {
    const older = makeSeries({ id: "a", title: "Finished Early" }, [
      makeVolume({ id: "v1", finished_at: "2022-01-01T00:00:00.000Z" })
    ])
    const newer = makeSeries({ id: "b", title: "Finished Late" }, [
      makeVolume({ id: "v2", finished_at: "2025-12-31T00:00:00.000Z" })
    ])
    expect(
      sortSeriesInPlace([older, newer], "finished_at", "desc")[0].title
    ).toBe("Finished Late")
  })

  it("sorts by created_at ascending", () => {
    const older = makeSeries({
      id: "a",
      title: "Older",
      created_at: "2020-01-01T00:00:00.000Z"
    })
    const newer = makeSeries({
      id: "b",
      title: "Newer",
      created_at: "2025-01-01T00:00:00.000Z"
    })
    expect(
      sortSeriesInPlace([newer, older], "created_at", "asc")[0].title
    ).toBe("Older")
  })

  it("sorts by updated_at descending", () => {
    const stale = makeSeries({
      id: "a",
      title: "Stale",
      updated_at: "2020-01-01T00:00:00.000Z"
    })
    const fresh = makeSeries({
      id: "b",
      title: "Fresh",
      updated_at: "2025-01-01T00:00:00.000Z"
    })
    expect(
      sortSeriesInPlace([stale, fresh], "updated_at", "desc")[0].title
    ).toBe("Fresh")
  })

  it("uses title as tiebreaker when primary sort value is equal", () => {
    const a = makeSeries({ id: "a", title: "Berserk" }, [
      makeVolume({ id: "v1", rating: 5 })
    ])
    const b = makeSeries({ id: "b", title: "Akira" }, [
      makeVolume({ id: "v2", rating: 5 })
    ])
    const result = sortSeriesInPlace([a, b], "rating", "asc")
    expect(result[0].title).toBe("Akira")
  })

  it("falls back to title sort for an unknown sort field", () => {
    const a = makeSeries({ id: "a", title: "Zoro" })
    const b = makeSeries({ id: "b", title: "Abel" })
    expect(sortSeriesInPlace([a, b], "unknown_field", "asc")[0].title).toBe(
      "Abel"
    )
  })

  it("tolerates an empty array", () => {
    expect(sortSeriesInPlace([], "title", "asc")).toEqual([])
  })

  it("all-null started_at dates fall back to title tiebreaker", () => {
    const a = makeSeries({ id: "a", title: "Beta" }, [
      makeVolume({ started_at: null })
    ])
    const b = makeSeries({ id: "b", title: "Alpha" }, [
      makeVolume({ id: "v2", started_at: null })
    ])
    expect(sortSeriesInPlace([a, b], "started_at", "asc")[0].title).toBe(
      "Alpha"
    )
  })
})
