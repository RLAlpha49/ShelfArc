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
