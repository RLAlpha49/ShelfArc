import type {
  TitleType,
  OwnershipStatus,
  ReadingStatus,
  BookOrientation
} from "@/lib/types/database"

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

/** Regex matching a valid hex color string (3–8 hex digits with leading `#`). @source */
export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/

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
 * Type guard for valid `BookOrientation` values.
 * @param value - The value to check.
 * @source
 */
export const isValidBookOrientation = (
  value: unknown
): value is BookOrientation =>
  typeof value === "string" &&
  (BOOK_ORIENTATIONS as readonly string[]).includes(value)

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
