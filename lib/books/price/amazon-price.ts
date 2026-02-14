import * as cheerio from "cheerio"
import type { Element } from "domhandler"
import { ApiError } from "@/lib/books/price/api-error"

type DebugLog = (...args: Parameters<typeof console.debug>) => void

// Set to `true` to enable detailed debug logging of the search result scoring process.
const DEBUG = false

/** Conditional debug logger; only emits output when `DEBUG` is `true`. @source */
const debugLog: DebugLog = (...args) => {
  if (DEBUG) {
    console.debug(...args)
  }
}

/** Amazon search endpoint path. @source */
const AMAZON_SEARCH_PATH = "/s"

/** Fallback binding label when none is supplied. @source */
const DEFAULT_BINDING = "Paperback"

/** Labels considered Kindle editions. @source */
const KINDLE_BINDING_LABELS = ["Kindle", "Kindle Edition"]

/** Labels considered hardcover editions. @source */
const HARDCOVER_BINDING_LABELS = ["Hardcover", "Hardback"]

/** Timeout in milliseconds for outbound Amazon requests. @source */
const FETCH_TIMEOUT_MS = 12000

/** Minimum Jaccard-style similarity to accept a result. @source */
const MATCH_THRESHOLD = 0.6

/** Token-coverage threshold for required title tokens. @source */
const REQUIRED_MATCH_THRESHOLD = 0.8

/** Token-coverage threshold for the base series title. @source */
const BASE_TITLE_MATCH_THRESHOLD = 0.9

/** Weight applied to the base title score in combined ranking. @source */
const BASE_TITLE_WEIGHT = 0.2

/** Weight applied to the volume title score in combined ranking. @source */
const VOLUME_TITLE_WEIGHT = 0.35

/** Penalty applied when a result's format conflicts with the request. @source */
const FORMAT_CONFLICT_PENALTY = 0.4

/** Penalty applied when a result targets a different volume number. @source */
const VOLUME_MISMATCH_PENALTY = 0.8

/** Per-extra-token penalty for unexpected tokens in a result title. @source */
const EXTRA_TOKEN_PENALTY = 0.08

/** Maximum cumulative extra-token penalty. @source */
const MAX_EXTRA_TOKEN_PENALTY = 0.45

/** Maximum number of Amazon search results to score. @source */
const MAX_RESULTS_TO_SCORE = 16

/** Maximum allowed character length for the series title input. @source */
const MAX_TITLE_LENGTH = 200

/** Maximum allowed character length for the volume title input. @source */
const MAX_VOLUME_TITLE_LENGTH = 200

/** Maximum allowed character length for the format input. @source */
const MAX_FORMAT_LENGTH = 80

/** Maximum allowed character length for the constructed search query. @source */
const MAX_QUERY_LENGTH = 260

/** Mapping of short Amazon domain keys to their fully-qualified hostnames. @source */
const AMAZON_DOMAINS = {
  "amazon.com": "www.amazon.com",
  "amazon.co.uk": "www.amazon.co.uk",
  "amazon.ca": "www.amazon.ca",
  "amazon.de": "www.amazon.de",
  "amazon.co.jp": "www.amazon.co.jp"
} as const

/** Amazon hosts that format prices with comma as the decimal separator. @source */
const COMMA_DECIMAL_HOSTS = new Set<string>(["www.amazon.de"])

/** Key of the `AMAZON_DOMAINS` map. @source */
type AmazonDomain = keyof typeof AMAZON_DOMAINS

export type SearchContext = {
  domain: AmazonDomain
  host: string
  title: string
  expectedTitle: string
  requiredTitle: string
  format: string
  bindingLabel: string
  bindingLabels: string[]
  fallbackToKindle: boolean
  volumeNumber: number | null
  volumeTitle: string
  volumeSubtitle: string
  searchUrl: string
}

/** A scored Amazon search result with all ranking metrics. @source */
type ScoredResult = {
  result: cheerio.Cheerio<Element>
  resultTitle: string
  strictScore: number
  requiredScore: number
  matchScore: number
  baseTitleScore: number
  volumeTitleScore: number
  subtitleScore: number
  modifierPenalty: number
  formatConflictPenalty: number
  extraTokenPenalty: number
  volumeMismatchPenalty: number
  combinedScore: number
  hasVolumeMatch: boolean
  index: number
}

/** A scored result with an extracted price and binding label. @source */
type PricedCandidate = {
  candidate: ScoredResult
  priceText: string
  priceValue: number | null
  currency: string | null
  bindingLabel: string
}

/** A matched binding link element and its label text. @source */
type BindingMatch = {
  link: cheerio.Cheerio<Element>
  label: string
}

/** Final price selection result for the best-matching candidate. @source */
type PriceSelection = {
  selected: ScoredResult
  priceText: string | null
  priceValue: number | null
  currency: string | null
  priceBinding: string | null
  priceError: string | null
}

/** Input parameters for the `resolvePriceSelection` function. @source */
type PriceSelectionInput = {
  $: cheerio.CheerioAPI
  includePrice: boolean
  includeImage: boolean
  selected: ScoredResult
  eligibleCandidates: ScoredResult[]
  bindingLabels: string[]
  host: string
  priceErrorMessage: string
}

export type AmazonPriceParseResult = {
  resultTitle: string
  matchScore: number
  priceText: string | null
  priceValue: number | null
  currency: string | null
  priceBinding: string | null
  priceError: string | null
  productUrl: string | null
  imageUrl: string | null
}

/**
 * Strips Amazon CDN resizing suffixes to yield the full-resolution image URL.
 * @param thumbnailUrl - Thumbnail URL from Amazon search results.
 * @returns Full-size image URL, or `null` if the URL is not a valid Amazon media URL.
 * @source
 */
const getFullSizeImageUrl = (thumbnailUrl: string): string | null => {
  try {
    const url = new URL(thumbnailUrl)
    if (!url.hostname.includes("media-amazon.com")) return null
    // Pattern: /images/I/<id>._AC_UY218_.jpg -> /images/I/<id>.jpg
    const cleaned = url.pathname.replace(/\._[^.]+(\.[a-z0-9]+)$/i, "$1")
    return `${url.origin}${cleaned}`
  } catch {
    return null
  }
}

/**
 * Unicode-normalizes, lowercases, and tokenizes text for fuzzy comparison.
 * @param value - Raw text to normalize.
 * @returns Cleaned, whitespace-collapsed, lowercase string.
 * @source
 */
const normalizeText = (value: string) => {
  return value
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase()
    .replaceAll(/\bvols?\b/g, "volume")
    .replaceAll(/\s+/g, " ")
}

/** Normalizes a binding label for comparison. @source */
const normalizeBindingLabel = (value: string) => normalizeText(value)

/** Returns `true` if the binding label represents a Kindle edition. @source */
const isKindleBinding = (bindingLabel: string) => {
  const normalized = normalizeBindingLabel(bindingLabel)
  return normalized.includes("kindle")
}

/** Returns `true` if the binding label represents a paperback edition. @source */
const isPaperbackBinding = (bindingLabel: string) => {
  const normalized = normalizeBindingLabel(bindingLabel)
  return normalized.includes("paperback")
}

/**
 * Builds an ordered list of binding labels to try, with optional Kindle/hardcover fallbacks.
 * @param bindingLabel - Primary requested binding label.
 * @param fallbackToKindle - Whether to include Kindle labels as a last resort.
 * @returns Deduplicated list of binding labels.
 * @source
 */
const resolveBindingLabels = (
  bindingLabel: string,
  fallbackToKindle: boolean
) => {
  const labels: string[] = []
  const seen = new Set<string>()
  const addLabel = (label: string) => {
    const normalized = normalizeBindingLabel(label)
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    labels.push(label)
  }

  addLabel(bindingLabel)

  if (isPaperbackBinding(bindingLabel)) {
    for (const label of HARDCOVER_BINDING_LABELS) {
      addLabel(label)
    }
  }

  if (fallbackToKindle && !isKindleBinding(bindingLabel)) {
    for (const label of KINDLE_BINDING_LABELS) {
      addLabel(label)
    }
  }

  return labels
}

/**
 * Splits normalized text into a set of unique tokens for fuzzy matching.
 * @param value - Raw text to tokenize.
 * @returns A `Set` of lowercase tokens.
 * @source
 */
const tokenize = (value: string) => {
  const tokens = normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 || /^\d+$/.test(token))
  return new Set(tokens)
}

/**
 * Splits normalized text into an ordered array of tokens, preserving duplicates.
 * @param value - Raw text to tokenize.
 * @returns An ordered array of lowercase tokens.
 * @source
 */
const tokenizeOrdered = (value: string) => {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 || /^\d+$/.test(token))
}

/**
 * Generates zero-padded string variants of a volume number for matching.
 * @param volumeNumber - The numeric volume to generate variants of.
 * @returns A `Set` of string representations (e.g. `"1"`, `"01"`, `"001"`).
 * @source
 */
const getVolumeTokenVariants = (volumeNumber: number) => {
  const raw = volumeNumber.toString()
  const variants = new Set([raw])
  if (volumeNumber >= 0 && raw.length < 2) {
    variants.add(raw.padStart(2, "0"))
  }
  if (volumeNumber >= 0 && raw.length < 3) {
    variants.add(raw.padStart(3, "0"))
  }
  return variants
}

/** Common stop-words ignored when computing prefix modifier penalties. @source */
const PREFIX_IGNORED_TOKENS = new Set([
  "the",
  "of",
  "and",
  "for",
  "to",
  "in",
  "on",
  "with",
  "from",
  "by"
])

/**
 * Extracts subtitle tokens from a volume title by removing series, format, and binding tokens.
 * @param volumeTitle - Full volume title.
 * @param seriesTitle - Parent series title to exclude.
 * @param volumeNumber - Volume number to exclude.
 * @param format - Media format label to exclude.
 * @param binding - Binding label to exclude.
 * @returns Space-joined subtitle tokens.
 * @source
 */
const extractVolumeSubtitle = (
  volumeTitle: string,
  seriesTitle: string,
  volumeNumber: number | null,
  format: string,
  binding: string
) => {
  if (!volumeTitle) return ""
  const volumeTokens = tokenize(volumeTitle)
  if (volumeTokens.size === 0) return ""

  const blockedTokens = new Set<string>([
    ...tokenize(seriesTitle),
    ...tokenize(format),
    ...tokenize(binding),
    "volume",
    "book",
    "light",
    "novel",
    "manga",
    "paperback",
    "kindle",
    "hardcover"
  ])

  if (volumeNumber != null) {
    for (const token of getVolumeTokenVariants(volumeNumber)) {
      blockedTokens.add(token)
    }
  }

  const subtitleTokens = [...volumeTokens].filter(
    (token) => !blockedTokens.has(token)
  )

  return subtitleTokens.join(" ")
}

/**
 * Checks whether a title explicitly references the exact volume number (not as part of a range).
 * @param title - Result title to inspect.
 * @param volumeNumber - Volume number to look for.
 * @returns `true` if the title contains an explicit match.
 * @source
 */
const hasExactVolumeMatch = (title: string, volumeNumber: number) => {
  const lower = title.toLowerCase()
  const explicitPattern = new RegExp(
    String.raw`\bvol(?:ume)?\.?\s*0*${volumeNumber}\b(?!\s*(?:-|–|—|to)\s*\d)`,
    "i"
  )
  if (explicitPattern.test(lower)) return true

  const rangePattern = /\b(\d+)\s*(?:-|–|—|to)\s*(\d+)\b/g
  let inRange = false
  for (const match of lower.matchAll(rangePattern)) {
    const start = Number.parseInt(match[1], 10)
    const end = Number.parseInt(match[2], 10)
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const min = Math.min(start, end)
      const max = Math.max(start, end)
      if (volumeNumber >= min && volumeNumber <= max) {
        inRange = true
        break
      }
    }
  }

  const standalonePattern = new RegExp(String.raw`\b0*${volumeNumber}\b`)
  const hasStandalone = standalonePattern.test(lower)
  return hasStandalone && !inRange
}

/**
 * Populates explicit volume indicators ("Vol 3", "Book 1-5") from a title string.
 * @param title - Title text to scan.
 * @param numbers - Set to populate with single volume numbers.
 * @param ranges - Array to populate with volume ranges.
 * @source
 */
const addExplicitVolumeIndicators = (
  title: string,
  numbers: Set<number>,
  ranges: Array<{ start: number; end: number }>
) => {
  const rangePattern =
    /\b(?:vol(?:ume)?\.?|book|part)\s*0*(\d{1,3})\s*(?:-|–|—|to)\s*0*(\d{1,3})/gi
  for (const match of title.matchAll(rangePattern)) {
    const start = Number.parseInt(match[1], 10)
    const end = Number.parseInt(match[2], 10)
    if (Number.isFinite(start) && Number.isFinite(end)) {
      ranges.push({ start, end })
    }
  }

  const singlePattern = /\b(?:vol(?:ume)?\.?|book|part)\s*0*(\d{1,3})\b/gi
  for (const match of title.matchAll(singlePattern)) {
    const value = Number.parseInt(match[1], 10)
    if (Number.isFinite(value)) {
      numbers.add(value)
    }
  }
}

/**
 * Detects trailing bare numbers in a title that likely represent volume numbers.
 * @param title - Title text to scan.
 * @param contextTitle - Optional context title whose tokens are excluded.
 * @param numbers - Set to populate with detected volume numbers.
 * @source
 */
const addTrailingVolumeIndicators = (
  title: string,
  contextTitle: string | undefined,
  numbers: Set<number>
) => {
  const contextTokens = contextTitle
    ? tokenize(contextTitle)
    : new Set<string>()
  const tokens = tokenizeOrdered(title)
  const lastIndex = tokens.length - 1
  for (const [index, token] of tokens.entries()) {
    if (!/^\d{1,3}$/.test(token)) continue
    if (contextTokens.has(token)) continue
    if (index < Math.max(0, lastIndex - 2)) continue
    const value = Number.parseInt(token, 10)
    if (Number.isFinite(value)) {
      numbers.add(value)
    }
  }
}

/**
 * Extracts all volume number indicators (explicit and trailing) from a title.
 * @param title - Title text to scan.
 * @param contextTitle - Optional series title for disambiguation.
 * @returns An object with `numbers` (Set) and `ranges` (Array).
 * @source
 */
const extractExplicitVolumeIndicators = (
  title: string,
  contextTitle?: string
) => {
  const numbers = new Set<number>()
  const ranges: Array<{ start: number; end: number }> = []
  addExplicitVolumeIndicators(title, numbers, ranges)
  addTrailingVolumeIndicators(title, contextTitle, numbers)

  return { numbers, ranges }
}

/**
 * Computes a penalty when a result's volume number conflicts with the expected volume.
 * @param context - Current search context.
 * @param resultTitle - Title of the Amazon search result.
 * @returns `0` if the volume matches, otherwise `VOLUME_MISMATCH_PENALTY`.
 * @source
 */
const getVolumeMismatchPenalty = (
  context: SearchContext,
  resultTitle: string
) => {
  if (context.volumeNumber == null) return 0
  if (hasExactVolumeMatch(resultTitle, context.volumeNumber)) return 0

  const { numbers, ranges } = extractExplicitVolumeIndicators(
    resultTitle,
    context.title
  )
  if (numbers.size === 0 && ranges.length === 0) return 0

  for (const range of ranges) {
    const min = Math.min(range.start, range.end)
    const max = Math.max(range.start, range.end)
    if (context.volumeNumber >= min && context.volumeNumber <= max) {
      return 0
    }
  }

  if (numbers.has(context.volumeNumber)) return 0

  return VOLUME_MISMATCH_PENALTY
}

/**
 * Computes Jaccard-style token similarity between two strings.
 * @param expected - Expected text.
 * @param actual - Actual text to compare.
 * @returns Similarity score between 0 and 1.
 * @source
 */
const similarityScore = (expected: string, actual: string) => {
  const expectedTokens = tokenize(expected)
  const actualTokens = tokenize(actual)
  if (expectedTokens.size === 0 || actualTokens.size === 0) return 0
  let intersection = 0
  for (const token of expectedTokens) {
    if (actualTokens.has(token)) intersection += 1
  }
  return intersection / Math.max(expectedTokens.size, actualTokens.size)
}

/**
 * Measures how many expected tokens appear in the actual text (recall-oriented).
 * @param expected - Expected text.
 * @param actual - Actual text to compare.
 * @returns Coverage score between 0 and 1.
 * @source
 */
const tokenCoverageScore = (expected: string, actual: string) => {
  const expectedTokens = tokenize(expected)
  const actualTokens = tokenize(actual)
  if (expectedTokens.size === 0 || actualTokens.size === 0) return 0
  let intersection = 0
  for (const token of expectedTokens) {
    if (actualTokens.has(token)) intersection += 1
  }
  return intersection / expectedTokens.size
}

/**
 * Penalizes results with unexpected tokens appearing before the volume number.
 * @param context - Current search context.
 * @param resultTitle - Result title to inspect.
 * @returns Penalty value between 0 and 0.45.
 * @source
 */
const getPrefixModifierPenalty = (
  context: SearchContext,
  resultTitle: string
) => {
  if (!context.volumeNumber) return 0

  const tokens = tokenizeOrdered(resultTitle)
  const volumeTokens = getVolumeTokenVariants(context.volumeNumber)
  let volumeIndex = -1
  for (const token of volumeTokens) {
    const index = tokens.indexOf(token)
    if (index !== -1 && (volumeIndex === -1 || index < volumeIndex)) {
      volumeIndex = index
    }
  }
  if (volumeIndex <= 0) return 0

  const prefixTokens = tokens.slice(0, volumeIndex)
  if (!prefixTokens.length) return 0

  const allowedTokens = new Set<string>([
    ...tokenize(context.title),
    ...tokenize(context.volumeTitle),
    ...tokenize(context.volumeSubtitle),
    ...tokenize(context.format),
    ...tokenize(context.bindingLabel),
    "volume",
    "vol",
    "vols",
    "book",
    "part"
  ])

  for (const token of volumeTokens) {
    allowedTokens.add(token)
  }

  const extraTokens = prefixTokens.filter(
    (token) => !allowedTokens.has(token) && !PREFIX_IGNORED_TOKENS.has(token)
  )

  if (!extraTokens.length) return 0

  return Math.min(0.45, extraTokens.length * 0.2)
}

/**
 * Penalizes results containing unrecognized extra tokens.
 * @param context - Current search context.
 * @param resultTitle - Result title to inspect.
 * @returns Penalty value up to `MAX_EXTRA_TOKEN_PENALTY`.
 * @source
 */
const getExtraTokenPenalty = (context: SearchContext, resultTitle: string) => {
  const resultTokens = [...tokenize(resultTitle)]
  if (!resultTokens.length) return 0

  const allowedTokens = new Set<string>([
    ...tokenize(context.title),
    ...tokenize(context.volumeTitle),
    ...tokenize(context.volumeSubtitle),
    ...tokenize(context.bindingLabel),
    "volume",
    "vol",
    "vols",
    "book",
    "part"
  ])

  if (context.format) {
    for (const token of tokenize(context.format)) {
      allowedTokens.add(token)
    }
  }

  if (context.volumeNumber != null) {
    for (const token of getVolumeTokenVariants(context.volumeNumber)) {
      allowedTokens.add(token)
    }
  }

  const extraTokens = resultTokens.filter(
    (token) => !allowedTokens.has(token) && !PREFIX_IGNORED_TOKENS.has(token)
  )

  if (!extraTokens.length) return 0

  return Math.min(
    MAX_EXTRA_TOKEN_PENALTY,
    extraTokens.length * EXTRA_TOKEN_PENALTY
  )
}

/**
 * Penalizes results whose format (manga vs. light novel) conflicts with the expected format.
 * @param format - Expected format string.
 * @param resultTitle - Result title to inspect.
 * @returns `FORMAT_CONFLICT_PENALTY` on conflict, otherwise `0`.
 * @source
 */
const getFormatConflictPenalty = (format: string, resultTitle: string) => {
  if (!format) return 0
  const normalizedFormat = normalizeText(format)
  if (!normalizedFormat) return 0

  const normalizedTitle = normalizeText(resultTitle)
  const isMangaFormat = normalizedFormat.includes("manga")
  const isLightNovelFormat =
    normalizedFormat.includes("light novel") ||
    (normalizedFormat.includes("novel") &&
      !normalizedFormat.includes("graphic"))

  if (isMangaFormat && normalizedTitle.includes("light novel")) {
    return FORMAT_CONFLICT_PENALTY
  }

  if (isLightNovelFormat && normalizedTitle.includes("manga")) {
    return FORMAT_CONFLICT_PENALTY
  }

  return 0
}

/**
 * Truncates and trims a nullable input string to the given max length.
 * @param value - Raw input value.
 * @param maxLength - Maximum allowed character length.
 * @returns Sanitized string, empty if `null`.
 * @source
 */
const sanitizeInput = (value: string | null, maxLength: number) => {
  const trimmed = value?.trim() ?? ""
  return trimmed.slice(0, maxLength)
}

/**
 * Resolves a user-supplied Amazon domain string to a valid `AmazonDomain` key.
 * @param value - Raw domain input (e.g. `"amazon.co.uk"`).
 * @returns Resolved domain key, defaulting to `"amazon.com"`.
 * @source
 */
const resolveAmazonDomain = (value: string | null): AmazonDomain => {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/^https?:\/\//g, "")
    .replaceAll(/^www\./g, "")
  if (normalized in AMAZON_DOMAINS) {
    return normalized as AmazonDomain
  }
  return "amazon.com"
}

export const createAmazonSearchContext = (searchParams: URLSearchParams) => {
  const title = sanitizeInput(searchParams.get("title"), MAX_TITLE_LENGTH)
  if (!title) {
    throw new ApiError(400, "Missing title")
  }

  const volumeTitle = sanitizeInput(
    searchParams.get("volumeTitle"),
    MAX_VOLUME_TITLE_LENGTH
  )

  const domain = resolveAmazonDomain(searchParams.get("domain"))
  const host = AMAZON_DOMAINS[domain]

  const volumeParam = searchParams.get("volume")?.trim() ?? ""
  const format = sanitizeInput(searchParams.get("format"), MAX_FORMAT_LENGTH)
  const binding = sanitizeInput(searchParams.get("binding"), 40)
  const fallbackToKindle = searchParams.get("fallbackToKindle") === "true"

  const volumeNumber = Number.parseInt(volumeParam, 10)
  const resolvedVolumeNumber = Number.isFinite(volumeNumber)
    ? volumeNumber
    : null
  const volumeLabel = resolvedVolumeNumber
    ? `Volume ${resolvedVolumeNumber}`
    : null
  const bindingLabel = binding || DEFAULT_BINDING
  const bindingLabels = resolveBindingLabels(bindingLabel, fallbackToKindle)
  const volumeSubtitle = extractVolumeSubtitle(
    volumeTitle,
    title,
    resolvedVolumeNumber,
    format,
    bindingLabel
  )

  const searchTokens = [title, volumeLabel, format, bindingLabel].filter(
    Boolean
  )
  const expectedTokens = [title, volumeLabel, format, volumeSubtitle].filter(
    Boolean
  )
  const requiredTokens = [title, volumeLabel].filter(Boolean)
  const searchQuery = searchTokens.join(" ").slice(0, MAX_QUERY_LENGTH)
  const expectedTitle = expectedTokens.join(" ")
  const requiredTitle = requiredTokens.join(" ")

  const url = new URL(`https://${host}${AMAZON_SEARCH_PATH}`)
  url.searchParams.set("k", searchQuery)

  debugLog("Amazon search context resolved", {
    domain,
    host,
    title,
    volumeTitle,
    volumeSubtitle,
    volumeNumber: resolvedVolumeNumber,
    format,
    bindingLabel,
    bindingLabels,
    fallbackToKindle,
    searchQuery,
    searchUrl: url.toString()
  })

  return {
    domain,
    host,
    title,
    expectedTitle,
    requiredTitle,
    format,
    bindingLabel,
    bindingLabels,
    fallbackToKindle,
    volumeNumber: resolvedVolumeNumber,
    volumeTitle,
    volumeSubtitle,
    searchUrl: url.toString()
  } satisfies SearchContext
}

/**
 * Fetches a URL with an abort-signal timeout.
 * @param url - Target URL.
 * @param options - Standard `RequestInit` options.
 * @param timeoutMs - Timeout in milliseconds.
 * @returns The upstream `Response`.
 * @source
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs: number
) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Detects whether HTML contains Amazon captcha / bot-gate markers.
 * @param html - Raw HTML string.
 * @returns `true` if the page appears to be a bot challenge.
 * @source
 */
const isLikelyBotGate = (html: string) => {
  const lower = html.toLowerCase()
  return (
    lower.includes("captcha") ||
    lower.includes("robot check") ||
    lower.includes("automated access")
  )
}

export const fetchAmazonHtml = async (searchUrl: string) => {
  const fetchStart = performance.now()
  let response: Response
  try {
    debugLog("Fetching Amazon search HTML", { searchUrl })
    response = await fetchWithTimeout(
      searchUrl,
      {
        cache: "no-store",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "accept-language": "en-US,en;q=0.9"
        }
      },
      FETCH_TIMEOUT_MS
    )
  } catch (error) {
    const fetchMs = Math.round(performance.now() - fetchStart)
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("Error fetching Amazon search page", {
      searchUrl,
      message,
      fetchMs
    })
    throw new ApiError(502, `Amazon request failed: ${message}`)
  }

  if (!response.ok) {
    const fetchMs = Math.round(performance.now() - fetchStart)
    console.error("Amazon response not ok", {
      searchUrl,
      status: response.status,
      statusText: response.statusText,
      fetchMs
    })
    throw new ApiError(502, `Amazon request failed (${response.status})`)
  }

  const html = await response.text()
  const fetchMs = Math.round(performance.now() - fetchStart)
  debugLog("Fetched Amazon HTML", { length: html.length, fetchMs })
  if (isLikelyBotGate(html)) {
    console.error("Amazon bot detection triggered", { searchUrl, fetchMs })
    throw new ApiError(429, "Amazon blocked the request (captcha/robot check)")
  }

  return html
}

/**
 * Extracts non-sponsored search result elements from parsed HTML.
 * @param $ - Cheerio API instance.
 * @returns Array of result `Element` nodes (capped at `MAX_RESULTS_TO_SCORE`).
 * @throws {ApiError} When the search root or results are missing.
 * @source
 */
const getSearchResults = ($: cheerio.CheerioAPI) => {
  const searchRoot = $("#search")
  if (!searchRoot.length) {
    console.error("Amazon search root not found")
    throw new ApiError(502, "Amazon search results not found")
  }

  const results = searchRoot
    .find('div[data-component-type="s-search-result"]')
    .filter((_: number, el: Element) => $(el).attr("data-ad") !== "true")

  if (!results.length) {
    throw new ApiError(404, "No search results found")
  }

  debugLog("Amazon search results extracted", {
    totalResults: results.length,
    scoringResults: Math.min(results.length, MAX_RESULTS_TO_SCORE)
  })

  return results.slice(0, MAX_RESULTS_TO_SCORE).toArray()
}

/**
 * Extracts the product title text from a search result element.
 * @param result - Cheerio-wrapped result element.
 * @returns The cleaned title string.
 * @throws {ApiError} When no title can be found.
 * @source
 */
const extractResultTitle = (result: cheerio.Cheerio<Element>) => {
  // Prefer explicit title spans inside h2 > a to avoid brittle index-based fallbacks.
  const titleNode = result
    .find("h2 a span.a-text-normal, h2 a span.a-size-medium, h2 a span")
    .first()
  const h2s = result.find("h2")
  let fallbackNode = titleNode
  if (!fallbackNode.length) {
    fallbackNode = h2s.eq(1).length ? h2s.eq(1) : h2s.first()
  }
  const resultTitle = fallbackNode.text().replaceAll(/\s+/g, " ").trim()

  if (!resultTitle) {
    console.error("Could not extract title from Amazon result", {
      html: result.html()
    })
    throw new ApiError(502, "Could not extract result title")
  }

  return resultTitle
}

/**
 * Checks whether a link's text matches a binding label.
 * @param text - Link text from the Amazon result.
 * @param label - Expected binding label.
 * @returns `true` if the text matches or starts with the label.
 * @source
 */
const matchesBindingLabel = (text: string, label: string) => {
  const normalizedText = normalizeBindingLabel(text)
  const normalizedLabel = normalizeBindingLabel(label)
  if (!normalizedText || !normalizedLabel) return false
  return (
    normalizedText === normalizedLabel ||
    normalizedText.startsWith(`${normalizedLabel} `)
  )
}

/**
 * Finds the first link in a result that matches one of the binding labels.
 * @param $ - Cheerio API instance.
 * @param result - Cheerio-wrapped result element.
 * @param bindingLabels - Ordered list of binding labels to try.
 * @returns The matched link and its label.
 * @throws {ApiError} When no matching binding link is found.
 * @source
 */
const findBindingLink = (
  $: cheerio.CheerioAPI,
  result: cheerio.Cheerio<Element>,
  bindingLabels: string[]
): BindingMatch => {
  for (const bindingLabel of bindingLabels) {
    const link = result
      .find("a")
      .filter((_: number, el: Element) => {
        const text = $(el).text().replaceAll(/\s+/g, " ").trim()
        return text ? matchesBindingLabel(text, bindingLabel) : false
      })
      .first()

    if (link.length) {
      return { link, label: bindingLabel }
    }
  }

  throw new ApiError(
    404,
    `No ${bindingLabels.length > 1 ? "matching" : bindingLabels[0]} option found`
  )
}

/**
 * Extracts a price string from the result DOM near the matched binding link.
 * @param result - Cheerio-wrapped result element.
 * @param bindingLink - The matched binding link element.
 * @returns The extracted price text.
 * @throws {ApiError} When no price text is found.
 * @source
 */
const extractPriceText = (
  result: cheerio.Cheerio<Element>,
  bindingLink: cheerio.Cheerio<Element>
) => {
  const bindingContainer = bindingLink.closest("div")
  const priceContainer = bindingContainer
    .find("span.a-price span.a-offscreen")
    .first()
  const primaryPrice = priceContainer.text().replaceAll(/\s+/g, " ").trim()

  const nearbyPrice = bindingContainer
    .parent()
    .find("span.a-price span.a-offscreen")
    .first()
    .text()
    .replaceAll(/\s+/g, " ")
    .trim()

  const siblingPrice = bindingContainer
    .nextAll("div")
    .find("span.a-price span.a-offscreen")
    .first()
    .text()
    .replaceAll(/\s+/g, " ")
    .trim()

  const fallbackPrice = result
    .find("span.a-price span.a-offscreen")
    .first()
    .text()
    .replaceAll(/\s+/g, " ")
    .trim()

  const priceText = primaryPrice || nearbyPrice || siblingPrice || fallbackPrice

  debugLog("Amazon price candidates", {
    primaryPrice,
    nearbyPrice,
    siblingPrice,
    fallbackPrice,
    selectedPrice: priceText
  })

  if (!primaryPrice) {
    const resultSnippet = result
      .text()
      .replaceAll(/\s+/g, " ")
      .trim()
      .slice(0, 200)
    const bindingLinkHtml = bindingLink.html()
    debugLog("Amazon price selector fallback", {
      bindingHref: bindingLink.attr("href") ?? null,
      bindingLinkHtml: bindingLinkHtml ? bindingLinkHtml.slice(0, 160) : null,
      primaryPrice,
      nearbyPrice,
      siblingPrice,
      fallbackPrice,
      resultSnippet
    })
  }

  if (!priceText) {
    throw new ApiError(404, "Price not found")
  }

  return priceText
}

/**
 * Infers the decimal separator from a normalized price string and host locale.
 * @param normalized - Price string with only digits, commas, and dots.
 * @param host - Fully qualified Amazon hostname.
 * @returns `"."`, `","`, or `null` if no separator is detected.
 * @source
 */
const getDecimalSeparator = (normalized: string, host: string) => {
  const lastDot = normalized.lastIndexOf(".")
  const lastComma = normalized.lastIndexOf(",")
  const isCommaDecimalHost = COMMA_DECIMAL_HOSTS.has(host)

  if (lastDot !== -1 && lastComma !== -1) {
    return lastDot > lastComma ? "." : ","
  }

  if (lastComma !== -1) {
    return isCommaDecimalHost || /,\d{1,2}$/.test(normalized) ? "," : null
  }

  if (lastDot !== -1) {
    return !isCommaDecimalHost || /\.\d{1,2}$/.test(normalized) ? "." : null
  }

  return null
}

/**
 * Parses a locale-aware price string into a numeric value.
 * @param priceText - Raw price text (e.g. `"$12.99"`, `"14,99 €"`).
 * @param host - Fully qualified Amazon hostname for locale inference.
 * @returns Parsed float, or `null` if unparseable.
 * @source
 */
const parsePriceValue = (priceText: string, host: string) => {
  const normalized = priceText.replaceAll(/[^\d.,]+/g, "")
  if (!normalized) return null

  const decimalSeparator = getDecimalSeparator(normalized, host)
  let numeric = normalized

  if (decimalSeparator) {
    const groupingSeparator = decimalSeparator === "." ? "," : "."
    numeric = numeric.replaceAll(groupingSeparator, "")
    if (decimalSeparator === ",") {
      numeric = numeric.replaceAll(",", ".")
    }
  } else {
    numeric = numeric.replaceAll(/[.,]/g, "")
  }

  if (!numeric) return null
  const value = Number.parseFloat(numeric)
  return Number.isFinite(value) ? value : null
}

/**
 * Detects the currency from a price string, falling back to the host's default.
 * @param priceText - Raw price text.
 * @param host - Fully qualified Amazon hostname.
 * @returns ISO 4217 currency code, or `null`.
 * @source
 */
const detectCurrency = (priceText: string, host: string) => {
  const normalized = priceText.toUpperCase()
  if (normalized.includes("CA$") || normalized.includes("C$")) return "CAD"
  if (normalized.includes("¥")) return "JPY"
  if (normalized.includes("£")) return "GBP"
  if (normalized.includes("€")) return "EUR"
  if (normalized.includes("$")) return "USD"

  const hostCurrencyMap: Record<string, string> = {
    "www.amazon.com": "USD",
    "www.amazon.co.uk": "GBP",
    "www.amazon.ca": "CAD",
    "www.amazon.de": "EUR",
    "www.amazon.co.jp": "JPY"
  }

  return hostCurrencyMap[host] ?? null
}

/**
 * Attempts to extract a price from a single scored result.
 * @param $ - Cheerio API instance.
 * @param candidate - The scored result to extract from.
 * @param bindingLabels - Binding labels to try.
 * @param host - Amazon hostname for price parsing.
 * @returns Price data without the candidate, or `null` if no price is found.
 * @source
 */
const getPriceForCandidate = (
  $: cheerio.CheerioAPI,
  candidate: ScoredResult,
  bindingLabels: string[],
  host: string
): Omit<PricedCandidate, "candidate"> | null => {
  try {
    const bindingMatch = findBindingLink($, candidate.result, bindingLabels)
    const priceText = extractPriceText(candidate.result, bindingMatch.link)
    const priceValue = parsePriceValue(priceText, host)
    const currency = detectCurrency(priceText, host)
    debugLog("Parsed Amazon price", {
      title: candidate.resultTitle,
      priceText,
      priceValue,
      currency,
      bindingLabel: bindingMatch.label
    })
    return {
      priceText,
      priceValue,
      currency,
      bindingLabel: bindingMatch.label
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      debugLog("Amazon result missing price", {
        title: candidate.resultTitle,
        index: candidate.index,
        message: error.message
      })
      return null
    }
    throw error
  }
}

/**
 * Iterates scored candidates to find the first one with an extractable price.
 * @param $ - Cheerio API instance.
 * @param candidates - Ranked scored results.
 * @param bindingLabels - Binding labels to try.
 * @param host - Amazon hostname for price parsing.
 * @returns The first priced candidate, or `null`.
 * @source
 */
const findPricedCandidate = (
  $: cheerio.CheerioAPI,
  candidates: ScoredResult[],
  bindingLabels: string[],
  host: string
): PricedCandidate | null => {
  for (const candidate of candidates) {
    const price = getPriceForCandidate($, candidate, bindingLabels, host)
    if (!price) continue
    return { candidate, ...price }
  }
  return null
}

/**
 * Selects the best priced result, applying fallback logic when image mode is active.
 * @param input - Price selection parameters.
 * @returns A `PriceSelection` with the chosen candidate and its price data.
 * @source
 */
const resolvePriceSelection = ({
  $,
  includePrice,
  includeImage,
  selected,
  eligibleCandidates,
  bindingLabels,
  host,
  priceErrorMessage
}: PriceSelectionInput): PriceSelection => {
  if (!includePrice) {
    return {
      selected,
      priceText: null,
      priceValue: null,
      currency: null,
      priceBinding: null,
      priceError: null
    }
  }

  if (includeImage) {
    const price = getPriceForCandidate($, selected, bindingLabels, host)
    if (price) {
      return {
        selected,
        priceText: price.priceText,
        priceValue: price.priceValue,
        currency: price.currency,
        priceBinding: price.bindingLabel,
        priceError: null
      }
    }
    const fallbackCandidates = eligibleCandidates.filter(
      (candidate) =>
        candidate.index !== selected.index &&
        Math.abs(candidate.combinedScore - selected.combinedScore) < 0.000001
    )
    const fallback = findPricedCandidate(
      $,
      fallbackCandidates,
      bindingLabels,
      host
    )
    if (fallback) {
      return {
        selected: fallback.candidate,
        priceText: fallback.priceText,
        priceValue: fallback.priceValue,
        currency: fallback.currency,
        priceBinding: fallback.bindingLabel,
        priceError: null
      }
    }
    return {
      selected,
      priceText: null,
      priceValue: null,
      currency: null,
      priceBinding: null,
      priceError: priceErrorMessage
    }
  }

  const priced = findPricedCandidate($, eligibleCandidates, bindingLabels, host)
  if (priced) {
    return {
      selected: priced.candidate,
      priceText: priced.priceText,
      priceValue: priced.priceValue,
      currency: priced.currency,
      priceBinding: priced.bindingLabel,
      priceError: null
    }
  }

  return {
    selected,
    priceText: null,
    priceValue: null,
    currency: null,
    priceBinding: null,
    priceError: priceErrorMessage
  }
}

/**
 * Extracts the canonical product URL from a search result, preferring ASIN-based URLs.
 * @param result - Cheerio-wrapped result element.
 * @param host - Fully qualified Amazon hostname.
 * @returns Absolute product URL, or `null`.
 * @source
 */
const extractProductUrl = (result: cheerio.Cheerio<Element>, host: string) => {
  const productPath = result.find("h2 a").first().attr("href")
  const asin = result.attr("data-asin")?.trim()
  if (asin) {
    return `https://${host}/dp/${asin}`
  }

  if (productPath) {
    try {
      const url = new URL(productPath, `https://${host}`)
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.toString()
      }
    } catch {
      // fall through to alternative selectors
    }
  }

  const fallbackPath = result
    .find("a.a-link-normal.s-no-outline, a.a-link-normal")
    .first()
    .attr("href")
  if (!fallbackPath) return null

  try {
    const url = new URL(fallbackPath, `https://${host}`)
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString()
    }
  } catch {
    // ignore invalid URLs
  }

  return null
}

/**
 * Extracts the full-resolution product image URL from a search result.
 * @param result - Cheerio-wrapped result element.
 * @returns Full-size image URL, or `null`.
 * @source
 */
const extractImageUrl = (result: cheerio.Cheerio<Element>) => {
  const img = result.find("img.s-image").first()
  const src = img.attr("src") ?? img.attr("data-src") ?? ""
  if (!src) return null
  return getFullSizeImageUrl(src)
}

export const parseAmazonResult = (
  html: string,
  context: SearchContext,
  options: { includePrice: boolean; includeImage: boolean }
): AmazonPriceParseResult => {
  const subtitleWeight = context.volumeSubtitle ? 0.35 : 0
  const bindingLabels = context.bindingLabels.length
    ? context.bindingLabels
    : [context.bindingLabel]
  const priceErrorMessage = bindingLabels.length
    ? `No ${bindingLabels.join(" or ")} price found`
    : "Price not found"

  const $ = cheerio.load(html)

  const resultElements = getSearchResults($)

  debugLog(
    `Scoring top ${resultElements.length} Amazon results against expected title`,
    {
      expectedTitle: context.expectedTitle,
      requiredTitle: context.requiredTitle,
      volumeSubtitle: context.volumeSubtitle,
      results: resultElements.map((el) => extractResultTitle($(el)))
    }
  )

  const scoredResults = resultElements
    .map((el, index) => {
      try {
        const result = $(el)
        const resultTitle = extractResultTitle(result)
        const strictScore = similarityScore(
          context.expectedTitle || context.title,
          resultTitle
        )
        const requiredScore = tokenCoverageScore(
          context.requiredTitle || context.title,
          resultTitle
        )
        const matchScore = Math.max(strictScore, requiredScore)
        const baseTitleScore = tokenCoverageScore(context.title, resultTitle)
        const volumeTitleScore = context.volumeTitle
          ? similarityScore(context.volumeTitle, resultTitle)
          : 0
        const subtitleScore = context.volumeSubtitle
          ? tokenCoverageScore(context.volumeSubtitle, resultTitle)
          : 0
        const modifierPenalty = getPrefixModifierPenalty(context, resultTitle)
        const formatConflictPenalty = getFormatConflictPenalty(
          context.format,
          resultTitle
        )
        const extraTokenPenalty = getExtraTokenPenalty(context, resultTitle)
        const volumeMismatchPenalty = getVolumeMismatchPenalty(
          context,
          resultTitle
        )
        const combinedScore =
          matchScore +
          subtitleScore * subtitleWeight -
          modifierPenalty +
          baseTitleScore * BASE_TITLE_WEIGHT +
          volumeTitleScore * VOLUME_TITLE_WEIGHT -
          formatConflictPenalty -
          extraTokenPenalty -
          volumeMismatchPenalty
        const hasVolumeMatch = context.volumeNumber
          ? hasExactVolumeMatch(resultTitle, context.volumeNumber)
          : true

        return {
          result,
          resultTitle,
          strictScore,
          requiredScore,
          matchScore,
          baseTitleScore,
          volumeTitleScore,
          subtitleScore,
          modifierPenalty,
          formatConflictPenalty,
          extraTokenPenalty,
          volumeMismatchPenalty,
          combinedScore,
          hasVolumeMatch,
          index
        } satisfies ScoredResult
      } catch (error) {
        skippedResults += 1
        debugLog("Skipped unparseable Amazon result", {
          index,
          error: error instanceof Error ? error.message : String(error)
        })
        return null
      }
    })
    .filter((item): item is ScoredResult => item !== null)

  if (!scoredResults.length) {
    throw new ApiError(404, "No search results found")
  }

  let candidates = scoredResults
  if (
    context.volumeNumber &&
    scoredResults.some((item) => item.hasVolumeMatch)
  ) {
    candidates = scoredResults.filter(
      (item) =>
        item.hasVolumeMatch ||
        item.volumeMismatchPenalty === 0 ||
        item.baseTitleScore >= BASE_TITLE_MATCH_THRESHOLD
    )
  }

  const rankedCandidates = [...candidates].sort((a, b) => {
    if (b.combinedScore !== a.combinedScore) {
      return b.combinedScore - a.combinedScore
    }
    if (a.modifierPenalty !== b.modifierPenalty) {
      return a.modifierPenalty - b.modifierPenalty
    }
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore
    return a.index - b.index
  })

  const best = rankedCandidates[0] ?? null

  if (!best) {
    throw new ApiError(404, "No search results found")
  }

  const meetsMatchThreshold =
    best.strictScore >= MATCH_THRESHOLD ||
    best.requiredScore >= REQUIRED_MATCH_THRESHOLD ||
    best.baseTitleScore >= BASE_TITLE_MATCH_THRESHOLD

  if (!meetsMatchThreshold) {
    throw new ApiError(404, "Top result did not match expected title", {
      matchScore: best.matchScore,
      strictScore: best.strictScore,
      requiredScore: best.requiredScore,
      baseTitleScore: best.baseTitleScore,
      resultTitle: best.resultTitle
    })
  }

  const eligibleCandidates = rankedCandidates.filter(
    (item) =>
      item.strictScore >= MATCH_THRESHOLD ||
      item.requiredScore >= REQUIRED_MATCH_THRESHOLD ||
      item.baseTitleScore >= BASE_TITLE_MATCH_THRESHOLD
  )

  const priceSelection = resolvePriceSelection({
    $,
    includePrice: options.includePrice,
    includeImage: options.includeImage,
    selected: best,
    eligibleCandidates,
    bindingLabels,
    host: context.host,
    priceErrorMessage
  })

  const selected = priceSelection.selected
  const productUrl = extractProductUrl(selected.result, context.host)
  const imageUrl = options.includeImage
    ? extractImageUrl(selected.result)
    : null

  return {
    resultTitle: selected.resultTitle,
    matchScore: selected.matchScore,
    priceText: priceSelection.priceText,
    priceValue: priceSelection.priceValue,
    currency: priceSelection.currency,
    priceBinding: priceSelection.priceBinding,
    priceError: priceSelection.priceError,
    productUrl,
    imageUrl
  }
}
