import { describe, expect, it } from "bun:test"

import {
  computeCollectionStats,
  computeMonthlyBars,
  computePriceBreakdown,
  computeRatingDistribution,
  computeReadingVelocity,
  computeReleases,
  computeSpendingTimeSeries,
  computeSuggestedBuys,
  computeSuggestionCounts,
  computeTagBreakdown,
  computeWishlistStats,
  getCurrentlyReading,
  getRecentSeries,
  getRecentVolumes
} from "@/lib/library/analytics"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

// ── Fixtures ────────────────────────────────────────────────────────────

function makeVolume(overrides: Partial<Volume> = {}): Volume {
  return {
    id: "vol-1",
    series_id: "series-1",
    user_id: "user-1",
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
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides
  }
}

function makeSeries(
  overrides: Partial<SeriesWithVolumes> = {}
): SeriesWithVolumes {
  return {
    id: "series-1",
    user_id: "user-1",
    title: "Test Series",
    original_title: null,
    description: null,
    notes: null,
    author: "Author Name",
    artist: null,
    publisher: null,
    cover_image_url: null,
    type: "manga",
    total_volumes: null,
    owned_volume_count: 0,
    status: null,
    tags: [],
    is_public: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    volumes: [],
    ...overrides
  }
}

// ── computeCollectionStats ───────────────────────────────────────────────

describe("computeCollectionStats", () => {
  it("returns zero counts for empty series array", () => {
    const stats = computeCollectionStats([])
    expect(stats.totalSeries).toBe(0)
    expect(stats.totalVolumes).toBe(0)
    expect(stats.ownedVolumes).toBe(0)
    expect(stats.readVolumes).toBe(0)
    expect(stats.readingVolumes).toBe(0)
    expect(stats.lightNovelSeries).toBe(0)
    expect(stats.mangaSeries).toBe(0)
    expect(stats.totalSpent).toBe(0)
    expect(stats.pricedVolumes).toBe(0)
    expect(stats.wishlistCount).toBe(0)
    expect(stats.completeSets).toBe(0)
    expect(stats.totalPages).toBe(0)
    expect(stats.readPages).toBe(0)
    expect(stats.averagePricePerTrackedVolume).toBe(0)
  })

  it("counts owned and wishlist volumes separately", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", ownership_status: "owned" }),
        makeVolume({ id: "v2", ownership_status: "wishlist" })
      ]
    })
    const stats = computeCollectionStats([series])
    expect(stats.ownedVolumes).toBe(1)
    expect(stats.wishlistCount).toBe(1)
    expect(stats.totalVolumes).toBe(2)
  })

  it("counts reading and completed reading statuses", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", reading_status: "reading" }),
        makeVolume({ id: "v2", reading_status: "completed" }),
        makeVolume({ id: "v3", reading_status: "unread" })
      ]
    })
    const stats = computeCollectionStats([series])
    expect(stats.readingVolumes).toBe(1)
    expect(stats.readVolumes).toBe(1)
  })

  it("accumulates spent from owned volumes with purchase_price", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          ownership_status: "owned",
          purchase_price: 10.99
        }),
        makeVolume({
          id: "v2",
          ownership_status: "owned",
          purchase_price: 12.99
        }),
        makeVolume({ id: "v3", ownership_status: "owned" }) // no price
      ]
    })
    const stats = computeCollectionStats([series])
    expect(stats.totalSpent).toBeCloseTo(23.98, 2)
    expect(stats.pricedVolumes).toBe(2)
    expect(stats.averagePricePerTrackedVolume).toBeCloseTo(11.99, 2)
  })

  it("categorizes manga and light_novel series correctly", () => {
    const manga = makeSeries({ id: "s1", type: "manga" })
    const ln = makeSeries({ id: "s2", type: "light_novel" })
    const other = makeSeries({ id: "s3", type: "other" })
    const stats = computeCollectionStats([manga, ln, other])
    expect(stats.mangaSeries).toBe(1)
    expect(stats.lightNovelSeries).toBe(1)
    expect(stats.totalSeries).toBe(3)
  })

  it("counts complete sets when all volumes are owned and total_volumes met", () => {
    const series = makeSeries({
      total_volumes: 3,
      volumes: [
        makeVolume({ id: "v1", ownership_status: "owned", volume_number: 1 }),
        makeVolume({ id: "v2", ownership_status: "owned", volume_number: 2 }),
        makeVolume({ id: "v3", ownership_status: "owned", volume_number: 3 })
      ]
    })
    const stats = computeCollectionStats([series])
    expect(stats.completeSets).toBe(1)
  })

  it("does not count complete set when total_volumes is not met", () => {
    const series = makeSeries({
      total_volumes: 5,
      volumes: [
        makeVolume({ id: "v1", ownership_status: "owned" }),
        makeVolume({ id: "v2", ownership_status: "owned" })
      ]
    })
    const stats = computeCollectionStats([series])
    expect(stats.completeSets).toBe(0)
  })

  it("tracks pages and read pages", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          page_count: 200,
          reading_status: "completed"
        }),
        makeVolume({
          id: "v2",
          page_count: 250,
          reading_status: "unread"
        })
      ]
    })
    const stats = computeCollectionStats([series])
    expect(stats.totalPages).toBe(450)
    expect(stats.readPages).toBe(200)
  })

  it("tracks undated priced volumes", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          ownership_status: "owned",
          purchase_price: 9.99,
          purchase_date: null // no date -> undated
        }),
        makeVolume({
          id: "v2",
          ownership_status: "owned",
          purchase_price: 9.99,
          purchase_date: "2025-01-15" // dated -> not undated
        })
      ]
    })
    const stats = computeCollectionStats([series])
    expect(stats.undatedPricedVolumes).toBe(1)
    expect(stats.undatedPricedSpent).toBeCloseTo(9.99, 2)
  })

  it("includes series created within 30 days in recentDelta.series", () => {
    const recent = makeSeries({
      id: "s1",
      created_at: new Date().toISOString()
    })
    const old = makeSeries({
      id: "s2",
      created_at: "2020-01-01T00:00:00Z"
    })
    const stats = computeCollectionStats([recent, old])
    expect(stats.recentDelta.series).toBe(1)
  })

  it("includes volumes created within 30 days in recentDelta.volumes", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", created_at: new Date().toISOString() }),
        makeVolume({ id: "v2", created_at: "2020-01-01T00:00:00Z" })
      ]
    })
    const stats = computeCollectionStats([series])
    expect(stats.recentDelta.volumes).toBe(1)
  })
})

// ── computePriceBreakdown ────────────────────────────────────────────────

describe("computePriceBreakdown", () => {
  it("returns zeros for empty series", () => {
    const result = computePriceBreakdown([])
    expect(result.lnSpent).toBe(0)
    expect(result.mangaSpent).toBe(0)
    expect(result.minPrice).toBe(0)
    expect(result.maxPrice).toBe(0)
    expect(result.medianPrice).toBe(0)
    expect(result.trackedCount).toBe(0)
    expect(result.spendingBySeries).toHaveLength(0)
    expect(result.maxSeriesSpent).toBe(0)
  })

  it("accumulates spending by type", () => {
    const manga = makeSeries({
      id: "s1",
      type: "manga",
      volumes: [
        makeVolume({
          id: "v1",
          ownership_status: "owned",
          purchase_price: 10
        })
      ]
    })
    const ln = makeSeries({
      id: "s2",
      type: "light_novel",
      volumes: [
        makeVolume({
          id: "v2",
          ownership_status: "owned",
          purchase_price: 15
        })
      ]
    })
    const result = computePriceBreakdown([manga, ln])
    expect(result.mangaSpent).toBe(10)
    expect(result.lnSpent).toBe(15)
  })

  it("computes min, max, and median correctly", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", ownership_status: "owned", purchase_price: 5 }),
        makeVolume({ id: "v2", ownership_status: "owned", purchase_price: 10 }),
        makeVolume({ id: "v3", ownership_status: "owned", purchase_price: 15 })
      ]
    })
    const result = computePriceBreakdown([series])
    expect(result.minPrice).toBe(5)
    expect(result.maxPrice).toBe(15)
    expect(result.medianPrice).toBe(10)
  })

  it("computes even-count median (average of two middle values)", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", ownership_status: "owned", purchase_price: 10 }),
        makeVolume({ id: "v2", ownership_status: "owned", purchase_price: 20 })
      ]
    })
    const result = computePriceBreakdown([series])
    expect(result.medianPrice).toBe(15)
  })

  it("ignores non-owned volumes", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          ownership_status: "wishlist",
          purchase_price: 50
        })
      ]
    })
    const result = computePriceBreakdown([series])
    expect(result.trackedCount).toBe(0)
  })

  it("limits spendingBySeries to topLimit", () => {
    const seriesList: SeriesWithVolumes[] = []
    for (let i = 1; i <= 8; i++) {
      seriesList.push(
        makeSeries({
          id: `s${i}`,
          title: `Series ${i}`,
          volumes: [
            makeVolume({
              id: `v${i}`,
              ownership_status: "owned",
              purchase_price: i * 10
            })
          ]
        })
      )
    }
    const result = computePriceBreakdown(seriesList, 5)
    expect(result.spendingBySeries).toHaveLength(5)
    // Should be sorted descending by total
    expect(result.spendingBySeries[0].total).toBeGreaterThan(
      result.spendingBySeries[1].total
    )
  })
})

// ── computeWishlistStats ─────────────────────────────────────────────────

describe("computeWishlistStats", () => {
  it("returns zeros for empty series", () => {
    const result = computeWishlistStats([])
    expect(result.totalCount).toBe(0)
    expect(result.totalWishlistCost).toBe(0)
    expect(result.wishlistPricedCount).toBe(0)
    expect(result.averageWishlistPrice).toBe(0)
    expect(result.topWishlistedSeries).toHaveLength(0)
    expect(result.maxWishlistSeriesCount).toBe(0)
  })

  it("counts wishlist volumes and total cost", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          ownership_status: "wishlist",
          purchase_price: 10
        }),
        makeVolume({
          id: "v2",
          ownership_status: "wishlist",
          purchase_price: 20
        }),
        makeVolume({ id: "v3", ownership_status: "owned", purchase_price: 50 }) // owned - ignored
      ]
    })
    const result = computeWishlistStats([series])
    expect(result.totalCount).toBe(2)
    expect(result.totalWishlistCost).toBe(30)
    expect(result.wishlistPricedCount).toBe(2)
    expect(result.averageWishlistPrice).toBe(15)
  })

  it("returns topWishlistedSeries sorted by count", () => {
    const s1 = makeSeries({
      id: "s1",
      title: "Heavy",
      volumes: [
        makeVolume({ id: "v1", ownership_status: "wishlist" }),
        makeVolume({ id: "v2", ownership_status: "wishlist" }),
        makeVolume({ id: "v3", ownership_status: "wishlist" })
      ]
    })
    const s2 = makeSeries({
      id: "s2",
      title: "Light",
      volumes: [makeVolume({ id: "v4", ownership_status: "wishlist" })]
    })
    const result = computeWishlistStats([s1, s2])
    expect(result.topWishlistedSeries[0].id).toBe("s1")
    expect(result.topWishlistedSeries[0].count).toBe(3)
    expect(result.maxWishlistSeriesCount).toBe(3)
  })
})

// ── computeSuggestedBuys ─────────────────────────────────────────────────

describe("computeSuggestedBuys", () => {
  it("returns empty array for series with no owned volumes", () => {
    const series = makeSeries({
      volumes: [makeVolume({ id: "v1", ownership_status: "wishlist" })]
    })
    const result = computeSuggestedBuys([series])
    expect(result).toHaveLength(0)
  })

  it("suggests gap fill for missing volumes in a sequence", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", volume_number: 1, ownership_status: "owned" }),
        makeVolume({ id: "v3", volume_number: 3, ownership_status: "owned" })
        // vol 2 is missing
      ]
    })
    const result = computeSuggestedBuys([series])
    const gap = result.find((r) => r.volumeNumber === 2)
    expect(gap).toBeDefined()
    expect(gap?.isGap).toBe(true)
    expect(gap?.category).toBe("gap_fill")
  })

  it("suggests next volume after the highest owned", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", volume_number: 1, ownership_status: "owned" })
      ]
    })
    const result = computeSuggestedBuys([series])
    const next = result.find((r) => r.volumeNumber === 2)
    expect(next).toBeDefined()
    expect(next?.isGap).toBe(false)
  })

  it("does not suggest next volume beyond total_volumes", () => {
    const series = makeSeries({
      total_volumes: 3,
      volumes: [
        makeVolume({ id: "v1", volume_number: 1, ownership_status: "owned" }),
        makeVolume({ id: "v2", volume_number: 2, ownership_status: "owned" }),
        makeVolume({ id: "v3", volume_number: 3, ownership_status: "owned" })
      ]
    })
    const result = computeSuggestedBuys([series])
    // All volumes owned, no suggestions
    expect(result).toHaveLength(0)
  })

  it("assigns continue_reading category when user is currently reading", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          volume_number: 1,
          ownership_status: "owned",
          reading_status: "reading"
        })
      ]
    })
    const result = computeSuggestedBuys([series])
    const next = result.find((r) => r.volumeNumber === 2)
    expect(next?.category).toBe("continue_reading")
    expect(next?.isReading).toBe(true)
  })

  it("assigns complete_series when ownership ratio is >= 0.8", () => {
    const series = makeSeries({
      total_volumes: 5,
      volumes: [
        makeVolume({ id: "v1", volume_number: 1, ownership_status: "owned" }),
        makeVolume({ id: "v2", volume_number: 2, ownership_status: "owned" }),
        makeVolume({ id: "v3", volume_number: 3, ownership_status: "owned" }),
        makeVolume({ id: "v4", volume_number: 4, ownership_status: "owned" })
        // own 4 of 5 = 80%
      ]
    })
    const result = computeSuggestedBuys([series])
    const next = result.find((r) => r.volumeNumber === 5)
    expect(next?.category).toBe("complete_series")
  })

  it("filters out dismissed series", () => {
    const series = makeSeries({
      id: "dismissed-series",
      volumes: [
        makeVolume({ id: "v1", volume_number: 1, ownership_status: "owned" })
      ]
    })
    const dismissed = new Set(["dismissed-series"])
    const result = computeSuggestedBuys([series], undefined, dismissed)
    expect(result).toHaveLength(0)
  })

  it("respects the limit parameter", () => {
    // Create many series with gaps
    const seriesList: SeriesWithVolumes[] = []
    for (let i = 1; i <= 10; i++) {
      seriesList.push(
        makeSeries({
          id: `s${i}`,
          volumes: [
            makeVolume({
              id: `v${i}-1`,
              volume_number: 1,
              ownership_status: "owned"
            }),
            makeVolume({
              id: `v${i}-3`,
              volume_number: 3,
              ownership_status: "owned"
            })
          ]
        })
      )
    }
    const result = computeSuggestedBuys(seriesList, 3)
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it("marks wishlisted volumes correctly", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", volume_number: 1, ownership_status: "owned" }),
        makeVolume({
          id: "v2",
          volume_number: 2,
          ownership_status: "wishlist",
          purchase_price: 12.99
        })
      ]
    })
    const result = computeSuggestedBuys([series])
    const next = result.find((r) => r.volumeNumber === 2)
    expect(next?.isWishlisted).toBe(true)
    expect(next?.wishlistVolumeId).toBe("v2")
    expect(next?.estimatedPrice).toBe(12.99)
  })

  it("includes cover image from owned volume in same series", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          volume_number: 1,
          ownership_status: "owned",
          cover_image_url: "https://example.com/cover.jpg"
        })
      ]
    })
    const result = computeSuggestedBuys([series])
    expect(result[0]?.coverImageUrl).toBe("https://example.com/cover.jpg")
  })
})

// ── computeSuggestionCounts ──────────────────────────────────────────────

describe("computeSuggestionCounts", () => {
  it("returns zero counts for empty suggestions", () => {
    const counts = computeSuggestionCounts([])
    expect(counts.gap_fill).toBe(0)
    expect(counts.continue).toBe(0)
    expect(counts.complete_series).toBe(0)
    expect(counts.continue_reading).toBe(0)
  })

  it("counts each category correctly", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", volume_number: 1, ownership_status: "owned" }),
        makeVolume({ id: "v3", volume_number: 3, ownership_status: "owned" })
      ]
    })
    const suggestions = computeSuggestedBuys([series])
    const counts = computeSuggestionCounts(suggestions)
    // vol 2 is a gap_fill, vol 4 is continue
    expect(counts.gap_fill).toBeGreaterThanOrEqual(1)
    expect(counts.continue).toBeGreaterThanOrEqual(1)
  })
})

// ── getRecentSeries ──────────────────────────────────────────────────────

describe("getRecentSeries", () => {
  it("returns empty array for empty input", () => {
    expect(getRecentSeries([])).toHaveLength(0)
  })

  it("returns series sorted by created_at descending", () => {
    const older = makeSeries({ id: "s1", created_at: "2024-01-01T00:00:00Z" })
    const newer = makeSeries({ id: "s2", created_at: "2025-06-01T00:00:00Z" })
    const result = getRecentSeries([older, newer])
    expect(result[0].id).toBe("s2")
    expect(result[1].id).toBe("s1")
  })

  it("limits result to the provided limit", () => {
    const series = Array.from({ length: 12 }, (_, i) =>
      makeSeries({
        id: `s${i}`,
        created_at: `2025-0${(i % 9) + 1}-01T00:00:00Z`
      })
    )
    expect(getRecentSeries(series, 5)).toHaveLength(5)
    expect(getRecentSeries(series)).toHaveLength(8) // default limit
  })
})

// ── getRecentVolumes ─────────────────────────────────────────────────────

describe("getRecentVolumes", () => {
  it("returns empty array for empty series", () => {
    expect(getRecentVolumes([])).toHaveLength(0)
  })

  it("returns volumes sorted by created_at descending", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", created_at: "2024-01-01T00:00:00Z" }),
        makeVolume({ id: "v2", created_at: "2025-06-01T00:00:00Z" })
      ]
    })
    const result = getRecentVolumes([series])
    expect(result[0].id).toBe("v2")
    expect(result[1].id).toBe("v1")
  })

  it("augments volumes with seriesTitle and seriesId", () => {
    const series = makeSeries({
      id: "series-abc",
      title: "My Series",
      volumes: [makeVolume()]
    })
    const result = getRecentVolumes([series])
    expect(result[0].seriesId).toBe("series-abc")
    expect(result[0].seriesTitle).toBe("My Series")
  })

  it("limits result to the provided limit", () => {
    const series = makeSeries({
      volumes: Array.from({ length: 20 }, (_, i) =>
        makeVolume({
          id: `v${i}`,
          created_at: `2025-0${(i % 9) + 1}-01T00:00:00Z`
        })
      )
    })
    expect(getRecentVolumes([series], 5)).toHaveLength(5)
  })
})

// ── getCurrentlyReading ──────────────────────────────────────────────────

describe("getCurrentlyReading", () => {
  it("returns empty array when no volumes are being read", () => {
    const series = makeSeries({
      volumes: [makeVolume({ reading_status: "unread" })]
    })
    expect(getCurrentlyReading([series])).toHaveLength(0)
  })

  it("returns volumes with reading_status === 'reading'", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", reading_status: "reading" }),
        makeVolume({ id: "v2", reading_status: "unread" }),
        makeVolume({ id: "v3", reading_status: "reading" })
      ]
    })
    const result = getCurrentlyReading([series])
    expect(result).toHaveLength(2)
    expect(result.every((v) => v.reading_status === "reading")).toBe(true)
  })

  it("respects the limit parameter", () => {
    const series = makeSeries({
      volumes: Array.from({ length: 10 }, (_, i) =>
        makeVolume({ id: `v${i}`, reading_status: "reading" })
      )
    })
    expect(getCurrentlyReading([series], 3)).toHaveLength(3)
  })

  it("includes seriesTitle and seriesId on returned volumes", () => {
    const series = makeSeries({
      id: "s-read",
      title: "Reading Now",
      volumes: [makeVolume({ reading_status: "reading" })]
    })
    const result = getCurrentlyReading([series])
    expect(result[0].seriesId).toBe("s-read")
    expect(result[0].seriesTitle).toBe("Reading Now")
  })
})

// ── computeSpendingTimeSeries ────────────────────────────────────────────

describe("computeSpendingTimeSeries", () => {
  it("returns empty array for empty series", () => {
    expect(computeSpendingTimeSeries([])).toHaveLength(0)
  })

  it("aggregates owned volumes with purchase date by month", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          ownership_status: "owned",
          purchase_price: 10,
          purchase_date: "2025-03-15"
        }),
        makeVolume({
          id: "v2",
          ownership_status: "owned",
          purchase_price: 20,
          purchase_date: "2025-03-20"
        }), // same month
        makeVolume({
          id: "v3",
          ownership_status: "owned",
          purchase_price: 15,
          purchase_date: "2025-04-01"
        }) // diff month
      ]
    })
    const result = computeSpendingTimeSeries([series])
    expect(result).toHaveLength(2)
    const marchEntry = result.find((r) => r.yearMonth === "2025-03")
    expect(marchEntry?.total).toBe(30)
    const aprilEntry = result.find((r) => r.yearMonth === "2025-04")
    expect(aprilEntry?.total).toBe(15)
  })

  it("ignores volumes without purchase_date or purchase_price", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          ownership_status: "owned",
          purchase_price: null,
          purchase_date: "2025-03-15"
        }),
        makeVolume({
          id: "v2",
          ownership_status: "owned",
          purchase_price: 10,
          purchase_date: null
        })
      ]
    })
    expect(computeSpendingTimeSeries([series])).toHaveLength(0)
  })

  it("ignores non-owned volumes", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          ownership_status: "wishlist",
          purchase_price: 10,
          purchase_date: "2025-03-15"
        })
      ]
    })
    expect(computeSpendingTimeSeries([series])).toHaveLength(0)
  })

  it("returns data points sorted ascending by yearMonth", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          ownership_status: "owned",
          purchase_price: 10,
          purchase_date: "2025-06-01"
        }),
        makeVolume({
          id: "v2",
          ownership_status: "owned",
          purchase_price: 10,
          purchase_date: "2025-01-01"
        })
      ]
    })
    const result = computeSpendingTimeSeries([series])
    expect(result[0].yearMonth).toBe("2025-01")
    expect(result[1].yearMonth).toBe("2025-06")
  })
})

// ── computeMonthlyBars ───────────────────────────────────────────────────

describe("computeMonthlyBars", () => {
  it("returns empty array for empty data points", () => {
    expect(computeMonthlyBars([], 400)).toHaveLength(0)
  })

  it("produces one bar per data point", () => {
    const points = [
      { yearMonth: "2025-01", label: "Jan 2025", total: 100 },
      { yearMonth: "2025-02", label: "Feb 2025", total: 200 }
    ]
    const bars = computeMonthlyBars(points, 400)
    expect(bars).toHaveLength(2)
  })

  it("sets rotate=false when 9 or fewer bars", () => {
    const points = Array.from({ length: 9 }, (_, i) => ({
      yearMonth: `2025-0${i + 1}`,
      label: `Month ${i + 1}`,
      total: 100
    }))
    const bars = computeMonthlyBars(points, 600)
    expect(bars.every((b) => b.rotate === false)).toBe(true)
  })

  it("sets rotate=true when more than 9 bars", () => {
    const points = Array.from({ length: 12 }, (_, i) => ({
      yearMonth: `2025-${String(i + 1).padStart(2, "0")}`,
      label: `Month ${i + 1}`,
      total: 100
    }))
    const bars = computeMonthlyBars(points, 600)
    expect(bars.every((b) => b.rotate === true)).toBe(true)
  })

  it("handles zero total gracefully (stub bar)", () => {
    const points = [{ yearMonth: "2025-01", label: "Jan 2025", total: 0 }]
    const bars = computeMonthlyBars(points, 400)
    expect(bars[0].h).toBe(2) // stub height
    expect(bars[0].x).toBeFinite()
  })

  it("abbr is the month part of the label", () => {
    const points = [{ yearMonth: "2025-03", label: "Mar 2025", total: 50 }]
    const bars = computeMonthlyBars(points, 400)
    expect(bars[0].abbr).toBe("Mar")
  })
})

// ── computeReadingVelocity ───────────────────────────────────────────────

describe("computeReadingVelocity", () => {
  it("returns empty for no completed volumes", () => {
    const series = makeSeries({
      volumes: [makeVolume({ reading_status: "unread" })]
    })
    expect(computeReadingVelocity([series])).toHaveLength(0)
  })

  it("counts completed volumes by finished_at month", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          reading_status: "completed",
          finished_at: "2025-03-10T00:00:00Z",
          updated_at: "2025-03-10T00:00:00Z"
        }),
        makeVolume({
          id: "v2",
          reading_status: "completed",
          finished_at: "2025-03-20T00:00:00Z",
          updated_at: "2025-03-20T00:00:00Z"
        })
      ]
    })
    const result = computeReadingVelocity([series])
    expect(result).toHaveLength(1)
    expect(result[0].yearMonth).toBe("2025-03")
    expect(result[0].total).toBe(2)
  })

  it("falls back to updated_at when finished_at is null", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          reading_status: "completed",
          finished_at: null,
          updated_at: "2025-05-01T00:00:00Z"
        })
      ]
    })
    const result = computeReadingVelocity([series])
    expect(result).toHaveLength(1)
    expect(result[0].yearMonth).toBe("2025-05")
  })

  it("returns data sorted ascending by yearMonth", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          reading_status: "completed",
          finished_at: "2025-06-01T00:00:00Z",
          updated_at: "2025-06-01T00:00:00Z"
        }),
        makeVolume({
          id: "v2",
          reading_status: "completed",
          finished_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z"
        })
      ]
    })
    const result = computeReadingVelocity([series])
    expect(result[0].yearMonth).toBe("2025-01")
    expect(result[1].yearMonth).toBe("2025-06")
  })
})

// ── computeTagBreakdown ──────────────────────────────────────────────────

describe("computeTagBreakdown", () => {
  it("returns empty array for series with no tags", () => {
    const series = makeSeries({ tags: [], volumes: [makeVolume()] })
    expect(computeTagBreakdown([series])).toHaveLength(0)
  })

  it("aggregates volumes by tag", () => {
    const series = makeSeries({
      tags: ["action", "fantasy"],
      volumes: [
        makeVolume({ id: "v1", ownership_status: "owned", purchase_price: 10 }),
        makeVolume({ id: "v2", ownership_status: "wishlist" })
      ]
    })
    const result = computeTagBreakdown([series])
    const action = result.find((r) => r.tag === "action")
    expect(action?.volumeCount).toBe(2)
    expect(action?.ownedCount).toBe(1)
    expect(action?.totalSpent).toBe(10)
    expect(action?.seriesCount).toBe(1)
  })

  it("computes avgRating as 0 when no ratings", () => {
    const series = makeSeries({
      tags: ["romance"],
      volumes: [makeVolume({ rating: null })]
    })
    const result = computeTagBreakdown([series])
    expect(result[0].avgRating).toBe(0)
  })

  it("computes avgRating correctly when ratings exist", () => {
    const series = makeSeries({
      tags: ["romance"],
      volumes: [
        makeVolume({ id: "v1", rating: 8 }),
        makeVolume({ id: "v2", rating: 6 })
      ]
    })
    const result = computeTagBreakdown([series])
    expect(result[0].avgRating).toBe(7)
  })

  it("counts distinct series per tag", () => {
    const s1 = makeSeries({
      id: "s1",
      tags: ["action"],
      volumes: [makeVolume()]
    })
    const s2 = makeSeries({
      id: "s2",
      tags: ["action"],
      volumes: [makeVolume({ id: "v2" })]
    })
    const result = computeTagBreakdown([s1, s2])
    const action = result.find((r) => r.tag === "action")
    expect(action?.seriesCount).toBe(2)
  })

  it("sorts by ownedCount descending then by tag name", () => {
    const s1 = makeSeries({
      id: "s1",
      tags: ["zzz"],
      volumes: [makeVolume({ ownership_status: "owned" })]
    })
    const s2 = makeSeries({
      id: "s2",
      tags: ["aaa"],
      volumes: [
        makeVolume({ id: "v2", ownership_status: "owned" }),
        makeVolume({ id: "v3", ownership_status: "owned" })
      ]
    })
    const result = computeTagBreakdown([s1, s2])
    expect(result[0].tag).toBe("aaa")
  })
})

// ── computeReleases ──────────────────────────────────────────────────────

describe("computeReleases", () => {
  it("returns empty upcoming and past for series with no publish_dates", () => {
    const series = makeSeries({ volumes: [makeVolume({ publish_date: null })] })
    const { upcoming, past } = computeReleases([series], new Date("2025-06-01"))
    expect(upcoming).toHaveLength(0)
    expect(past).toHaveLength(0)
  })

  it("separates volumes into upcoming and past based on referenceDate month", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v-past",
          publish_date: "2024-12-15",
          volume_number: 1
        }),
        makeVolume({
          id: "v-future",
          publish_date: "2026-03-15",
          volume_number: 2
        })
      ]
    })
    const refDate = new Date("2025-06-01")
    const { upcoming, past } = computeReleases([series], refDate)
    expect(upcoming.length).toBeGreaterThan(0)
    expect(past.length).toBeGreaterThan(0)
    expect(upcoming[0].items[0].volumeId).toBe("v-future")
    expect(past[0].items[0].volumeId).toBe("v-past")
  })

  it("groups volumes by yearMonth", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", publish_date: "2025-03-10", volume_number: 1 }),
        makeVolume({ id: "v2", publish_date: "2025-03-25", volume_number: 2 })
      ]
    })
    const refDate = new Date("2025-01-01")
    const { upcoming } = computeReleases([series], refDate)
    const marchGroup = upcoming.find((g) => g.yearMonth === "2025-03")
    expect(marchGroup?.items).toHaveLength(2)
  })

  it("marks volumes correctly as owned or wishlisted", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({
          id: "v1",
          publish_date: "2025-03-10",
          ownership_status: "owned",
          volume_number: 1
        }),
        makeVolume({
          id: "v2",
          publish_date: "2025-03-10",
          ownership_status: "wishlist",
          volume_number: 2
        })
      ]
    })
    const refDate = new Date("2025-01-01")
    const { upcoming } = computeReleases([series], refDate)
    const group = upcoming[0]
    const owned = group.items.find((i) => i.volumeId === "v1")
    const wishlisted = group.items.find((i) => i.volumeId === "v2")
    expect(owned?.isOwned).toBe(true)
    expect(wishlisted?.isWishlisted).toBe(true)
  })

  it("past groups are returned in reverse chronological order", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", publish_date: "2023-01-01", volume_number: 1 }),
        makeVolume({ id: "v2", publish_date: "2024-06-01", volume_number: 2 })
      ]
    })
    const refDate = new Date("2025-01-01")
    const { past } = computeReleases([series], refDate)
    expect(past[0].yearMonth).toBe("2024-06")
    expect(past[1].yearMonth).toBe("2023-01")
  })

  it("ignores volumes with invalid publish_date", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", publish_date: "not-a-date", volume_number: 1 })
      ]
    })
    const { upcoming, past } = computeReleases([series], new Date("2025-01-01"))
    expect(upcoming).toHaveLength(0)
    expect(past).toHaveLength(0)
  })
})

// ── computeRatingDistribution ────────────────────────────────────────────

describe("computeRatingDistribution", () => {
  it("returns 11 buckets (0–10) all zero for empty series", () => {
    const { distribution, unratedCount } = computeRatingDistribution([])
    expect(distribution).toHaveLength(11)
    expect(distribution.every((b) => b.count === 0)).toBe(true)
    expect(unratedCount).toBe(0)
  })

  it("counts unrated volumes", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ rating: null }),
        makeVolume({ id: "v2", rating: null })
      ]
    })
    const { unratedCount } = computeRatingDistribution([series])
    expect(unratedCount).toBe(2)
  })

  it("buckets ratings correctly", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", rating: 7 }),
        makeVolume({ id: "v2", rating: 7.4 }), // rounds to 7
        makeVolume({ id: "v3", rating: 10 }),
        makeVolume({ id: "v4", rating: 0 })
      ]
    })
    const { distribution } = computeRatingDistribution([series])
    expect(distribution[7].count).toBe(2) // both round to 7
    expect(distribution[10].count).toBe(1)
    expect(distribution[0].count).toBe(1)
  })

  it("clamps out-of-range ratings to [0, 10]", () => {
    const series = makeSeries({
      volumes: [
        makeVolume({ id: "v1", rating: -1 }), // clamps to 0
        makeVolume({ id: "v2", rating: 11 }) // clamps to 10
      ]
    })
    const { distribution } = computeRatingDistribution([series])
    expect(distribution[0].count).toBe(1)
    expect(distribution[10].count).toBe(1)
  })

  it("distribution array has correct rating indexes", () => {
    const { distribution } = computeRatingDistribution([])
    distribution.forEach((point, idx) => {
      expect(point.rating).toBe(idx)
    })
  })
})
