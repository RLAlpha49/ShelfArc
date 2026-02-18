/**
 * Pure helpers for parsing volume numbers from titles and deriving stable series keys.
 *
 * These are intentionally framework-agnostic so they can be unit tested without
 * Supabase wiring or React hooks.
 * @source
 */

/** Regex matching volume indicator tokens like "Vol. 3" or "Book 12". @source */
const VOLUME_TOKEN_PATTERN =
  /\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*(\d+(?:\.\d+)?)\b/i
/** Global variant of `VOLUME_TOKEN_PATTERN` for stripping. @source */
const VOLUME_TOKEN_GLOBAL =
  /\b(?:vol(?:ume)?|v|book|part|no\.?|#)\s*\.?\s*\d+(?:\.\d+)?\b/gi

/** English number words (zero through ninety-nine) for volume number parsing. @source */
const VOLUME_WORDS = [
  // Compound forms must precede their base tens words so the regex alternation
  // tries the longer match first and avoids "twenty" consuming "twenty-one".
  "twenty-one",
  "twenty-two",
  "twenty-three",
  "twenty-four",
  "twenty-five",
  "twenty-six",
  "twenty-seven",
  "twenty-eight",
  "twenty-nine",
  "thirty-one",
  "thirty-two",
  "thirty-three",
  "thirty-four",
  "thirty-five",
  "thirty-six",
  "thirty-seven",
  "thirty-eight",
  "thirty-nine",
  "forty-one",
  "forty-two",
  "forty-three",
  "forty-four",
  "forty-five",
  "forty-six",
  "forty-seven",
  "forty-eight",
  "forty-nine",
  "fifty-one",
  "fifty-two",
  "fifty-three",
  "fifty-four",
  "fifty-five",
  "fifty-six",
  "fifty-seven",
  "fifty-eight",
  "fifty-nine",
  "sixty-one",
  "sixty-two",
  "sixty-three",
  "sixty-four",
  "sixty-five",
  "sixty-six",
  "sixty-seven",
  "sixty-eight",
  "sixty-nine",
  "seventy-one",
  "seventy-two",
  "seventy-three",
  "seventy-four",
  "seventy-five",
  "seventy-six",
  "seventy-seven",
  "seventy-eight",
  "seventy-nine",
  "eighty-one",
  "eighty-two",
  "eighty-three",
  "eighty-four",
  "eighty-five",
  "eighty-six",
  "eighty-seven",
  "eighty-eight",
  "eighty-nine",
  "ninety-one",
  "ninety-two",
  "ninety-three",
  "ninety-four",
  "ninety-five",
  "ninety-six",
  "ninety-seven",
  "ninety-eight",
  "ninety-nine",
  // Base tens
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
  // Teens and below
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
  "nineteen"
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
  twenty: 20,
  "twenty-one": 21,
  "twenty-two": 22,
  "twenty-three": 23,
  "twenty-four": 24,
  "twenty-five": 25,
  "twenty-six": 26,
  "twenty-seven": 27,
  "twenty-eight": 28,
  "twenty-nine": 29,
  thirty: 30,
  "thirty-one": 31,
  "thirty-two": 32,
  "thirty-three": 33,
  "thirty-four": 34,
  "thirty-five": 35,
  "thirty-six": 36,
  "thirty-seven": 37,
  "thirty-eight": 38,
  "thirty-nine": 39,
  forty: 40,
  "forty-one": 41,
  "forty-two": 42,
  "forty-three": 43,
  "forty-four": 44,
  "forty-five": 45,
  "forty-six": 46,
  "forty-seven": 47,
  "forty-eight": 48,
  "forty-nine": 49,
  fifty: 50,
  "fifty-one": 51,
  "fifty-two": 52,
  "fifty-three": 53,
  "fifty-four": 54,
  "fifty-five": 55,
  "fifty-six": 56,
  "fifty-seven": 57,
  "fifty-eight": 58,
  "fifty-nine": 59,
  sixty: 60,
  "sixty-one": 61,
  "sixty-two": 62,
  "sixty-three": 63,
  "sixty-four": 64,
  "sixty-five": 65,
  "sixty-six": 66,
  "sixty-seven": 67,
  "sixty-eight": 68,
  "sixty-nine": 69,
  seventy: 70,
  "seventy-one": 71,
  "seventy-two": 72,
  "seventy-three": 73,
  "seventy-four": 74,
  "seventy-five": 75,
  "seventy-six": 76,
  "seventy-seven": 77,
  "seventy-eight": 78,
  "seventy-nine": 79,
  eighty: 80,
  "eighty-one": 81,
  "eighty-two": 82,
  "eighty-three": 83,
  "eighty-four": 84,
  "eighty-five": 85,
  "eighty-six": 86,
  "eighty-seven": 87,
  "eighty-eight": 88,
  "eighty-nine": 89,
  ninety: 90,
  "ninety-one": 91,
  "ninety-two": 92,
  "ninety-three": 93,
  "ninety-four": 94,
  "ninety-five": 95,
  "ninety-six": 96,
  "ninety-seven": 97,
  "ninety-eight": 98,
  "ninety-nine": 99
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

/** Lowercases and normalizes whitespace in a descriptor string. @source */
const normalizeDescriptor = (value: string) => {
  return value.trim().toLowerCase().replaceAll(/\s+/g, " ")
}

/**
 * Normalizes text for library keys by removing diacritics, lowercasing, and
 * collapsing whitespace.
 * @source
 */
export const normalizeLibraryText = (value?: string | null) => {
  return (value ?? "")
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, " ")
}

/**
 * Normalizes author names to an alphanumeric-only key.
 * @source
 */
export const normalizeAuthorKey = (value?: string | null) => {
  const base = normalizeLibraryText(value ?? "")
  return base.replaceAll(/[^\p{L}\p{N}]+/gu, "")
}

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
 * Extracts a volume number from a title (explicit token, word token, inline suffix, or trailing suffix).
 * @source
 */
export const extractVolumeNumberFromTitle = (title?: string | null) => {
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
}

/**
 * Removes volume tokens, bracket descriptors, and format suffixes from a title to derive a base series title.
 * @source
 */
export const stripVolumeFromTitle = (title: string) => {
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
}

/**
 * Derives a stable normalized series title key.
 * @source
 */
export const normalizeSeriesTitle = (value: string) => {
  const withoutSubtitle = stripSubtitleAfterVolumeIndicator(value)
  const withoutVolumeTokens = withoutSubtitle
    .replaceAll(VOLUME_TOKEN_GLOBAL, " ")
    .replaceAll(VOLUME_WORD_GLOBAL, " ")
  const withoutInline = stripInlineVolumeSuffixForKey(withoutVolumeTokens)
  const withoutTrailing = stripTrailingVolumeSuffixForKey(withoutInline)
  const base = normalizeLibraryText(stripTrailingFormatSuffix(withoutTrailing))
  return base
    .replaceAll(/\(.*?\)/g, " ")
    .replaceAll(VOLUME_TOKEN_GLOBAL, " ")
    .replaceAll(VOLUME_WORD_GLOBAL, " ")
    .replaceAll(EXTRA_DESCRIPTOR_PATTERN, " ")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
}
