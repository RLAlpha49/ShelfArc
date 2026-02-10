import type {
  TitleType,
  OwnershipStatus,
  ReadingStatus,
  BookOrientation
} from "@/lib/types/database"

export const TITLE_TYPES: readonly TitleType[] = [
  "light_novel",
  "manga",
  "other"
] as const

export const OWNERSHIP_STATUSES: readonly OwnershipStatus[] = [
  "owned",
  "wishlist"
] as const

export const READING_STATUSES: readonly ReadingStatus[] = [
  "unread",
  "reading",
  "completed",
  "on_hold",
  "dropped"
] as const

export const BOOK_ORIENTATIONS: readonly BookOrientation[] = [
  "vertical",
  "horizontal"
] as const

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/

export const isValidTitleType = (value: unknown): value is TitleType =>
  typeof value === "string" &&
  (TITLE_TYPES as readonly string[]).includes(value)

export const isValidOwnershipStatus = (
  value: unknown
): value is OwnershipStatus =>
  typeof value === "string" &&
  (OWNERSHIP_STATUSES as readonly string[]).includes(value)

export const isValidReadingStatus = (value: unknown): value is ReadingStatus =>
  typeof value === "string" &&
  (READING_STATUSES as readonly string[]).includes(value)

export const isValidBookOrientation = (
  value: unknown
): value is BookOrientation =>
  typeof value === "string" &&
  (BOOK_ORIENTATIONS as readonly string[]).includes(value)

export const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0

export const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0

export const isNonNegativeFinite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0

export const isValidUrl = (value: unknown): value is string =>
  typeof value === "string" &&
  (value.startsWith("https://") || value.startsWith("http://"))
