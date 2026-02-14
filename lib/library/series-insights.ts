import { formatDate } from "@/lib/format-date"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"
import type { DateFormat } from "@/lib/store/settings-store"

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

/**
 * Computes collection insight metrics for a series.
 * @param series - The series including its volumes.
 * @param dateFormat - User's preferred date format.
 * @returns Aggregated insight data.
 * @source
 */
export const buildSeriesInsights = (
  series: SeriesWithVolumes,
  dateFormat: DateFormat
): SeriesInsightData => {
  const ownedVolumeEntries = series.volumes.filter(
    (volume) => volume.ownership_status === "owned"
  )
  const wishlistVolumes = series.volumes.filter(
    (volume) => volume.ownership_status === "wishlist"
  ).length
  const ownedVolumes = ownedVolumeEntries.length
  const readingVolumes = series.volumes.filter(
    (volume) => volume.reading_status === "reading"
  ).length
  const readVolumes = series.volumes.filter(
    (volume) => volume.reading_status === "completed"
  ).length
  const totalVolumes = series.total_volumes ?? series.volumes.length
  const collectionPercent =
    totalVolumes > 0 ? Math.round((ownedVolumes / totalVolumes) * 100) : 0
  const missingVolumes =
    series.total_volumes && series.total_volumes > 0
      ? Math.max(series.total_volumes - ownedVolumes, 0)
      : null
  const totalPages = series.volumes.reduce(
    (acc, volume) => acc + (volume.page_count ?? 0),
    0
  )
  const totalSpent = ownedVolumeEntries.reduce(
    (acc, volume) => acc + (volume.purchase_price ?? 0),
    0
  )
  const pricedVolumeEntries = ownedVolumeEntries.filter(
    (volume) => volume.purchase_price != null && volume.purchase_price > 0
  )
  const allTotalSpent = series.volumes.reduce(
    (acc, volume) => acc + (volume.purchase_price ?? 0),
    0
  )
  const allPricedVolumeEntries = series.volumes.filter(
    (volume) => volume.purchase_price != null && volume.purchase_price > 0
  )
  const pricedVolumes = pricedVolumeEntries.length
  const averagePrice =
    allPricedVolumeEntries.length > 0
      ? allTotalSpent / allPricedVolumeEntries.length
      : 0
  const readPercent =
    totalVolumes > 0 ? Math.round((readVolumes / totalVolumes) * 100) : 0
  const ratedVolumes = series.volumes.filter(
    (volume) => typeof volume.rating === "number"
  )
  const averageRating =
    ratedVolumes.length > 0
      ? Math.round(
          (ratedVolumes.reduce((acc, volume) => acc + (volume.rating ?? 0), 0) /
            ratedVolumes.length) *
            10
        ) / 10
      : null
  const latestVolume = series.volumes.reduce<Volume | null>((best, volume) => {
    if (!best || volume.volume_number > best.volume_number) return volume
    return best
  }, null)
  const ownedVolumeNumbers = ownedVolumeEntries
    .map((volume) => volume.volume_number)
    .filter((value) => Number.isFinite(value))
  const nextVolumeNumber = getNextOwnedVolumeNumber(ownedVolumeNumbers)
  const volumeRangeLabel = buildVolumeRangeLabel(ownedVolumeNumbers)
  const nextVolumeLabel =
    series.total_volumes && nextVolumeNumber > series.total_volumes
      ? "Complete"
      : `Vol. ${nextVolumeNumber}`

  return {
    ownedVolumes,
    wishlistVolumes,
    readingVolumes,
    readVolumes,
    totalVolumes,
    collectionPercent,
    missingVolumes,
    totalPages,
    averageRating,
    latestVolume,
    volumeRangeLabel,
    nextVolumeLabel,
    nextVolumeNumber,
    catalogedVolumes: series.volumes.length,
    officialTotalVolumes: series.total_volumes,
    createdLabel: formatDate(series.created_at, dateFormat),
    updatedLabel: formatDate(series.updated_at, dateFormat),
    totalSpent,
    averagePrice,
    pricedVolumes,
    readPercent
  }
}
