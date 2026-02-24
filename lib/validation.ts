import type {
  BookOrientation,
  OwnershipStatus,
  ReadingStatus,
  SeriesStatus,
  TitleType,
  VolumeEdition,
  VolumeFormat
} from "@/lib/types/database"
import { extractStoragePath } from "@/lib/uploads/resolve-image-url"

/** All valid title type values. @source */
export const TITLE_TYPES: readonly TitleType[] = [
  "light_novel",
  "manga",
  "other"
] as const

/** All valid ownership status values. @source */
export const OWNERSHIP_STATUSES: readonly OwnershipStatus[] = [
  "owned",
  "wishlist"
] as const

/** All valid reading status values. @source */
export const READING_STATUSES: readonly ReadingStatus[] = [
  "unread",
  "reading",
  "completed",
  "on_hold",
  "dropped"
] as const

/** All valid book orientation values. @source */
export const BOOK_ORIENTATIONS: readonly BookOrientation[] = [
  "vertical",
  "horizontal"
] as const

/** All valid series status values. @source */
export const SERIES_STATUSES: readonly SeriesStatus[] = [
  "ongoing",
  "completed",
  "hiatus",
  "cancelled",
  "announced"
] as const

/** All valid volume edition values. @source */
export const VOLUME_EDITIONS: readonly VolumeEdition[] = [
  "standard",
  "first_edition",
  "collectors",
  "omnibus",
  "box_set",
  "limited",
  "deluxe"
] as const

/** All valid volume format values. @source */
export const VOLUME_FORMATS: readonly VolumeFormat[] = [
  "paperback",
  "hardcover",
  "digital",
  "audiobook"
] as const

/**
 * Type guard for valid `TitleType` values.
 * @param value - The value to check.
 * @source
 */
export const isValidTitleType = (value: unknown): value is TitleType =>
  typeof value === "string" &&
  (TITLE_TYPES as readonly string[]).includes(value)

/**
 * Type guard for valid `OwnershipStatus` values.
 * @param value - The value to check.
 * @source
 */
export const isValidOwnershipStatus = (
  value: unknown
): value is OwnershipStatus =>
  typeof value === "string" &&
  (OWNERSHIP_STATUSES as readonly string[]).includes(value)

/**
 * Type guard for valid `ReadingStatus` values.
 * @param value - The value to check.
 * @source
 */
export const isValidReadingStatus = (value: unknown): value is ReadingStatus =>
  typeof value === "string" &&
  (READING_STATUSES as readonly string[]).includes(value)

/**
 * Type guard for valid `SeriesStatus` values.
 * @param value - The value to check.
 * @source
 */
export const isValidSeriesStatus = (value: unknown): value is SeriesStatus =>
  typeof value === "string" &&
  (SERIES_STATUSES as readonly string[]).includes(value)

/**
 * Type guard for valid `VolumeEdition` values.
 * @param value - The value to check.
 * @source
 */
export const isValidVolumeEdition = (value: unknown): value is VolumeEdition =>
  typeof value === "string" &&
  (VOLUME_EDITIONS as readonly string[]).includes(value)

/**
 * Type guard for valid `VolumeFormat` values.
 * @param value - The value to check.
 * @source
 */
export const isValidVolumeFormat = (value: unknown): value is VolumeFormat =>
  typeof value === "string" &&
  (VOLUME_FORMATS as readonly string[]).includes(value)

/**
 * Type guard for positive integers.
 * @param value - The value to check.
 * @source
 */
export const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0

/**
 * Type guard for non-negative integers.
 * @param value - The value to check.
 * @source
 */
export const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0

/**
 * Type guard for non-negative finite numbers.
 * @param value - The value to check.
 * @source
 */
export const isNonNegativeFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0

/**
 * Type guard for strings that start with `http://` or `https://`.
 * @param value - The value to check.
 * @source
 */
export const isValidUrl = (value: unknown): value is string =>
  typeof value === "string" &&
  (value.startsWith("https://") || value.startsWith("http://"))

/** Allow-listed Amazon hostnames for URL validation. @source */
export const AMAZON_DOMAINS: ReadonlySet<string> = new Set([
  "amazon.com",
  "amazon.co.jp",
  "amazon.co.uk",
  "amazon.de",
  "amazon.fr",
  "amazon.it",
  "amazon.es",
  "amazon.ca",
  "amazon.com.au",
  "amazon.com.br",
  "amazon.com.mx",
  "amazon.in",
  "amazon.nl",
  "amazon.sg",
  "amazon.se",
  "amazon.pl",
  "amazon.com.be",
  "amazon.com.tr",
  "amazon.sa",
  "amazon.ae",
  "amazon.eg",
  "www.amazon.com",
  "www.amazon.co.jp",
  "www.amazon.co.uk",
  "www.amazon.de",
  "www.amazon.fr",
  "www.amazon.it",
  "www.amazon.es",
  "www.amazon.ca",
  "www.amazon.com.au",
  "www.amazon.com.br",
  "www.amazon.com.mx",
  "www.amazon.in",
  "www.amazon.nl",
  "www.amazon.sg",
  "www.amazon.se",
  "www.amazon.pl",
  "www.amazon.com.be",
  "www.amazon.com.tr",
  "www.amazon.sa",
  "www.amazon.ae",
  "www.amazon.eg"
])

/**
 * Validates that a string is a well-formed HTTPS URL.
 * Uses `new URL()` parsing to reject malformed URLs and restricts protocol to `https:`.
 * @source
 */
export const isValidHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Validates that a string is a well-formed HTTPS URL pointing to an Amazon domain.
 * Checks against a curated allow-list of Amazon hostnames.
 * @source
 */
export const isValidAmazonUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" && AMAZON_DOMAINS.has(url.hostname)
  } catch {
    return false
  }
}

/** Regex matching a valid ISO 4217 currency code (3 uppercase letters). @source */
export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/

/**
 * Type guard for valid ISO 4217 currency codes (3 uppercase letters, e.g. "USD").
 * @param value - The value to check.
 * @source
 */
export const isValidCurrencyCode = (value: unknown): value is string =>
  typeof value === "string" && CURRENCY_CODE_PATTERN.test(value)

/** Regex matching a valid username (3-20 alphanumeric or underscore characters). @source */
export const USERNAME_PATTERN = /^\w{3,20}$/

/**
 * Type guard for valid usernames.
 * @param value - The value to check.
 * @source
 */
export function isValidUsername(value: unknown): value is string {
  return typeof value === "string" && USERNAME_PATTERN.test(value)
}
/**
 * Validates profile update fields (username + avatarUrl).
 * Accepts `storage:`-prefixed paths and plain `userId/...` storage paths, or
 * a well-formed HTTPS URL. Returns an error message string or `null`.
 */
export function validateProfileFields(
  fields: { username?: string | null; avatarUrl?: string | null },
  userId: string
): string | null {
  if (
    fields.username !== undefined &&
    fields.username !== null &&
    !isValidUsername(fields.username)
  ) {
    return "Invalid username format"
  }

  if (
    fields.avatarUrl !== undefined &&
    fields.avatarUrl !== null &&
    fields.avatarUrl !== ""
  ) {
    const trimmed = fields.avatarUrl.trim()
    const isPlainUserPath =
      trimmed.startsWith(userId + "/") && !trimmed.includes("://")
    // Enforce ownership: extracted storage path must start with the caller's userId prefix
    const extractedPath = extractStoragePath(trimmed)
    const isStoragePrefixed =
      extractedPath !== null &&
      extractedPath.startsWith(userId + "/") &&
      !trimmed.includes("://")
    const isStoragePath = isPlainUserPath || isStoragePrefixed

    if (!isStoragePath && !isValidHttpsUrl(trimmed)) {
      return "avatarUrl must be a valid HTTPS URL"
    }
  }

  return null
}
/** Regex matching a canonical UUID v1–v5 (case-insensitive). @source */
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Type guard for valid UUIDs.
 * @param value - The value to check.
 * @source
 */
export const isValidUUID = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value)
