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
}

export interface MonthGroup {
  /** Display label, e.g. "March 2026" */
  label: string
  /** Sortable key, e.g. "2026-03" */
  yearMonth: string
  items: ReleaseItem[]
}

// ── Pure functions ─────────────────────────────────────────────────────

export function computeCollectionStats(
  series: SeriesWithVolumes[]
): CollectionStats {
  const totalSeries = series.length
  const lightNovelSeries = series.filter(
    (s) => s.type === "light_novel"
  ).length
  const mangaSeries = series.filter((s) => s.type === "manga").length

  const volumes = series.flatMap((s) => s.volumes)
  const totalVolumes = volumes.length
  const owned = volumes.filter((v) => v.ownership_status === "owned")
  const ownedVolumes = owned.length
  const wishlistCount = volumes.filter(
    (v) => v.ownership_status === "wishlist"
  ).length
  const readVolumes = volumes.filter(
    (v) => v.reading_status === "completed"
  ).length
  const readingVolumes = volumes.filter(
    (v) => v.reading_status === "reading"
  ).length

  const totalSpent = owned.reduce(
    (acc, v) => acc + (v.purchase_price ?? 0),
    0
  )
  const pricedVolumes = owned.filter(
    (v) => (v.purchase_price ?? 0) > 0
  ).length
  const averagePricePerTrackedVolume =
    pricedVolumes > 0 ? totalSpent / pricedVolumes : 0

  const completeSets = series.filter((s) => {
    const hintedTotal = s.total_volumes
    if (!hintedTotal || hintedTotal <= 0) return false
    if (s.volumes.length === 0) return false

    const ownedCount = s.volumes.filter(
      (v) => v.ownership_status === "owned"
    ).length
    const allOwned = ownedCount === s.volumes.length
    return allOwned && ownedCount >= hintedTotal
  }).length

  return {
    totalSeries,
    totalVolumes,
    ownedVolumes,
    readVolumes,
    readingVolumes,
    lightNovelSeries,
    mangaSeries,
    totalSpent,
    pricedVolumes,
    averagePricePerTrackedVolume,
    wishlistCount,
    completeSets
  }
}

export function computePriceBreakdown(
  series: SeriesWithVolumes[],
  topLimit = 5
): PriceBreakdown {
  const allPricedVolumes = series.flatMap((s) =>
    s.volumes
      .filter((v) => v.ownership_status === "owned")
      .filter((v) => v.purchase_price != null && v.purchase_price > 0)
      .map((v) => ({ ...v, seriesTitle: s.title, seriesType: s.type }))
  )

  const lnSpent = series
    .filter((s) => s.type === "light_novel")
    .reduce(
      (acc, s) =>
        acc +
        s.volumes
          .filter((v) => v.ownership_status === "owned")
          .reduce((vAcc, v) => vAcc + (v.purchase_price || 0), 0),
      0
    )

  const mangaSpent = series
    .filter((s) => s.type === "manga")
    .reduce(
      (acc, s) =>
        acc +
        s.volumes
          .filter((v) => v.ownership_status === "owned")
          .reduce((vAcc, v) => vAcc + (v.purchase_price || 0), 0),
      0
    )

  const prices = allPricedVolumes.map((v) => v.purchase_price!)
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0
  const medianPrice =
    prices.length > 0
      ? (() => {
          const sorted = [...prices].sort((a, b) => a - b)
          const mid = Math.floor(sorted.length / 2)
          return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid]
        })()
      : 0

  const spendingBySeries = series
    .map((s) => {
      const owned = s.volumes.filter((v) => v.ownership_status === "owned")
      return {
        id: s.id,
        title: s.title,
        type: s.type,
        total: owned.reduce((acc, v) => acc + (v.purchase_price || 0), 0),
        volumeCount: owned.filter(
          (v) => v.purchase_price != null && v.purchase_price > 0
        ).length
      }
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, topLimit)

  const maxSeriesSpent =
    spendingBySeries.length > 0 ? spendingBySeries[0].total : 0

  return {
    lnSpent,
    mangaSpent,
    minPrice,
    maxPrice,
    medianPrice,
    trackedCount: allPricedVolumes.length,
    spendingBySeries,
    maxSeriesSpent
  }
}

export function computeWishlistStats(
  series: SeriesWithVolumes[],
  topLimit = 5
): WishlistStats {
  const wishlistVolumes = series.flatMap((s) =>
    s.volumes
      .filter((v) => v.ownership_status === "wishlist")
      .map((v) => ({
        ...v,
        seriesTitle: s.title,
        seriesId: s.id,
        seriesType: s.type
      }))
  )

  const totalWishlistCost = wishlistVolumes
    .filter((v) => v.purchase_price != null && v.purchase_price > 0)
    .reduce((acc, v) => acc + v.purchase_price!, 0)

  const wishlistPricedCount = wishlistVolumes.filter(
    (v) => v.purchase_price != null && v.purchase_price > 0
  ).length

  const averageWishlistPrice =
    wishlistPricedCount > 0 ? totalWishlistCost / wishlistPricedCount : 0

  const seriesMap = new Map<
    string,
    { id: string; title: string; type: string; count: number; cost: number }
  >()
  for (const v of wishlistVolumes) {
    const existing = seriesMap.get(v.seriesId)
    if (existing) {
      existing.count++
      existing.cost += v.purchase_price ?? 0
    } else {
      seriesMap.set(v.seriesId, {
        id: v.seriesId,
        title: v.seriesTitle,
        type: v.seriesType,
        count: 1,
        cost: v.purchase_price ?? 0
      })
    }
  }
  const topWishlistedSeries = [...seriesMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, topLimit)

  const maxWishlistSeriesCount =
    topWishlistedSeries.length > 0 ? topWishlistedSeries[0].count : 0

  return {
    totalWishlistCost,
    wishlistPricedCount,
    averageWishlistPrice,
    topWishlistedSeries,
    maxWishlistSeriesCount,
    totalCount: wishlistVolumes.length
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
    const ownedVolumes = s.volumes.filter(
      (v) => v.ownership_status === "owned"
    )
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

export function getRecentVolumes(
  series: SeriesWithVolumes[],
  limit = 8
): AugmentedVolume[] {
  return series
    .flatMap((s) =>
      s.volumes.map((v) => ({ ...v, seriesTitle: s.title, seriesId: s.id }))
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit)
}

export function getCurrentlyReading(
  series: SeriesWithVolumes[],
  limit = 5
): AugmentedVolume[] {
  return series
    .flatMap((s) =>
      s.volumes.map((v) => ({ ...v, seriesTitle: s.title, seriesId: s.id }))
    )
    .filter((v) => v.reading_status === "reading")
    .slice(0, limit)
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
        coverUrl: v.cover_image_url
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
  const past = allGroups
    .filter((g) => g.yearMonth < currentYearMonth)
    .reverse()

  return { upcoming, past }
}
