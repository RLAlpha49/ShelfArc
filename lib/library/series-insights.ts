import { formatDate } from "@/lib/format-date"
import type { DateFormat } from "@/lib/store/settings-store"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

/**
 * Extracts a human-readable message from an unknown error value.
 * @param error - The caught error.
 * @returns The error message string.
 * @source
 */
export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/**
 * Converts a volume number to its string representation.
 * @param value - The numeric volume number.
 * @returns The formatted string.
 * @source
 */
export const formatVolumeNumber = (value: number) => value.toString()

/**
 * Builds a compact label like "Vol. 1–5, 7" from a list of volume numbers.
 * @param numbers - Array of volume numbers, potentially unsorted or duplicated.
 * @returns A formatted range string.
 * @source
 */
export const buildVolumeRangeLabel = (numbers: number[]) => {
  const uniqueSorted = Array.from(
    new Set(numbers.filter((value) => Number.isFinite(value)))
  ).sort((a, b) => a - b)

  if (uniqueSorted.length === 0) return "—"

  const ranges: Array<{ start: number; end: number }> = []
  let rangeStart = uniqueSorted[0]
  let rangeEnd = uniqueSorted[0]

  for (let index = 1; index < uniqueSorted.length; index += 1) {
    const value = uniqueSorted[index]
    const isConsecutive = Math.abs(value - (rangeEnd + 1)) < 1e-6
    if (isConsecutive) {
      rangeEnd = value
      continue
    }
    ranges.push({ start: rangeStart, end: rangeEnd })
    rangeStart = value
    rangeEnd = value
  }

  ranges.push({ start: rangeStart, end: rangeEnd })

  const formatted = ranges
    .map(({ start, end }) =>
      start === end
        ? formatVolumeNumber(start)
        : `${formatVolumeNumber(start)}–${formatVolumeNumber(end)}`
    )
    .join(", ")

  return `Vol. ${formatted}`
}

/**
 * Returns the first gap in owned volume numbers, starting from 1.
 * @param numbers - Owned volume numbers.
 * @returns The next volume number that should be purchased.
 * @source
 */
export const getNextOwnedVolumeNumber = (numbers: number[]) => {
  const ownedIntegers = new Set(
    numbers.filter(
      (value) => Number.isFinite(value) && Number.isInteger(value) && value > 0
    )
  )
  let next = 1
  while (ownedIntegers.has(next)) {
    next += 1
  }
  return next
}

/** Pre-computed collection insight metrics for a series. @source */
export type SeriesInsightData = {
  ownedVolumes: number
  wishlistVolumes: number
  readingVolumes: number
  readVolumes: number
  totalVolumes: number
  collectionPercent: number
  missingVolumes: number | null
  totalPages: number
  averageRating: number | null
  latestVolume: Volume | null
  volumeRangeLabel: string
  nextVolumeLabel: string
  nextVolumeNumber: number
  catalogedVolumes: number
  officialTotalVolumes: number | null
  createdLabel: string
  updatedLabel: string
  totalSpent: number
  averagePrice: number
  pricedVolumes: number
  readPercent: number
}

interface InsightAccumulator {
  ownedVolumes: number
  wishlistVolumes: number
  readingVolumes: number
  readVolumes: number
  totalPages: number
  ownedSpent: number
  allSpent: number
  allPricedCount: number
  ratingSum: number
  ratedCount: number
  latestVolume: Volume | null
  ownedVolumeNumbers: number[]
}

/** Tallies ownership and reading status counters. */
function tallyStatuses(volumes: Volume[], acc: InsightAccumulator): void {
  for (const v of volumes) {
    if (v.ownership_status === "owned") {
      acc.ownedVolumes++
      acc.ownedSpent += v.purchase_price ?? 0
      if (Number.isFinite(v.volume_number))
        acc.ownedVolumeNumbers.push(v.volume_number)
    }
    if (v.ownership_status === "wishlist") acc.wishlistVolumes++
    if (v.reading_status === "reading") acc.readingVolumes++
    if (v.reading_status === "completed") acc.readVolumes++
  }
}

/** Tallies pricing, rating, and metadata metrics. */
function tallyMetrics(volumes: Volume[], acc: InsightAccumulator): void {
  for (const v of volumes) {
    acc.totalPages += v.page_count ?? 0
    const price = v.purchase_price ?? 0
    acc.allSpent += price
    if (price > 0) acc.allPricedCount++
    if (typeof v.rating === "number") {
      acc.ratingSum += v.rating
      acc.ratedCount++
    }
    if (!acc.latestVolume || v.volume_number > acc.latestVolume.volume_number) {
      acc.latestVolume = v
    }
  }
}

/** Single-pass volume aggregation for series insights. */
function accumulateVolumes(volumes: Volume[]): InsightAccumulator {
  const acc: InsightAccumulator = {
    ownedVolumes: 0,
    wishlistVolumes: 0,
    readingVolumes: 0,
    readVolumes: 0,
    totalPages: 0,
    ownedSpent: 0,
    allSpent: 0,
    allPricedCount: 0,
    ratingSum: 0,
    ratedCount: 0,
    latestVolume: null,
    ownedVolumeNumbers: []
  }

  tallyStatuses(volumes, acc)
  tallyMetrics(volumes, acc)

  return acc
}

/**
 * Computes collection insight metrics for a series.
 * O(V) single-pass (was ~12 separate filter/reduce passes).
 * @param series - The series including its volumes.
 * @param dateFormat - User's preferred date format.
 * @returns Aggregated insight data.
 * @source
 */
export const buildSeriesInsights = (
  series: SeriesWithVolumes,
  dateFormat: DateFormat
): SeriesInsightData => {
  const a = accumulateVolumes(series.volumes)

  const totalVolumes = series.total_volumes ?? series.volumes.length
  const nextVolumeNumber = getNextOwnedVolumeNumber(a.ownedVolumeNumbers)

  return {
    ownedVolumes: a.ownedVolumes,
    wishlistVolumes: a.wishlistVolumes,
    readingVolumes: a.readingVolumes,
    readVolumes: a.readVolumes,
    totalVolumes,
    collectionPercent:
      totalVolumes > 0 ? Math.round((a.ownedVolumes / totalVolumes) * 100) : 0,
    missingVolumes:
      series.total_volumes && series.total_volumes > 0
        ? Math.max(
            series.total_volumes - (a.ownedVolumes + a.wishlistVolumes),
            0
          )
        : null,
    totalPages: a.totalPages,
    averageRating:
      a.ratedCount > 0
        ? Math.round((a.ratingSum / a.ratedCount) * 10) / 10
        : null,
    latestVolume: a.latestVolume,
    volumeRangeLabel: buildVolumeRangeLabel(a.ownedVolumeNumbers),
    nextVolumeLabel:
      series.total_volumes && nextVolumeNumber > series.total_volumes
        ? "Complete"
        : `Vol. ${nextVolumeNumber}`,
    nextVolumeNumber,
    catalogedVolumes: series.volumes.length,
    officialTotalVolumes: series.total_volumes,
    createdLabel: formatDate(series.created_at, dateFormat),
    updatedLabel: formatDate(series.updated_at, dateFormat),
    totalSpent: a.ownedSpent,
    averagePrice: a.allPricedCount > 0 ? a.allSpent / a.allPricedCount : 0,
    pricedVolumes: a.allPricedCount,
    readPercent:
      totalVolumes > 0 ? Math.round((a.readVolumes / totalVolumes) * 100) : 0
  }
}
