import { toast } from "sonner"

import { getErrorMessage } from "@/lib/library/series-insights"
import type { Volume } from "@/lib/types/database"

/**
 * Returns the lowest-numbered volume that has an ISBN.
 * Used to select the "primary" volume for cover/metadata purposes.
 * @source
 */
export function findPrimaryVolume(volumes: Volume[]): Volume | null {
  return volumes.reduce<Volume | null>((best, volume) => {
    if (!volume.isbn) return best
    if (!best || volume.volume_number < best.volume_number) return volume
    return best
  }, null)
}

/**
 * Applies a rating to a volume with validation and user feedback.
 * @source
 */
export async function applyRating(
  volume: Volume,
  rating: number | null,
  editVolume: (
    seriesId: string | null,
    volumeId: string,
    data: Partial<Volume>
  ) => Promise<void>
) {
  if (!volume.series_id) return

  if (rating == null) {
    try {
      await editVolume(volume.series_id, volume.id, { rating: null })
      toast.success("Rating cleared")
    } catch (err) {
      toast.error(`Failed to update: ${getErrorMessage(err)}`)
    }
    return
  }

  if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
    toast.error("Rating must be between 0 and 10")
    return
  }

  try {
    await editVolume(volume.series_id, volume.id, { rating })
    toast.success(`Rated ${rating}/10`)
  } catch (err) {
    toast.error(`Failed to update: ${getErrorMessage(err)}`)
  }
}

/**
 * Toggles a value in a Set, returning a new Set.
 * @source
 */
export function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) {
    next.delete(value)
  } else {
    next.add(value)
  }
  return next
}

/**
 * Builds a currency formatter function for the given currency code.
 * Falls back to USD on invalid currency codes.
 * @source
 */
export function buildCurrencyFormatter(currency: string) {
  try {
    const withDecimals = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    const noDecimals = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
    return (value: number) =>
      Number.isInteger(value)
        ? noDecimals.format(value)
        : withDecimals.format(value)
  } catch {
    const withDecimals = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    const noDecimals = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
    return (value: number) =>
      Number.isInteger(value)
        ? noDecimals.format(value)
        : withDecimals.format(value)
  }
}
