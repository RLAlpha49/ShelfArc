import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

// ── Types ──────────────────────────────────────────────────────────────

/** A volume entry augmented with its parent series title and ID. */
export interface AugmentedVolume extends Volume {
  seriesTitle: string
  seriesId: string
}

/** Categorizes a suggested purchase by its strategic priority. */
export type SuggestionCategory =
  | "gap_fill"
  | "continue"
  | "complete_series"
  | "continue_reading"

/** A suggested next-purchase item computed from collection gaps and reading status. */
export interface SuggestedBuy {
  seriesId: string
  seriesTitle: string
  seriesType: string
  volumeNumber: number
  isGap: boolean
  isWishlisted: boolean
  estimatedPrice: number | null
  score: number
  isReading: boolean
  category: SuggestionCategory
}

/** Per-category counts for a list of suggestions. */
export type SuggestionCounts = Record<SuggestionCategory, number>

export interface CollectionStats {
  totalSeries: number
  totalVolumes: number
  ownedVolumes: number
  readVolumes: number
  readingVolumes: number
  lightNovelSeries: number
  mangaSeries: number
  totalSpent: number
  pricedVolumes: number
  averagePricePerTrackedVolume: number
  wishlistCount: number
  completeSets: number
  totalPages: number
  readPages: number
  /** 30-day rolling additions. */
  recentDelta: {
    series: number
    volumes: number
    readVolumes: number
    spent: number
  }
}

export interface PriceBreakdown {
  lnSpent: number
  mangaSpent: number
  minPrice: number
  maxPrice: number
  medianPrice: number
  trackedCount: number
  spendingBySeries: Array<{
    id: string
    title: string
    type: string
    total: number
    volumeCount: number
  }>
  maxSeriesSpent: number
}

export interface WishlistStats {
  totalWishlistCost: number
  wishlistPricedCount: number
  averageWishlistPrice: number
  topWishlistedSeries: Array<{
    id: string
    title: string
    type: string
    count: number
    cost: number
  }>
  maxWishlistSeriesCount: number
  totalCount: number
}

export interface ReleaseItem {
  volumeId: string
  seriesId: string
  seriesTitle: string
  seriesType: string
  volumeNumber: number | null
  volumeTitle: string
  publishDate: Date
  isOwned: boolean
  isWishlisted: boolean
  coverUrl: string | null
  releaseReminder: boolean
}

export interface MonthGroup {
  /** Display label, e.g. "March 2026" */
  label: string
  /** Sortable key, e.g. "2026-03" */
  yearMonth: string
  items: ReleaseItem[]
}

interface VolumeTally {
  owned: number
  wishlist: number
  read: number
  reading: number
  spent: number
  priced: number
  totalPages: number
  readPages: number
}

/** Tallies volume-level counters in a single pass. O(V) total. */
function tallyVolumes(volumes: Volume[]): VolumeTally {
  let owned = 0
  let wishlist = 0
  let read = 0
  let reading = 0
  let spent = 0
  let priced = 0
  let totalPages = 0
  let readPages = 0
  for (const v of volumes) {
    if (v.ownership_status === "owned") {
      owned++
      const price = v.purchase_price ?? 0
      spent += price
      if (price > 0) priced++
    }
    if (v.ownership_status === "wishlist") wishlist++
    if (v.reading_status === "completed") read++
    if (v.reading_status === "reading") reading++
    totalPages += v.page_count ?? 0
    if (v.reading_status === "completed") readPages += v.page_count ?? 0
  }
  return {
    owned,
    wishlist,
    read,
    reading,
    spent,
    priced,
    totalPages,
    readPages
  }
}

interface DeltaTally {
  volumes: number
  readVolumes: number
  spent: number
}

/** Tallies 30-day rolling additions for volumes. */
function tallyDelta(volumes: Volume[], cutoffIso: string): DeltaTally {
  let vol = 0
  let read = 0
  let spent = 0
  for (const v of volumes) {
    if (v.created_at >= cutoffIso) {
      vol++
      if (v.ownership_status === "owned" && v.purchase_price) {
        spent += v.purchase_price
      }
    }
    const recentlyCompleted =
      v.reading_status === "completed" &&
      ((v.finished_at && v.finished_at >= cutoffIso) ||
        (!v.finished_at && v.updated_at >= cutoffIso))
    if (recentlyCompleted) read++
  }
  return { volumes: vol, readVolumes: read, spent }
}

// O(S + V) single-pass over series and volumes
export function computeCollectionStats(
  series: SeriesWithVolumes[]
): CollectionStats {
  let lightNovelSeries = 0
  let mangaSeries = 0
  let totalVolumes = 0
  let ownedVolumes = 0
  let wishlistCount = 0
  let readVolumes = 0
  let readingVolumes = 0
  let totalSpent = 0
  let pricedVolumes = 0
  let completeSets = 0
  let totalPages = 0
  let readPages = 0
  let deltaSeriesCount = 0
  let deltaVolumes = 0
  let deltaReadVolumes = 0
  let deltaSpent = 0

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffIso = cutoff.toISOString()

  for (const s of series) {
    if (s.type === "light_novel") lightNovelSeries++
    else if (s.type === "manga") mangaSeries++

    if (s.created_at >= cutoffIso) deltaSeriesCount++

    const vols = s.volumes
    totalVolumes += vols.length
    const t = tallyVolumes(vols)
    ownedVolumes += t.owned
    wishlistCount += t.wishlist
    readVolumes += t.read
    readingVolumes += t.reading
    totalSpent += t.spent
    pricedVolumes += t.priced
    totalPages += t.totalPages
    readPages += t.readPages

    const d = tallyDelta(vols, cutoffIso)
    deltaVolumes += d.volumes
    deltaReadVolumes += d.readVolumes
    deltaSpent += d.spent

    const isComplete =
      (s.total_volumes ?? 0) > 0 &&
      vols.length > 0 &&
      t.owned === vols.length &&
      t.owned >= s.total_volumes!
    if (isComplete) completeSets++
  }

  return {
    totalSeries: series.length,
    totalVolumes,
    ownedVolumes,
    readVolumes,
    readingVolumes,
    lightNovelSeries,
    mangaSeries,
    totalSpent,
    pricedVolumes,
    averagePricePerTrackedVolume:
      pricedVolumes > 0 ? totalSpent / pricedVolumes : 0,
    wishlistCount,
    completeSets,
    totalPages,
    readPages,
    recentDelta: {
      series: deltaSeriesCount,
      volumes: deltaVolumes,
      readVolumes: deltaReadVolumes,
      spent: deltaSpent
    }
  }
}

interface PriceAccumulator {
  prices: number[]
  lnSpent: number
  mangaSpent: number
  seriesSpending: Map<
    string,
    {
      id: string
      title: string
      type: string
      total: number
      volumeCount: number
    }
  >
}

/** Processes a single series' owned-volume prices into the accumulator. */
function accumulateSeriesPrices(
  acc: PriceAccumulator,
  s: SeriesWithVolumes
): void {
  let seriesTotal = 0
  let seriesPricedCount = 0

  for (const v of s.volumes) {
    if (v.ownership_status !== "owned") continue
    const price = v.purchase_price ?? 0
    if (price > 0) {
      acc.prices.push(price)
      seriesTotal += price
      seriesPricedCount++
    }
    if (s.type === "light_novel") acc.lnSpent += price
    else if (s.type === "manga") acc.mangaSpent += price
  }

  if (seriesTotal > 0) {
    acc.seriesSpending.set(s.id, {
      id: s.id,
      title: s.title,
      type: s.type,
      total: seriesTotal,
      volumeCount: seriesPricedCount
    })
  }
}

function computeMedian(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// O(S + V + P·log P) single-pass aggregation (was ~6 full passes over all volumes)
export function computePriceBreakdown(
  series: SeriesWithVolumes[],
  topLimit = 5
): PriceBreakdown {
  const acc: PriceAccumulator = {
    prices: [],
    lnSpent: 0,
    mangaSpent: 0,
    seriesSpending: new Map()
  }

  for (const s of series) {
    accumulateSeriesPrices(acc, s)
  }

  const { prices } = acc
  let minPrice = 0
  let maxPrice = 0
  let medianPrice = 0
  if (prices.length > 0) {
    prices.sort((a, b) => a - b)
    minPrice = prices[0]
    maxPrice = prices.at(-1)!
    medianPrice = computeMedian(prices)
  }

  const spendingBySeries = [...acc.seriesSpending.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, topLimit)

  return {
    lnSpent: acc.lnSpent,
    mangaSpent: acc.mangaSpent,
    minPrice,
    maxPrice,
    medianPrice,
    trackedCount: prices.length,
    spendingBySeries,
    maxSeriesSpent: spendingBySeries.length > 0 ? spendingBySeries[0].total : 0
  }
}

// O(V + W·log W) single-pass (was 2 extra filter passes over wishlist volumes)
export function computeWishlistStats(
  series: SeriesWithVolumes[],
  topLimit = 5
): WishlistStats {
  let totalCount = 0
  let totalWishlistCost = 0
  let wishlistPricedCount = 0

  const seriesMap = new Map<
    string,
    { id: string; title: string; type: string; count: number; cost: number }
  >()

  // Single pass: iterate volumes, accumulate totals and per-series counts together
  for (const s of series) {
    for (const v of s.volumes) {
      if (v.ownership_status !== "wishlist") continue
      totalCount++
      const price = v.purchase_price ?? 0
      if (price > 0) {
        totalWishlistCost += price
        wishlistPricedCount++
      }
      const existing = seriesMap.get(s.id)
      if (existing) {
        existing.count++
        existing.cost += price
      } else {
        seriesMap.set(s.id, {
          id: s.id,
          title: s.title,
          type: s.type,
          count: 1,
          cost: price
        })
      }
    }
  }

  const topWishlistedSeries = [...seriesMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, topLimit)

  return {
    totalWishlistCost,
    wishlistPricedCount,
    averageWishlistPrice:
      wishlistPricedCount > 0 ? totalWishlistCost / wishlistPricedCount : 0,
    topWishlistedSeries,
    maxWishlistSeriesCount:
      topWishlistedSeries.length > 0 ? topWishlistedSeries[0].count : 0,
    totalCount
  }
}

export function computeSuggestedBuys(
  series: SeriesWithVolumes[],
  limit?: number
): SuggestedBuy[] {
  const suggestions: SuggestedBuy[] = []

  const computeScore = (
    isGap: boolean,
    isReading: boolean,
    ownedCount: number,
    hasPrice: boolean
  ) => {
    let score = isGap ? 20 : 10
    if (isReading) score += 30
    score += ownedCount
    if (hasPrice) score += 5
    return score
  }

  const makeSuggestion = (
    s: SeriesWithVolumes,
    volumeNumber: number,
    isGap: boolean,
    wishlistMap: Map<number, Volume>,
    isReading: boolean,
    ownedCount: number,
    ownershipRatio: number
  ): SuggestedBuy => {
    const wishlistVol = wishlistMap.get(volumeNumber)
    let category: SuggestionCategory
    if (isGap) {
      category = "gap_fill"
    } else if (isReading) {
      category = "continue_reading"
    } else if (ownershipRatio >= 0.8) {
      category = "complete_series"
    } else {
      category = "continue"
    }
    return {
      seriesId: s.id,
      seriesTitle: s.title,
      seriesType: s.type,
      volumeNumber,
      isGap,
      isWishlisted: wishlistMap.has(volumeNumber),
      estimatedPrice: wishlistVol?.purchase_price ?? null,
      score: computeScore(
        isGap,
        isReading,
        ownedCount,
        !!wishlistVol?.purchase_price
      ),
      isReading,
      category
    }
  }

  for (const s of series) {
    const ownedVolumes = s.volumes.filter((v) => v.ownership_status === "owned")
    if (ownedVolumes.length === 0) continue

    const ownedNumbers = new Set(ownedVolumes.map((v) => v.volume_number))
    const wishlistMap = new Map(
      s.volumes
        .filter((v) => v.ownership_status === "wishlist")
        .map((v) => [v.volume_number, v] as const)
    )
    const isReading = s.volumes.some((v) => v.reading_status === "reading")
    const maxOwned = Math.max(...ownedNumbers)
    const ownershipRatio =
      s.total_volumes && s.total_volumes > 0
        ? ownedVolumes.length / s.total_volumes
        : 0

    for (let i = 1; i < maxOwned; i++) {
      if (!ownedNumbers.has(i)) {
        suggestions.push(
          makeSuggestion(
            s,
            i,
            true,
            wishlistMap,
            isReading,
            ownedVolumes.length,
            ownershipRatio
          )
        )
      }
    }

    const nextNum = maxOwned + 1
    const isInRange = !s.total_volumes || nextNum <= s.total_volumes
    if (!ownedNumbers.has(nextNum) && isInRange) {
      suggestions.push(
        makeSuggestion(
          s,
          nextNum,
          false,
          wishlistMap,
          isReading,
          ownedVolumes.length,
          ownershipRatio
        )
      )
    }
  }

  const sorted = suggestions.toSorted((a, b) => b.score - a.score)
  return limit == null ? sorted : sorted.slice(0, limit)
}

export function computeSuggestionCounts(
  suggestions: SuggestedBuy[]
): SuggestionCounts {
  const counts: SuggestionCounts = {
    gap_fill: 0,
    continue: 0,
    complete_series: 0,
    continue_reading: 0
  }
  for (const s of suggestions) {
    counts[s.category]++
  }
  return counts
}

export function getRecentSeries(
  series: SeriesWithVolumes[],
  limit = 8
): SeriesWithVolumes[] {
  return [...series]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit)
}

/** Binary-inserts `item` into a descending-by-time array, trimming to `limit`. */
function insertRecent(
  result: AugmentedVolume[],
  item: AugmentedVolume,
  time: number,
  limit: number
): number {
  let lo = 0
  let hi = result.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (new Date(result[mid].created_at).getTime() > time) lo = mid + 1
    else hi = mid
  }
  result.splice(lo, 0, item)
  if (result.length > limit) result.pop()
  return result.length >= limit
    ? new Date(result.at(-1)!.created_at).getTime()
    : 0
}

// O(V) scan + O(V·log L) bounded insertion (was flatMap + full sort + slice)
export function getRecentVolumes(
  series: SeriesWithVolumes[],
  limit = 8
): AugmentedVolume[] {
  const result: AugmentedVolume[] = []
  let minTime = 0

  for (const s of series) {
    for (const v of s.volumes) {
      const time = new Date(v.created_at).getTime()
      if (result.length >= limit && time <= minTime) continue
      const augmented: AugmentedVolume = {
        ...v,
        seriesTitle: s.title,
        seriesId: s.id
      }
      minTime = insertRecent(result, augmented, time, limit)
    }
  }
  return result
}

// O(V) early-exit scan (was flatMap of all volumes + filter + slice)
export function getCurrentlyReading(
  series: SeriesWithVolumes[],
  limit = 5
): AugmentedVolume[] {
  const result: AugmentedVolume[] = []
  for (const s of series) {
    for (const v of s.volumes) {
      if (v.reading_status !== "reading") continue
      result.push({ ...v, seriesTitle: s.title, seriesId: s.id })
      if (result.length >= limit) return result
    }
  }
  return result
}

// ── Spending over time ─────────────────────────────────────────────────

export interface SpendingDataPoint {
  /** Sortable key, e.g. "2025-03" */
  yearMonth: string
  /** Display label, e.g. "Mar 2025" */
  label: string
  /** Total purchase price for all owned volumes bought that month */
  total: number
}

const spendingMonthFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short"
})

function accumulateVolumeSpending(
  map: Map<string, SpendingDataPoint>,
  v: Volume
): void {
  const price = v.purchase_price ?? 0
  if (price <= 0 || !v.purchase_date) return
  const d = new Date(v.purchase_date)
  if (Number.isNaN(d.getTime())) return
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  const existing = map.get(ym)
  if (existing) {
    existing.total += price
  } else {
    map.set(ym, {
      yearMonth: ym,
      label: spendingMonthFormatter.format(d),
      total: price
    })
  }
}

/**
 * Aggregates owned-volume purchase prices by month.
 * Only volumes with both `purchase_date` and `purchase_price > 0` are counted.
 * Returns data points sorted ascending by date.
 */
export function computeSpendingTimeSeries(
  series: SeriesWithVolumes[]
): SpendingDataPoint[] {
  const map = new Map<string, SpendingDataPoint>()
  for (const s of series) {
    for (const v of s.volumes) {
      if (v.ownership_status === "owned") accumulateVolumeSpending(map, v)
    }
  }
  return [...map.values()].sort((a, b) =>
    a.yearMonth.localeCompare(b.yearMonth)
  )
}

// ── Per-tag analytics ──────────────────────────────────────────────────

export interface TagBreakdown {
  tag: string
  volumeCount: number
  ownedCount: number
  totalSpent: number
  /** Rounded to one decimal; 0 when no ratings exist */
  avgRating: number
}

interface TagAccumulator {
  volumeCount: number
  ownedCount: number
  totalSpent: number
  ratingSum: number
  ratingCount: number
}

function getOrCreateTagEntry(
  map: Map<string, TagAccumulator>,
  tag: string
): TagAccumulator {
  let entry = map.get(tag)
  if (!entry) {
    entry = {
      volumeCount: 0,
      ownedCount: 0,
      totalSpent: 0,
      ratingSum: 0,
      ratingCount: 0
    }
    map.set(tag, entry)
  }
  return entry
}

function accumulateTagVolume(entry: TagAccumulator, v: Volume): void {
  entry.volumeCount++
  if (v.ownership_status === "owned") {
    entry.ownedCount++
    entry.totalSpent += v.purchase_price ?? 0
  }
  if (v.rating != null) {
    entry.ratingSum += v.rating
    entry.ratingCount++
  }
}

/**
 * Computes per-tag analytics by iterating series and their volumes.
 * Tags live on the series level (`series.tags: string[]`).
 * Returns entries sorted descending by ownedCount, then by tag name.
 */
export function computeTagBreakdown(
  series: SeriesWithVolumes[]
): TagBreakdown[] {
  const map = new Map<string, TagAccumulator>()

  for (const s of series) {
    if (!s.tags || s.tags.length === 0) continue
    for (const tag of s.tags) {
      const entry = getOrCreateTagEntry(map, tag)
      for (const v of s.volumes) accumulateTagVolume(entry, v)
    }
  }

  return [...map.entries()]
    .map(([tag, e]) => ({
      tag,
      volumeCount: e.volumeCount,
      ownedCount: e.ownedCount,
      totalSpent: e.totalSpent,
      avgRating:
        e.ratingCount > 0
          ? Math.round((e.ratingSum / e.ratingCount) * 10) / 10
          : 0
    }))
    .sort((a, b) => b.ownedCount - a.ownedCount || a.tag.localeCompare(b.tag))
}

export function computeReleases(
  series: SeriesWithVolumes[],
  referenceDate?: Date
): { upcoming: MonthGroup[]; past: MonthGroup[] } {
  const now = referenceDate ?? new Date()
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const monthFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "long"
  })

  const groupMap = new Map<string, MonthGroup>()

  for (const s of series) {
    for (const v of s.volumes) {
      if (!v.publish_date) continue
      const d = new Date(v.publish_date)
      if (Number.isNaN(d.getTime())) continue

      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      let group = groupMap.get(ym)
      if (!group) {
        group = { label: monthFormatter.format(d), yearMonth: ym, items: [] }
        groupMap.set(ym, group)
      }

      group.items.push({
        volumeId: v.id,
        seriesId: s.id,
        seriesTitle: s.title,
        seriesType: s.type,
        volumeNumber: v.volume_number,
        volumeTitle: v.title ?? `Volume ${v.volume_number}`,
        publishDate: d,
        isOwned: v.ownership_status === "owned",
        isWishlisted: v.ownership_status === "wishlist",
        coverUrl: v.cover_image_url,
        releaseReminder: v.release_reminder ?? false
      })
    }
  }

  // Sort items within each group by date
  for (const group of groupMap.values()) {
    group.items.sort(
      (a, b) => a.publishDate.getTime() - b.publishDate.getTime()
    )
  }

  const allGroups = [...groupMap.values()].sort((a, b) =>
    a.yearMonth.localeCompare(b.yearMonth)
  )

  const upcoming = allGroups.filter((g) => g.yearMonth >= currentYearMonth)
  const past = allGroups.filter((g) => g.yearMonth < currentYearMonth).reverse()

  return { upcoming, past }
}
