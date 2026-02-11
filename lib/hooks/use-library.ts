"use client"

import { useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useLibraryStore } from "@/lib/store/library-store"
import {
  sanitizeOptionalHtml,
  sanitizeOptionalPlainText,
  sanitizePlainText
} from "@/lib/sanitize-html"
import {
  isValidTitleType,
  isValidOwnershipStatus,
  isValidReadingStatus,
  isPositiveInteger,
  isNonNegativeInteger,
  isNonNegativeFinite
} from "@/lib/validation"
import type { BookSearchResult } from "@/lib/books/search"
import type {
  Series,
  SeriesWithVolumes,
  SeriesInsert,
  TitleType,
  Volume,
  VolumeInsert,
  OwnershipStatus
} from "@/lib/types/database"

/** Volume date fields eligible for normalization. @source */
type VolumeDateFields = {
  publish_date?: string | null
  purchase_date?: string | null
}

/** Regex matching volume indicator tokens like "Vol. 3" or "Book 12". @source */
const VOLUME_TOKEN_PATTERN =
  /\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*(\d+(?:\.\d+)?)\b/i
/** Global variant of `VOLUME_TOKEN_PATTERN` for stripping. @source */
const VOLUME_TOKEN_GLOBAL =
  /\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*\d+(?:\.\d+)?\b/gi
/** English number words (zero through twenty) for volume number parsing. @source */
const VOLUME_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty"
]
/** Maps English number words to their numeric values. @source */
const VOLUME_WORD_VALUE: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20
}
/** Regex matching volume indicators with English number words. @source */
const VOLUME_WORD_PATTERN = new RegExp(
  String.raw`\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*(${VOLUME_WORDS.join(
    "|"
  )})\b`,
  "i"
)
/** Global variant of `VOLUME_WORD_PATTERN` for stripping. @source */
const VOLUME_WORD_GLOBAL = new RegExp(
  String.raw`\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*(?:${VOLUME_WORDS.join(
    "|"
  )})\b`,
  "gi"
)
/** Matches a trailing number at the end of a title (e.g. "Title 3"). @source */
const TRAILING_VOLUME_PATTERN = /(?:\s+|[-–—:]\s*)(\d+(?:\.\d+)?)\s*$/i
/** Matches an inline volume number before a parenthetical or colon. @source */
const INLINE_VOLUME_PATTERN =
  /^(.*)(?:\s+|[-–—:,]\s*)(\d+(?:\.\d+)?)\s*(?=[(:])/i
/** Matches trailing bracketed/parenthesized descriptors. @source */
const TRAILING_BRACKET_PATTERN = /\s*[[(]([^)\]]*?)[)\]]\s*$/
/** Matches edition/collection descriptors like "omnibus" or "deluxe". @source */
const EXTRA_DESCRIPTOR_PATTERN =
  /\b(omnibus|collector'?s|special|edition|deluxe|complete|box\s*set|boxset)\b/gi
/** Matches trailing punctuation for cleanup. @source */
const TRAILING_PUNCTUATION_PATTERN = /\s*[-–—:,;]\s*$/g
/** Format suffixes to strip from series titles (e.g. "light novel", "manga"). @source */
const FORMAT_SUFFIXES = [
  "light novel",
  "light novels",
  "graphic novel",
  "graphic novels",
  "comic book",
  "comic books",
  "comics",
  "comic",
  "manga",
  "manhwa",
  "manhua",
  "webtoon",
  "web comic",
  "webcomic",
  "novels",
  "novel"
]
/** Set of series descriptor terms recognized for bracket stripping. @source */
const SERIES_DESCRIPTOR_SET = new Set([
  "comic",
  "comic book",
  "graphic novel",
  "manga",
  "manhwa",
  "manhua",
  "light novel",
  "novel",
  "webtoon",
  "web comic",
  "webcomic",
  "gn"
])

/** Parsed trailing/inline volume suffix info. @source */
type VolumeSuffixInfo = {
  number: number
  prefix: string
  wordCount: number
}

/** Upper bound for plausible volume numbers. @source */
const MAX_VOLUME_NUMBER = 200

/** Checks whether a number looks like a publication year (1900–2100). @source */
const isLikelyYear = (value: number) => value >= 1900 && value <= 2100

/**
 * Parses an English number word to its numeric value.
 * @param value - The word to parse.
 * @returns The numeric value, or `null` if unrecognized.
 * @source
 */
const parseVolumeWord = (value: string) => {
  return VOLUME_WORD_VALUE[value.toLowerCase()] ?? null
}

/**
 * Extracts trailing volume info from a title string (e.g. "My Series 4").
 * @param title - The title to parse.
 * @returns Parsed suffix info, or `null` if no trailing number found.
 * @source
 */
const getTrailingVolumeInfo = (title: string): VolumeSuffixInfo | null => {
  const match = new RegExp(TRAILING_VOLUME_PATTERN).exec(title)
  if (!match) return null
  const number = Number.parseFloat(match[1])
  if (!Number.isFinite(number)) return null
  const prefix = title.slice(0, title.length - match[0].length).trim()
  if (!prefix) return null
  if (!/[A-Za-z]/.test(prefix)) return null
  const wordCount = prefix.split(/\s+/).filter(Boolean).length
  return { number, prefix, wordCount }
}

/**
 * Extracts inline volume info from a title (number before parenthetical/colon).
 * @param title - The title to parse.
 * @returns Parsed suffix info, or `null` if none found.
 * @source
 */
const getInlineVolumeInfo = (title: string): VolumeSuffixInfo | null => {
  const match = INLINE_VOLUME_PATTERN.exec(title)
  if (!match) return null
  const number = Number.parseFloat(match[2])
  if (!Number.isFinite(number)) return null
  const prefix = match[1].trim()
  if (!prefix) return null
  if (!/[A-Za-z]/.test(prefix)) return null
  const wordCount = prefix.split(/\s+/).filter(Boolean).length
  return { number, prefix, wordCount }
}

/** Decides whether to strip a trailing number for display title derivation. @source */
const shouldStripTrailingForTitle = (info: VolumeSuffixInfo) => {
  if (isLikelyYear(info.number)) return false
  if (info.number <= 3) return info.wordCount >= 2
  return info.number <= MAX_VOLUME_NUMBER && info.wordCount >= 2
}

/** Decides whether to strip a trailing number for series-key derivation. @source */
const shouldStripTrailingForKey = (info: VolumeSuffixInfo) => {
  if (isLikelyYear(info.number)) return false
  return info.number <= MAX_VOLUME_NUMBER && info.wordCount >= 2
}

/** Strips an inline volume suffix from a title for display purposes. @source */
const stripInlineVolumeSuffixForTitle = (title: string) => {
  const info = getInlineVolumeInfo(title)
  if (info && shouldStripTrailingForTitle(info)) return info.prefix
  return title
}

/** Strips an inline volume suffix from a title for key derivation. @source */
const stripInlineVolumeSuffixForKey = (title: string) => {
  const info = getInlineVolumeInfo(title)
  if (info && shouldStripTrailingForKey(info)) return info.prefix
  return title
}

/** Strips a trailing volume number from a title for display purposes. @source */
const stripTrailingVolumeSuffixForTitle = (title: string) => {
  const info = getTrailingVolumeInfo(title)
  if (info && shouldStripTrailingForTitle(info)) return info.prefix
  return title
}

/** Strips a trailing volume number from a title for key derivation. @source */
const stripTrailingVolumeSuffixForKey = (title: string) => {
  const info = getTrailingVolumeInfo(title)
  if (info && shouldStripTrailingForKey(info)) return info.prefix
  return title
}

/** Removes trailing format suffixes like "light novel" or "manga" from a title. @source */
const stripTrailingFormatSuffix = (title: string) => {
  let next = title
  while (true) {
    const trimmed = next.trim().replaceAll(TRAILING_PUNCTUATION_PATTERN, "")
    const normalized = normalizeDescriptor(trimmed)
    let updated = trimmed

    for (const suffix of FORMAT_SUFFIXES) {
      if (!normalized.endsWith(suffix)) continue
      const suffixPattern = suffix.replaceAll(/\s+/g, String.raw`\s+`)
      const pattern = new RegExp(String.raw`\s*${suffixPattern}\s*$`, "gi")
      updated = trimmed.replaceAll(pattern, "").trim()
      break
    }

    if (updated === trimmed) return trimmed
    next = updated
  }
}

/** Lowercases and normalizes whitespace in a descriptor string. @source */
const normalizeDescriptor = (value: string) => {
  return value.trim().toLowerCase().replaceAll(/\s+/g, " ")
}

/** Checks if a bracketed descriptor should be stripped (format/volume info). @source */
const shouldStripBracketDescriptor = (descriptor: string) => {
  const normalized = normalizeDescriptor(descriptor)
  if (!normalized) return false
  if (SERIES_DESCRIPTOR_SET.has(normalized)) return true
  if (FORMAT_SUFFIXES.some((suffix) => normalized.includes(suffix))) return true
  if (VOLUME_TOKEN_PATTERN.test(normalized)) return true
  if (VOLUME_WORD_PATTERN.test(normalized)) return true
  if (/\b#\s*\d+(?:\s*-\s*\d+)?\b/.test(normalized)) return true
  if (/^\d+(?:\s*-\s*\d+)?$/.test(normalized)) return true
  return false
}

/** Removes trailing bracketed series descriptors from a title. @source */
const stripTrailingSeriesDescriptor = (title: string) => {
  let next = title
  while (true) {
    const trimmed = next.trim()
    const match = TRAILING_BRACKET_PATTERN.exec(trimmed)
    if (!match) return trimmed
    if (!shouldStripBracketDescriptor(match[1])) return trimmed
    next = trimmed.slice(0, trimmed.length - match[0].length)
  }
}

/** Checks if a string contains any recognizable volume indicator. @source */
const hasVolumeIndicator = (value: string) => {
  if (VOLUME_TOKEN_PATTERN.test(value)) return true
  if (VOLUME_WORD_PATTERN.test(value)) return true
  if (/\b#\s*\d+\b/.test(value)) return true
  const inlineInfo = getInlineVolumeInfo(value)
  if (inlineInfo && shouldStripTrailingForKey(inlineInfo)) return true
  const trailingInfo = getTrailingVolumeInfo(value)
  if (trailingInfo && shouldStripTrailingForKey(trailingInfo)) return true
  return false
}

/** Strips subtitle text after a volume indicator delimited by a colon or dash. @source */
const stripSubtitleAfterVolumeIndicator = (title: string) => {
  const delimiterMatch = /[:–—-]\s/.exec(title)
  if (!delimiterMatch) return title
  const head = title.slice(0, delimiterMatch.index).trim()
  if (!head || !hasVolumeIndicator(head)) return title
  return head
}

/** Extracts a trailing volume number from a title for display. @source */
const extractTrailingVolumeNumber = (title: string) => {
  const info = getTrailingVolumeInfo(title)
  if (info && shouldStripTrailingForTitle(info)) return info.number
  return null
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
const normalizeVolumeDates = <T extends VolumeDateFields>(data: T) => {
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

/** A volume paired with its parent series, used for flat volume views. @source */
export interface VolumeWithSeries {
  volume: Volume
  series: SeriesWithVolumes
}

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
const sanitizeSeriesUpdate = (data: Partial<Series>): Partial<Series> => {
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

/** Type guard for valid volume ratings (0–10). @source */
const isValidRating = (value: unknown): value is number =>
  typeof value === "number" && value >= 0 && value <= 10

/** Coerces a nullable value through a validator, returning `null` on failure. @source */
const coerceNullable = <T>(
  value: T | null | undefined,
  validator: (v: T) => boolean
): T | null => (value != null && validator(value) ? value : null)

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
const sanitizeVolumeUpdate = (data: Partial<Volume>): Partial<Volume> => {
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
const buildSanitizedVolumeInsert = (
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

/**
 * React hook providing CRUD operations, filtering, sorting, and book-import logic for the library.
 * @returns Library state, filtered views, and mutation functions.
 * @source
 */
export function useLibrary() {
  const supabase = createClient()
  const {
    series,
    setSeries,
    unassignedVolumes,
    setUnassignedVolumes,
    addSeries,
    updateSeries,
    deleteSeries,
    addVolume,
    updateVolume,
    deleteVolume,
    addUnassignedVolume,
    updateUnassignedVolume,
    deleteUnassignedVolume,
    setIsLoading,
    isLoading,
    filters,
    sortField,
    sortOrder,
    deleteSeriesVolumes
  } = useLibraryStore()

  const fetchGoogleVolumeDetails = useCallback(async (volumeId: string) => {
    const response = await fetch(
      `/api/books/volume/${encodeURIComponent(volumeId)}`
    )
    const data = (await response.json()) as {
      result?: BookSearchResult
      error?: string
    }

    if (!response.ok) {
      throw new Error(data.error ?? "Google Books volume lookup failed")
    }

    if (!data.result) {
      throw new Error("Google Books volume lookup failed")
    }

    return data.result
  }, [])

  const resolveSearchResultDetails = useCallback(
    async (result: BookSearchResult) => {
      if (result.source !== "google_books") return result
      const volumeId = result.id?.trim() ?? ""
      if (!volumeId || volumeId.startsWith("google-")) {
        return result
      }

      try {
        return await fetchGoogleVolumeDetails(volumeId)
      } catch (error) {
        console.warn("Google Books volume lookup failed", error)
        return result
      }
    },
    [fetchGoogleVolumeDetails]
  )

  const normalizeText = useCallback((value?: string | null) => {
    return (value ?? "")
      .normalize("NFKD")
      .replaceAll(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replaceAll(/\s+/g, " ")
  }, [])

  const normalizeAuthorKey = useCallback(
    (value?: string | null) => {
      const base = normalizeText(value ?? "")
      return base.replaceAll(/[^\p{L}\p{N}]+/gu, "")
    },
    [normalizeText]
  )

  const normalizeSeriesTitle = useCallback(
    (value: string) => {
      const withoutSubtitle = stripSubtitleAfterVolumeIndicator(value)
      const withoutVolumeTokens = withoutSubtitle
        .replaceAll(VOLUME_TOKEN_GLOBAL, " ")
        .replaceAll(VOLUME_WORD_GLOBAL, " ")
      const withoutInline = stripInlineVolumeSuffixForKey(withoutVolumeTokens)
      const withoutTrailing = stripTrailingVolumeSuffixForKey(withoutInline)
      const base = normalizeText(stripTrailingFormatSuffix(withoutTrailing))
      return base
        .replaceAll(/\(.*?\)/g, " ")
        .replaceAll(VOLUME_TOKEN_GLOBAL, " ")
        .replaceAll(VOLUME_WORD_GLOBAL, " ")
        .replaceAll(EXTRA_DESCRIPTOR_PATTERN, " ")
        .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
        .replaceAll(/\s+/g, " ")
        .trim()
    },
    [normalizeText]
  )

  const extractVolumeNumber = useCallback((title?: string | null) => {
    if (!title) return null
    const match = new RegExp(VOLUME_TOKEN_PATTERN).exec(title)
    if (match) {
      const parsed = Number.parseFloat(match[1])
      return Number.isFinite(parsed) ? parsed : null
    }
    const wordMatch = new RegExp(VOLUME_WORD_PATTERN).exec(title)
    if (wordMatch) {
      const parsed = parseVolumeWord(wordMatch[1])
      if (parsed !== null) return parsed
    }
    const inlineInfo = getInlineVolumeInfo(title)
    if (inlineInfo && shouldStripTrailingForTitle(inlineInfo)) {
      return inlineInfo.number
    }
    return extractTrailingVolumeNumber(title)
  }, [])

  const stripVolumeFromTitle = useCallback((title: string) => {
    const withoutSubtitle = stripSubtitleAfterVolumeIndicator(title)
    const withoutVolumeTokens = withoutSubtitle
      .replaceAll(VOLUME_TOKEN_GLOBAL, " ")
      .replaceAll(VOLUME_WORD_GLOBAL, " ")
    const withoutInline = stripInlineVolumeSuffixForTitle(withoutVolumeTokens)
    const withoutTrailing = stripTrailingVolumeSuffixForTitle(withoutInline)
    const withoutDescriptor = stripTrailingSeriesDescriptor(withoutTrailing)
    const withoutExtras = withoutDescriptor.replaceAll(
      EXTRA_DESCRIPTOR_PATTERN,
      " "
    )
    const withoutPunctuation = withoutExtras.replaceAll(
      TRAILING_PUNCTUATION_PATTERN,
      ""
    )
    const withoutFormatSuffix = stripTrailingFormatSuffix(withoutPunctuation)
    const trimmed = withoutFormatSuffix.replaceAll(/\s+/g, " ").trim()
    return trimmed || title.trim()
  }, [])

  const deriveSeriesTitle = useCallback(
    (result: BookSearchResult) => {
      const base = (result.seriesTitle ?? result.title ?? "").trim()
      if (!base) return result.title
      return stripVolumeFromTitle(base)
    },
    [stripVolumeFromTitle]
  )

  const buildSeriesKey = useCallback(
    (title: string, author?: string | null) => {
      const normalizedTitle = normalizeSeriesTitle(title)
      const normalizedAuthor = normalizeAuthorKey(author)
      return `${normalizedTitle}|${normalizedAuthor}`
    },
    [normalizeAuthorKey, normalizeSeriesTitle]
  )

  const pickSeriesByVolumeCount = useCallback(
    (candidates: SeriesWithVolumes[]) => {
      return candidates.reduce((best, current) => {
        if (current.volumes.length > best.volumes.length) return current
        return best
      }, candidates[0])
    },
    []
  )

  const collectSeriesMatches = useCallback(
    (title: string, author?: string | null) => {
      const normalizedTitle = normalizeSeriesTitle(title)
      const normalizedAuthor = normalizeAuthorKey(author)
      const hasAuthor = normalizedAuthor.length > 0
      const matches: SeriesWithVolumes[] = []

      const seriesSnapshot = useLibraryStore.getState().series

      for (const item of seriesSnapshot) {
        if (normalizeSeriesTitle(item.title) !== normalizedTitle) continue
        const itemAuthor = normalizeAuthorKey(item.author)
        if (hasAuthor && itemAuthor && itemAuthor !== normalizedAuthor) continue
        matches.push(item)
      }

      return matches
    },
    [normalizeAuthorKey, normalizeSeriesTitle]
  )

  const pickSeriesByType = useCallback(
    (matches: SeriesWithVolumes[], typeHint?: TitleType | null) => {
      if (matches.length === 0) return undefined
      if (!typeHint) return pickSeriesByVolumeCount(matches)

      const typeMatches = matches.filter((item) => item.type === typeHint)
      if (typeMatches.length > 0) return pickSeriesByVolumeCount(typeMatches)

      const otherMatches = matches.filter((item) => item.type === "other")
      if (otherMatches.length > 0) return pickSeriesByVolumeCount(otherMatches)

      return pickSeriesByVolumeCount(matches)
    },
    [pickSeriesByVolumeCount]
  )

  const findMatchingSeries = useCallback(
    (title: string, author?: string | null, typeHint?: TitleType | null) => {
      const matches = collectSeriesMatches(title, author)
      if (matches.length === 0) return undefined
      if (typeHint) {
        const typeMatches = matches.filter((item) => item.type === typeHint)
        if (typeMatches.length === 0) return undefined
        return pickSeriesByVolumeCount(typeMatches)
      }
      if (matches.length === 1) return matches[0]
      return pickSeriesByType(matches, typeHint)
    },
    [collectSeriesMatches, pickSeriesByType, pickSeriesByVolumeCount]
  )

  const normalizeSeriesTypeHint = useCallback(
    (value?: string | null) => {
      return normalizeText(value ?? "")
        .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
        .replaceAll(/\s+/g, " ")
        .trim()
    },
    [normalizeText]
  )

  const detectSeriesTypeFromText = useCallback(
    (value?: string | null): TitleType | null => {
      const normalized = normalizeSeriesTypeHint(value)
      if (!normalized) return null

      const hasMangaHint =
        normalized.includes("manga") ||
        normalized.includes("manhwa") ||
        normalized.includes("manhua") ||
        normalized.includes("webtoon") ||
        normalized.includes("web comic") ||
        normalized.includes("webcomic") ||
        normalized.includes("graphic novel") ||
        normalized.includes("comic book") ||
        normalized.includes("comic")

      if (hasMangaHint) return "manga"
      if (normalized.includes("light novel") || normalized.includes("novel")) {
        return "light_novel"
      }

      return null
    },
    [normalizeSeriesTypeHint]
  )

  const deriveSeriesType = useCallback(
    (result: BookSearchResult): TitleType | null => {
      const fromTitle = detectSeriesTypeFromText(result.title)
      const fromSeries = detectSeriesTypeFromText(result.seriesTitle)
      if (fromTitle && fromSeries && fromTitle !== fromSeries) {
        return fromTitle
      }
      return fromTitle ?? fromSeries
    },
    [detectSeriesTypeFromText]
  )

  const getNextVolumeNumber = useCallback(
    (targetSeries?: SeriesWithVolumes) => {
      if (!targetSeries) return 1
      const maxVolume = targetSeries.volumes.reduce(
        (max, volume) => Math.max(max, volume.volume_number),
        0
      )
      return maxVolume + 1
    },
    []
  )

  const bumpNextVolumeNumberForSeries = useCallback(
    (
      nextVolumeBySeries: Map<string, number>,
      seriesId: string,
      usedNumber: number
    ) => {
      const current = nextVolumeBySeries.get(seriesId)
      const next = Math.max(current ?? usedNumber + 1, usedNumber + 1)
      nextVolumeBySeries.set(seriesId, next)
    },
    []
  )

  // Fetch all series with volumes
  const fetchSeries = useCallback(async () => {
    setIsLoading(true)
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data: seriesData, error: seriesError } = await supabase
        .from("series")
        .select("*")
        .eq("user_id", user.id)
        .order(sortField, { ascending: sortOrder === "asc" })

      if (seriesError) throw seriesError

      // Fetch volumes for all series
      const { data: volumesData, error: volumesError } = await supabase
        .from("volumes")
        .select("*")
        .eq("user_id", user.id)
        .order("volume_number", { ascending: true })

      if (volumesError) throw volumesError

      const allVolumes = (volumesData || []) as Volume[]
      const assignedVolumes = allVolumes.filter((v) => v.series_id)
      const unassigned = allVolumes.filter((v) => !v.series_id)

      // Combine series with their volumes
      const seriesWithVolumes: SeriesWithVolumes[] = (
        (seriesData || []) as Series[]
      ).map((s) => ({
        ...s,
        volumes: assignedVolumes.filter((v) => v.series_id === s.id)
      }))

      setSeries(seriesWithVolumes)
      setUnassignedVolumes(unassigned)
    } catch (error) {
      console.error("Error fetching series:", error)
    } finally {
      setIsLoading(false)
    }
  }, [
    supabase,
    setSeries,
    setUnassignedVolumes,
    setIsLoading,
    sortField,
    sortOrder
  ])

  // Create new series
  const createSeries = useCallback(
    async (data: Omit<SeriesInsert, "user_id">) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const sanitizedTitle = sanitizePlainText(data.title, 500)
        if (!sanitizedTitle) throw new Error("Series title is required")

        const sanitizedData: Omit<SeriesInsert, "user_id"> = {
          ...data,
          title: sanitizedTitle,
          original_title: sanitizeOptionalPlainText(data.original_title, 500),
          description: sanitizeOptionalHtml(data.description),
          author: sanitizeOptionalPlainText(data.author, 1000),
          artist: sanitizeOptionalPlainText(data.artist, 1000),
          publisher: sanitizeOptionalPlainText(data.publisher, 1000),
          notes: sanitizeOptionalPlainText(data.notes, 5000),
          type: isValidTitleType(data.type) ? data.type : "other",
          tags: Array.isArray(data.tags)
            ? data.tags
                .map((tag) => sanitizePlainText(String(tag), 100))
                .filter(Boolean)
            : [],
          total_volumes:
            data.total_volumes != null && isPositiveInteger(data.total_volumes)
              ? data.total_volumes
              : null,
          cover_image_url: sanitizeOptionalPlainText(
            data.cover_image_url,
            2000
          ),
          status: sanitizeOptionalPlainText(data.status, 100)
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newSeries, error } = await (supabase as any)
          .from("series")
          .insert({ ...sanitizedData, user_id: user.id })
          .select()
          .single()

        if (error) throw error

        const seriesWithVolumes: SeriesWithVolumes = {
          ...(newSeries as Series),
          volumes: []
        }
        addSeries(seriesWithVolumes)
        return seriesWithVolumes
      } catch (error) {
        console.error("Error creating series:", error)
        throw error
      }
    },
    [supabase, addSeries]
  )

  // Update existing series
  const editSeries = useCallback(
    async (id: string, data: Partial<Series>) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const sanitizedData = sanitizeSeriesUpdate(data)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("series")
          .update(sanitizedData)
          .eq("id", id)
          .eq("user_id", user.id)

        if (error) throw error

        updateSeries(id, sanitizedData)
      } catch (error) {
        console.error("Error updating series:", error)
        throw error
      }
    },
    [supabase, updateSeries]
  )

  const autoFillSeriesFromVolume = useCallback(
    async (
      targetSeries: SeriesWithVolumes,
      volumeNumber: number,
      resolvedResult: BookSearchResult
    ) => {
      if (volumeNumber !== 1) return

      const updates: Partial<Series> = {}
      const nextDescription = resolvedResult.description?.trim() ?? ""

      if (!targetSeries.description?.trim() && nextDescription) {
        updates.description = resolvedResult.description
      }

      if (Object.keys(updates).length > 0) {
        await editSeries(targetSeries.id, updates)
      }
    },
    [editSeries]
  )

  const updateSeriesCoverFromVolume = useCallback(
    async (seriesId: string, volume: Volume) => {
      const nextCoverUrl = volume.cover_image_url?.trim() ?? ""
      if (!nextCoverUrl) return

      const seriesSnapshot = useLibraryStore.getState().series
      const targetSeries = seriesSnapshot.find((item) => item.id === seriesId)
      if (!targetSeries) return

      const lowestExistingVolume =
        targetSeries.volumes.length > 0
          ? targetSeries.volumes.reduce(
              (lowest, item) => Math.min(lowest, item.volume_number),
              Number.POSITIVE_INFINITY
            )
          : null

      const shouldUpdateCover =
        lowestExistingVolume === null ||
        volume.volume_number < lowestExistingVolume

      if (!shouldUpdateCover) return
      if (targetSeries.cover_image_url?.trim() === nextCoverUrl) return

      await editSeries(seriesId, { cover_image_url: nextCoverUrl })
    },
    [editSeries]
  )

  const updateSeriesAuthorIfMissing = useCallback(
    async (targetSeries: SeriesWithVolumes, author?: string | null) => {
      const nextAuthor = author?.trim()
      if (!nextAuthor) return targetSeries
      if (targetSeries.author?.trim()) return targetSeries

      try {
        await editSeries(targetSeries.id, { author: nextAuthor })
        return { ...targetSeries, author: nextAuthor }
      } catch (error) {
        console.warn("Error updating series author:", error)
        return targetSeries
      }
    },
    [editSeries]
  )

  const updateSeriesTypeIfMissing = useCallback(
    async (targetSeries: SeriesWithVolumes, typeHint?: TitleType | null) => {
      if (!typeHint) return targetSeries
      if (targetSeries.type !== "other") return targetSeries

      try {
        await editSeries(targetSeries.id, { type: typeHint })
        return { ...targetSeries, type: typeHint }
      } catch (error) {
        console.warn("Error updating series type:", error)
        return targetSeries
      }
    },
    [editSeries]
  )

  // Delete series
  const removeSeries = useCallback(
    async (id: string) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const targetSeries = series.find((item) => item.id === id)
        const volumesToUpdate = targetSeries?.volumes ?? []

        if (deleteSeriesVolumes) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: volumeError } = await (supabase as any)
            .from("volumes")
            .delete()
            .eq("series_id", id)
            .eq("user_id", user.id)

          if (volumeError) throw volumeError
        } else if (volumesToUpdate.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: volumeError } = await (supabase as any)
            .from("volumes")
            .update({ series_id: null })
            .eq("series_id", id)
            .eq("user_id", user.id)

          if (volumeError) throw volumeError
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: seriesError } = await (supabase as any)
          .from("series")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id)

        if (seriesError) throw seriesError

        if (!deleteSeriesVolumes && volumesToUpdate.length > 0) {
          const detachedVolumes = volumesToUpdate.map((volume) => ({
            ...volume,
            series_id: null
          }))
          const existingIds = new Set(
            unassignedVolumes.map((volume) => volume.id)
          )
          const nextUnassigned = [
            ...unassignedVolumes,
            ...detachedVolumes.filter((volume) => !existingIds.has(volume.id))
          ]
          setUnassignedVolumes(nextUnassigned)
        }

        deleteSeries(id)
      } catch (error) {
        console.error("Error deleting series:", error)
        throw error
      }
    },
    [
      supabase,
      series,
      unassignedVolumes,
      deleteSeriesVolumes,
      setUnassignedVolumes,
      deleteSeries
    ]
  )

  // Create new volume
  const createVolume = useCallback(
    async (
      seriesId: string | null,
      data: Omit<VolumeInsert, "user_id" | "series_id">
    ) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const sanitizedData = buildSanitizedVolumeInsert(data)

        if (!sanitizedData.format && seriesId) {
          const parentSeries = useLibraryStore
            .getState()
            .series.find((s) => s.id === seriesId)
          if (parentSeries) {
            const formatFromType: Record<string, string> = {
              light_novel: "Light Novel",
              manga: "Manga"
            }
            sanitizedData.format = formatFromType[parentSeries.type] ?? null
          }
        }

        const payload = {
          ...normalizeVolumeDates(sanitizedData),
          series_id: seriesId,
          user_id: user.id
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newVolume, error } = await (supabase as any)
          .from("volumes")
          .insert(payload)
          .select()
          .single()

        if (error) throw error

        if (seriesId) {
          await updateSeriesCoverFromVolume(seriesId, newVolume as Volume)
          addVolume(seriesId, newVolume as Volume)
        } else {
          addUnassignedVolume(newVolume as Volume)
        }
        return newVolume as Volume
      } catch (error) {
        console.error("Error creating volume:", error)
        throw error
      }
    },
    [supabase, addVolume, addUnassignedVolume, updateSeriesCoverFromVolume]
  )

  // Update volume
  const editVolume = useCallback(
    async (
      seriesId: string | null,
      volumeId: string,
      data: Partial<Volume>
    ) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        const hasSeriesId = Object.hasOwn(data, "series_id")
        const nextSeriesId = hasSeriesId ? (data.series_id ?? null) : seriesId
        const seriesSnapshot = useLibraryStore.getState().series
        if (
          nextSeriesId &&
          !seriesSnapshot.some((item) => item.id === nextSeriesId)
        ) {
          throw new Error("Series not found")
        }
        const sanitizedData = sanitizeVolumeUpdate(data)
        const updatePayload = {
          ...normalizeVolumeDates(sanitizedData),
          series_id: nextSeriesId
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("volumes")
          .update(updatePayload)
          .eq("id", volumeId)
          .eq("user_id", user.id)

        if (error) throw error

        const currentVolume =
          seriesSnapshot
            .flatMap((item) => item.volumes)
            .find((volume) => volume.id === volumeId) ??
          unassignedVolumes.find((volume) => volume.id === volumeId)

        if (!currentVolume) {
          return
        }

        const updatedVolume: Volume = {
          ...currentVolume,
          ...updatePayload
        }

        if (nextSeriesId === seriesId) {
          if (seriesId) {
            updateVolume(seriesId, volumeId, updatePayload)
          } else {
            updateUnassignedVolume(volumeId, updatePayload)
          }
          return
        }

        if (seriesId) {
          deleteVolume(seriesId, volumeId)
        } else {
          deleteUnassignedVolume(volumeId)
        }

        if (nextSeriesId) {
          await updateSeriesCoverFromVolume(nextSeriesId, updatedVolume)
          addVolume(nextSeriesId, updatedVolume)
        } else {
          addUnassignedVolume(updatedVolume)
        }
      } catch (error) {
        console.error("Error updating volume:", error)
        throw error
      }
    },
    [
      supabase,
      unassignedVolumes,
      updateVolume,
      updateUnassignedVolume,
      deleteVolume,
      deleteUnassignedVolume,
      addVolume,
      addUnassignedVolume,
      updateSeriesCoverFromVolume
    ]
  )

  // Delete volume
  const removeVolume = useCallback(
    async (seriesId: string | null, volumeId: string) => {
      try {
        const {
          data: { user }
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Not authenticated")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("volumes")
          .delete()
          .eq("id", volumeId)
          .eq("user_id", user.id)

        if (error) throw error

        if (seriesId) {
          deleteVolume(seriesId, volumeId)
        } else {
          deleteUnassignedVolume(volumeId)
        }
      } catch (error) {
        console.error("Error deleting volume:", error)
        throw error
      }
    },
    [supabase, deleteVolume, deleteUnassignedVolume]
  )

  // Filter series based on current filters
  const filteredSeries = series.filter((s) => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesTitle = s.title.toLowerCase().includes(searchLower)
      const matchesAuthor = s.author?.toLowerCase().includes(searchLower)
      const matchesDescription = s.description
        ?.toLowerCase()
        .includes(searchLower)
      if (!matchesTitle && !matchesAuthor && !matchesDescription) return false
    }

    // Type filter
    if (filters.type !== "all" && s.type !== filters.type) return false

    // Tags filter
    if (filters.tags.length > 0) {
      const hasTags = filters.tags.every((tag) => s.tags.includes(tag))
      if (!hasTags) return false
    }

    // Ownership status filter (check volumes)
    if (filters.ownershipStatus !== "all") {
      const hasMatchingVolume = s.volumes.some(
        (v) => v.ownership_status === filters.ownershipStatus
      )
      if (!hasMatchingVolume) return false
    }

    // Reading status filter (check volumes)
    if (filters.readingStatus !== "all") {
      const hasMatchingVolume = s.volumes.some(
        (v) => v.reading_status === filters.readingStatus
      )
      if (!hasMatchingVolume) return false
    }

    return true
  })

  const allVolumes = useMemo<VolumeWithSeries[]>(() => {
    return series.flatMap((item) =>
      item.volumes.map((volume) => ({ volume, series: item }))
    )
  }, [series])

  const filteredVolumes = useMemo(() => {
    return allVolumes.filter(({ volume, series: seriesItem }) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesVolumeTitle = volume.title
          ?.toLowerCase()
          .includes(searchLower)
        const matchesSeriesTitle = seriesItem.title
          .toLowerCase()
          .includes(searchLower)
        const matchesAuthor = seriesItem.author
          ?.toLowerCase()
          .includes(searchLower)
        const matchesIsbn = volume.isbn?.toLowerCase().includes(searchLower)

        if (
          !matchesVolumeTitle &&
          !matchesSeriesTitle &&
          !matchesAuthor &&
          !matchesIsbn
        ) {
          return false
        }
      }

      if (filters.type !== "all" && seriesItem.type !== filters.type)
        return false

      if (filters.tags.length > 0) {
        const hasTags = filters.tags.every((tag) =>
          seriesItem.tags.includes(tag)
        )
        if (!hasTags) return false
      }

      if (
        filters.ownershipStatus !== "all" &&
        volume.ownership_status !== filters.ownershipStatus
      ) {
        return false
      }

      if (
        filters.readingStatus !== "all" &&
        volume.reading_status !== filters.readingStatus
      ) {
        return false
      }

      return true
    })
  }, [allVolumes, filters])

  const filteredUnassignedVolumes = useMemo(() => {
    return unassignedVolumes.filter((volume) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchesTitle = volume.title?.toLowerCase().includes(searchLower)
        const matchesIsbn = volume.isbn?.toLowerCase().includes(searchLower)

        if (!matchesTitle && !matchesIsbn) {
          return false
        }
      }

      if (filters.type !== "all") return false
      if (filters.tags.length > 0) return false

      if (
        filters.ownershipStatus !== "all" &&
        volume.ownership_status !== filters.ownershipStatus
      ) {
        return false
      }

      if (
        filters.readingStatus !== "all" &&
        volume.reading_status !== filters.readingStatus
      ) {
        return false
      }

      return true
    })
  }, [filters, unassignedVolumes])

  const sortedVolumes = useMemo(() => {
    const multiplier = sortOrder === "asc" ? 1 : -1
    const compareStrings = (a?: string | null, b?: string | null) => {
      return (a ?? "").localeCompare(b ?? "", undefined, {
        sensitivity: "base"
      })
    }

    return [...filteredVolumes].sort((a, b) => {
      switch (sortField) {
        case "author":
          return (
            compareStrings(a.series.author, b.series.author) * multiplier ||
            (a.volume.volume_number - b.volume.volume_number) * multiplier
          )
        case "created_at":
          return (
            (new Date(a.volume.created_at).getTime() -
              new Date(b.volume.created_at).getTime()) *
            multiplier
          )
        case "updated_at":
          return (
            (new Date(a.volume.updated_at).getTime() -
              new Date(b.volume.updated_at).getTime()) *
            multiplier
          )
        case "title":
        default:
          return (
            compareStrings(a.series.title, b.series.title) * multiplier ||
            (a.volume.volume_number - b.volume.volume_number) * multiplier
          )
      }
    })
  }, [filteredVolumes, sortField, sortOrder])

  const resolveSeriesForResult = useCallback(
    async (
      resolvedResult: BookSearchResult,
      seriesCache: Map<string, SeriesWithVolumes>
    ) => {
      const seriesTitle = deriveSeriesTitle(resolvedResult)
      const author = resolvedResult.authors[0] ?? null
      const seriesTypeHint = deriveSeriesType(resolvedResult)
      const seriesKey = buildSeriesKey(seriesTitle, author)
      const typedSeriesKey = seriesTypeHint
        ? `${seriesKey}|${seriesTypeHint}`
        : seriesKey
      const parsedVolumeNumber = extractVolumeNumber(resolvedResult.title)
      const initialVolumeNumber = parsedVolumeNumber ?? 1

      let targetSeries = seriesTypeHint
        ? seriesCache.get(typedSeriesKey)
        : seriesCache.get(seriesKey)

      targetSeries ??= findMatchingSeries(seriesTitle, author, seriesTypeHint)

      targetSeries ??= await createSeries({
        title: seriesTitle,
        author: author || null,
        description:
          initialVolumeNumber === 1 ? resolvedResult.description || null : null,
        publisher: resolvedResult.publisher || null,
        cover_image_url:
          initialVolumeNumber === 1 ? resolvedResult.coverUrl || null : null,
        type: seriesTypeHint ?? "other",
        tags: []
      })

      targetSeries = await updateSeriesAuthorIfMissing(targetSeries, author)
      targetSeries = await updateSeriesTypeIfMissing(
        targetSeries,
        seriesTypeHint
      )

      if (seriesTypeHint) {
        seriesCache.set(typedSeriesKey, targetSeries)
      } else {
        seriesCache.set(seriesKey, targetSeries)
      }

      return { targetSeries, parsedVolumeNumber }
    },
    [
      buildSeriesKey,
      createSeries,
      deriveSeriesTitle,
      deriveSeriesType,
      extractVolumeNumber,
      findMatchingSeries,
      updateSeriesAuthorIfMissing,
      updateSeriesTypeIfMissing
    ]
  )

  const addBooksFromSearchResults = useCallback(
    async (
      results: BookSearchResult[],
      options?: { throwOnError?: boolean; ownershipStatus?: OwnershipStatus }
    ) => {
      const seriesCache = new Map<string, SeriesWithVolumes>()
      const nextVolumeBySeries = new Map<string, number>()
      let successCount = 0
      let failureCount = 0
      let lastSeries: SeriesWithVolumes | null = null

      const getNextVolumeNumberForSeries = (
        targetSeries: SeriesWithVolumes
      ) => {
        const cached = nextVolumeBySeries.get(targetSeries.id)
        if (cached !== undefined) return cached
        const next = getNextVolumeNumber(targetSeries)
        nextVolumeBySeries.set(targetSeries.id, next)
        return next
      }

      for (const result of results) {
        try {
          const resolvedResult = await resolveSearchResultDetails(result)
          const { targetSeries, parsedVolumeNumber } =
            await resolveSeriesForResult(resolvedResult, seriesCache)

          const volumeNumber =
            parsedVolumeNumber ?? getNextVolumeNumberForSeries(targetSeries)

          await createVolume(targetSeries.id, {
            volume_number: volumeNumber,
            title: resolvedResult.title || null,
            isbn: resolvedResult.isbn || null,
            cover_image_url: resolvedResult.coverUrl || null,
            publish_date: resolvedResult.publishedDate || null,
            page_count: resolvedResult.pageCount ?? null,
            description: resolvedResult.description || null,
            ownership_status: options?.ownershipStatus ?? "owned",
            reading_status: "unread"
          })

          await autoFillSeriesFromVolume(
            targetSeries,
            volumeNumber,
            resolvedResult
          )

          bumpNextVolumeNumberForSeries(
            nextVolumeBySeries,
            targetSeries.id,
            volumeNumber
          )
          lastSeries = targetSeries
          successCount += 1
        } catch (error) {
          console.error("Error adding book from search:", error)
          failureCount += 1
          if (options?.throwOnError) {
            throw error
          }
        }
      }

      return { successCount, failureCount, lastSeries }
    },
    [
      autoFillSeriesFromVolume,
      bumpNextVolumeNumberForSeries,
      createVolume,
      getNextVolumeNumber,
      resolveSearchResultDetails,
      resolveSeriesForResult
    ]
  )

  const addBookFromSearchResult = useCallback(
    async (
      result: BookSearchResult,
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      const { failureCount, lastSeries } = await addBooksFromSearchResults(
        [result],
        { ...options, throwOnError: true }
      )
      if (failureCount > 0 || !lastSeries) {
        throw new Error("Failed to add book")
      }
      return lastSeries
    },
    [addBooksFromSearchResults]
  )

  const addVolumesFromSearchResults = useCallback(
    async (
      seriesId: string,
      results: BookSearchResult[],
      options?: { throwOnError?: boolean; ownershipStatus?: OwnershipStatus }
    ) => {
      const targetSeries = series.find((item) => item.id === seriesId)
      if (!targetSeries) throw new Error("Series not found")

      const nextVolumeBySeries = new Map<string, number>()
      let successCount = 0
      let failureCount = 0

      const getNextVolumeNumberForSeries = () => {
        const cached = nextVolumeBySeries.get(seriesId)
        if (cached !== undefined) return cached
        const next = getNextVolumeNumber(targetSeries)
        nextVolumeBySeries.set(seriesId, next)
        return next
      }

      for (const result of results) {
        try {
          const resolvedResult = await resolveSearchResultDetails(result)
          const parsedVolumeNumber = extractVolumeNumber(resolvedResult.title)
          const volumeNumber =
            parsedVolumeNumber ?? getNextVolumeNumberForSeries()

          await createVolume(seriesId, {
            volume_number: volumeNumber,
            title: resolvedResult.title || null,
            isbn: resolvedResult.isbn || null,
            cover_image_url: resolvedResult.coverUrl || null,
            publish_date: resolvedResult.publishedDate || null,
            page_count: resolvedResult.pageCount ?? null,
            description: resolvedResult.description || null,
            ownership_status: options?.ownershipStatus ?? "owned",
            reading_status: "unread"
          })

          await autoFillSeriesFromVolume(
            targetSeries,
            volumeNumber,
            resolvedResult
          )

          bumpNextVolumeNumberForSeries(
            nextVolumeBySeries,
            seriesId,
            volumeNumber
          )
          successCount += 1
        } catch (error) {
          console.error("Error adding volume from search:", error)
          failureCount += 1
          if (options?.throwOnError) {
            throw error
          }
        }
      }

      return { successCount, failureCount }
    },
    [
      autoFillSeriesFromVolume,
      bumpNextVolumeNumberForSeries,
      createVolume,
      extractVolumeNumber,
      getNextVolumeNumber,
      resolveSearchResultDetails,
      series
    ]
  )

  const addVolumeFromSearchResult = useCallback(
    async (
      seriesId: string,
      result: BookSearchResult,
      options?: { ownershipStatus?: OwnershipStatus }
    ) => {
      const { failureCount } = await addVolumesFromSearchResults(
        seriesId,
        [result],
        { ...options, throwOnError: true }
      )
      if (failureCount > 0) {
        throw new Error("Failed to add volume")
      }
    },
    [addVolumesFromSearchResults]
  )

  return {
    series,
    unassignedVolumes,
    filteredSeries,
    filteredVolumes: sortedVolumes,
    filteredUnassignedVolumes,
    isLoading,
    fetchSeries,
    createSeries,
    editSeries,
    removeSeries,
    createVolume,
    editVolume,
    removeVolume,
    addBookFromSearchResult,
    addBooksFromSearchResults,
    addVolumeFromSearchResult,
    addVolumesFromSearchResults
  }
}
