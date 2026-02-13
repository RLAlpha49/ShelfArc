import {
  sanitizeOptionalHtml,
  sanitizeOptionalPlainText,
  sanitizePlainText
} from "@/lib/sanitize-html"
import {
  isNonNegativeFinite,
  isNonNegativeInteger,
  isPositiveInteger,
  isValidOwnershipStatus,
  isValidReadingStatus,
  isValidTitleType
} from "@/lib/validation"
import type { Series, Volume, VolumeInsert } from "@/lib/types/database"

/** Volume date fields eligible for normalization. @source */
type VolumeDateFields = {
  publish_date?: string | null
  purchase_date?: string | null
}

/**
 * Normalizes a partial date string into ISO `YYYY-MM-DD` format.
 * @param value - A date string (year, year-month, or full date).
 * @returns A normalized date string, or `null`.
 * @source
 */
const normalizeDateInput = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01-01`
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`
  return trimmed
}

/** Sanitizes a date-field string, capping length at 20 characters. @source */
const sanitizeDateField = (value?: string | null): string | null => {
  if (!value) return null
  const sanitized = sanitizePlainText(String(value), 20)
  return sanitized || null
}

/**
 * Normalizes publish and purchase date fields on a volume data object.
 * @param data - The volume data with optional date fields.
 * @returns A copy with normalized dates.
 * @source
 */
export const normalizeVolumeDates = <T extends VolumeDateFields>(data: T) => {
  const next = { ...data }
  if (data.publish_date === undefined) {
    // no-op
  } else {
    next.publish_date = normalizeDateInput(sanitizeDateField(data.publish_date))
  }
  if (data.purchase_date === undefined) {
    // no-op
  } else {
    next.purchase_date = normalizeDateInput(
      sanitizeDateField(data.purchase_date)
    )
  }
  return next
}

/** Type guard for valid volume ratings (0–10). @source */
const isValidRating = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 10

/** Coerces a nullable value through a validator, returning `null` on failure. @source */
const coerceNullable = <T>(
  value: T | null | undefined,
  validator: (v: T) => boolean
): T | null => (value != null && validator(value) ? value : null)

/**
 * Sanitizes text fields on a partial series update object.
 * @param data - The raw update data.
 * @param sanitized - The output object to populate.
 * @throws If the title is present but empty after sanitization.
 * @source
 */
const sanitizeSeriesTextFields = (
  data: Partial<Series>,
  sanitized: Partial<Series>
): void => {
  if (Object.hasOwn(data, "title") && data.title != null) {
    const cleaned = sanitizePlainText(data.title, 500)
    if (!cleaned) throw new Error("Series title cannot be empty")
    sanitized.title = cleaned
  }
  if (Object.hasOwn(data, "original_title")) {
    sanitized.original_title = sanitizeOptionalPlainText(
      data.original_title,
      500
    )
  }
  if (Object.hasOwn(data, "description")) {
    sanitized.description = sanitizeOptionalHtml(data.description)
  }
  if (Object.hasOwn(data, "author")) {
    sanitized.author = sanitizeOptionalPlainText(data.author, 1000)
  }
  if (Object.hasOwn(data, "artist")) {
    sanitized.artist = sanitizeOptionalPlainText(data.artist, 1000)
  }
  if (Object.hasOwn(data, "publisher")) {
    sanitized.publisher = sanitizeOptionalPlainText(data.publisher, 1000)
  }
  if (Object.hasOwn(data, "notes")) {
    sanitized.notes = sanitizeOptionalPlainText(data.notes, 5000)
  }
  if (Object.hasOwn(data, "cover_image_url")) {
    sanitized.cover_image_url = sanitizeOptionalPlainText(
      data.cover_image_url,
      2000
    )
  }
  if (Object.hasOwn(data, "status")) {
    sanitized.status = sanitizeOptionalPlainText(data.status, 100)
  }
}

/**
 * Sanitizes all fields on a partial series update, including type and tags.
 * @param data - The raw series update data.
 * @returns A sanitized copy.
 * @source
 */
export const sanitizeSeriesUpdate = (
  data: Partial<Series>
): Partial<Series> => {
  const sanitized = { ...data }
  sanitizeSeriesTextFields(data, sanitized)
  if (Object.hasOwn(data, "type")) {
    sanitized.type = isValidTitleType(data.type) ? data.type : "other"
  }
  if (Object.hasOwn(data, "tags") && Array.isArray(data.tags)) {
    sanitized.tags = data.tags
      .map((tag) => sanitizePlainText(String(tag), 100))
      .filter(Boolean)
  }
  if (Object.hasOwn(data, "total_volumes")) {
    sanitized.total_volumes =
      data.total_volumes != null && isPositiveInteger(data.total_volumes)
        ? data.total_volumes
        : null
  }
  return sanitized
}

/**
 * Sanitizes text fields on a partial volume update object.
 * @param data - The raw update data.
 * @param sanitized - The output object to populate.
 * @source
 */
const sanitizeVolumeTextFields = (
  data: Partial<Volume>,
  sanitized: Partial<Volume>
): void => {
  if (Object.hasOwn(data, "description")) {
    sanitized.description = sanitizeOptionalHtml(data.description)
  }
  if (Object.hasOwn(data, "title")) {
    sanitized.title = sanitizeOptionalPlainText(data.title, 500)
  }
  if (Object.hasOwn(data, "isbn")) {
    sanitized.isbn = sanitizeOptionalPlainText(data.isbn, 20)
  }
  if (Object.hasOwn(data, "notes")) {
    sanitized.notes = sanitizeOptionalPlainText(data.notes, 5000)
  }
  if (Object.hasOwn(data, "edition")) {
    sanitized.edition = sanitizeOptionalPlainText(data.edition, 200)
  }
  if (Object.hasOwn(data, "format")) {
    sanitized.format = sanitizeOptionalPlainText(data.format, 200)
  }
  if (Object.hasOwn(data, "cover_image_url")) {
    sanitized.cover_image_url = sanitizeOptionalPlainText(
      data.cover_image_url,
      2000
    )
  }
  if (Object.hasOwn(data, "amazon_url")) {
    sanitized.amazon_url = sanitizeOptionalPlainText(data.amazon_url, 2000)
  }
}

/**
 * Sanitizes numeric fields on a partial volume update object.
 * @param data - The raw update data.
 * @param sanitized - The output object to populate.
 * @source
 */
const sanitizeVolumeNumericFields = (
  data: Partial<Volume>,
  sanitized: Partial<Volume>
): void => {
  if (Object.hasOwn(data, "page_count")) {
    sanitized.page_count = coerceNullable(data.page_count, isPositiveInteger)
  }
  if (Object.hasOwn(data, "rating")) {
    sanitized.rating = coerceNullable(data.rating, isValidRating)
  }
  if (Object.hasOwn(data, "current_page")) {
    sanitized.current_page = coerceNullable(
      data.current_page,
      isNonNegativeInteger
    )
  }
  if (Object.hasOwn(data, "purchase_price")) {
    sanitized.purchase_price = coerceNullable(
      data.purchase_price,
      isNonNegativeFinite
    )
  }
}

/**
 * Sanitizes all fields on a partial volume update.
 * @param data - The raw volume update data.
 * @returns A sanitized copy.
 * @throws If the volume number is invalid.
 * @source
 */
export const sanitizeVolumeUpdate = (
  data: Partial<Volume>
): Partial<Volume> => {
  const sanitized = { ...data }
  sanitizeVolumeTextFields(data, sanitized)
  if (Object.hasOwn(data, "ownership_status")) {
    sanitized.ownership_status = isValidOwnershipStatus(data.ownership_status)
      ? data.ownership_status
      : "owned"
  }
  if (Object.hasOwn(data, "reading_status")) {
    sanitized.reading_status = isValidReadingStatus(data.reading_status)
      ? data.reading_status
      : "unread"
  }
  if (Object.hasOwn(data, "volume_number")) {
    if (
      typeof data.volume_number !== "number" ||
      !Number.isFinite(data.volume_number) ||
      data.volume_number < 0
    ) {
      throw new Error("Invalid volume number")
    }
  }
  sanitizeVolumeNumericFields(data, sanitized)
  return sanitized
}

/**
 * Builds a fully sanitized volume insert payload.
 * @param data - The raw volume insert data (without `user_id`/`series_id`).
 * @returns A sanitized copy.
 * @throws If the volume number is invalid.
 * @source
 */
export const buildSanitizedVolumeInsert = (
  data: Omit<VolumeInsert, "user_id" | "series_id">
): Omit<VolumeInsert, "user_id" | "series_id"> => {
  if (
    typeof data.volume_number !== "number" ||
    !Number.isFinite(data.volume_number) ||
    data.volume_number < 0
  ) {
    throw new Error("Invalid volume number")
  }
  return {
    ...data,
    description: sanitizeOptionalHtml(data.description),
    title: sanitizeOptionalPlainText(data.title, 500),
    isbn: sanitizeOptionalPlainText(data.isbn, 20),
    notes: sanitizeOptionalPlainText(data.notes, 5000),
    edition: sanitizeOptionalPlainText(data.edition, 200),
    format: sanitizeOptionalPlainText(data.format, 200),
    ownership_status: isValidOwnershipStatus(data.ownership_status)
      ? data.ownership_status
      : "owned",
    reading_status: isValidReadingStatus(data.reading_status)
      ? data.reading_status
      : "unread",
    page_count:
      data.page_count != null && isPositiveInteger(data.page_count)
        ? data.page_count
        : null,
    rating:
      data.rating != null && isValidRating(data.rating) ? data.rating : null,
    current_page:
      data.current_page != null && isNonNegativeInteger(data.current_page)
        ? data.current_page
        : null,
    purchase_price:
      data.purchase_price != null && isNonNegativeFinite(data.purchase_price)
        ? data.purchase_price
        : null,
    cover_image_url: sanitizeOptionalPlainText(data.cover_image_url, 2000),
    amazon_url: sanitizeOptionalPlainText(data.amazon_url, 2000)
  }
}
