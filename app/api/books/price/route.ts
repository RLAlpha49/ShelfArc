import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import type { Element } from "domhandler"
import {
  isRateLimited,
  recordFailure,
  getCooldownRemaining
} from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

// Set to `true` to enable detailed debug logging of the search result scoring process.
const DEBUG = false

const debugLog = (...args: Parameters<typeof console.debug>) => {
  if (DEBUG) {
    console.debug(...args)
  }
}

const AMAZON_SEARCH_PATH = "/s"
const DEFAULT_BINDING = "Paperback"
const KINDLE_BINDING_LABELS = ["Kindle", "Kindle Edition"]
const HARDCOVER_BINDING_LABELS = ["Hardcover", "Hardback"]
const FETCH_TIMEOUT_MS = 12000
const MATCH_THRESHOLD = 0.6
const REQUIRED_MATCH_THRESHOLD = 0.8
const BASE_TITLE_MATCH_THRESHOLD = 0.9
const BASE_TITLE_WEIGHT = 0.2
const VOLUME_TITLE_WEIGHT = 0.35
const FORMAT_CONFLICT_PENALTY = 0.4
const EXTRA_TOKEN_PENALTY = 0.08
const MAX_EXTRA_TOKEN_PENALTY = 0.45
const MAX_RESULTS_TO_SCORE = 12
const MAX_TITLE_LENGTH = 200
const MAX_VOLUME_TITLE_LENGTH = 200
const MAX_FORMAT_LENGTH = 80
const MAX_QUERY_LENGTH = 260

const RATE_LIMIT_KEY = "amazon-scrape"
const RATE_LIMIT_CONFIG = {
  maxFailures: 3,
  failureWindowMs: 5 * 60 * 1000, // 5 minutes
  cooldownMs: 10 * 60 * 1000 // 10-minute cooldown after 3 captcha blocks
} as const

/**
 * Amazon product image URLs contain a suffix like `._AC_UY218_.jpg`.
 * Stripping everything after the ASIN-style image ID yields the full-res image.
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

const AMAZON_DOMAINS = {
  "amazon.com": "www.amazon.com",
  "amazon.co.uk": "www.amazon.co.uk",
  "amazon.ca": "www.amazon.ca",
  "amazon.de": "www.amazon.de",
  "amazon.co.jp": "www.amazon.co.jp"
} as const

const COMMA_DECIMAL_HOSTS = new Set<string>(["www.amazon.de"])

type AmazonDomain = keyof typeof AMAZON_DOMAINS

class ApiError extends Error {
  status: number
  details?: Record<string, unknown>

  constructor(
    status: number,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.status = status
    this.details = details
  }
}

const jsonError = (error: ApiError) => {
  const payload = error.details
    ? { error: error.message, ...error.details }
    : { error: error.message }
  return NextResponse.json(payload, { status: error.status })
}

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

const normalizeBindingLabel = (value: string) => normalizeText(value)

const isKindleBinding = (bindingLabel: string) => {
  const normalized = normalizeBindingLabel(bindingLabel)
  return normalized.includes("kindle")
}

const isPaperbackBinding = (bindingLabel: string) => {
  const normalized = normalizeBindingLabel(bindingLabel)
  return normalized.includes("paperback")
}

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

const tokenize = (value: string) => {
  const tokens = normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 || /^\d+$/.test(token))
  return new Set(tokens)
}

const tokenizeOrdered = (value: string) => {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 || /^\d+$/.test(token))
}

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
    blockedTokens.add(volumeNumber.toString())
  }

  const subtitleTokens = [...volumeTokens].filter(
    (token) => !blockedTokens.has(token)
  )

  return subtitleTokens.join(" ")
}

const hasExactVolumeMatch = (title: string, volumeNumber: number) => {
  const lower = title.toLowerCase()
  const explicitPattern = new RegExp(
    String.raw`\bvol(?:ume)?\.?\s*${volumeNumber}\b(?!\s*(?:-|–|—|to)\s*\d)`,
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

  const standalonePattern = new RegExp(String.raw`\b${volumeNumber}\b`)
  const hasStandalone = standalonePattern.test(lower)
  return hasStandalone && !inRange
}

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

const getPrefixModifierPenalty = (
  context: SearchContext,
  resultTitle: string
) => {
  if (!context.volumeNumber) return 0

  const tokens = tokenizeOrdered(resultTitle)
  const volumeToken = context.volumeNumber.toString()
  const volumeIndex = tokens.indexOf(volumeToken)
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

  const extraTokens = prefixTokens.filter(
    (token) => !allowedTokens.has(token) && !PREFIX_IGNORED_TOKENS.has(token)
  )

  if (!extraTokens.length) return 0

  return Math.min(0.45, extraTokens.length * 0.2)
}

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
    allowedTokens.add(context.volumeNumber.toString())
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

const sanitizeInput = (value: string | null, maxLength: number) => {
  const trimmed = value?.trim() ?? ""
  return trimmed.slice(0, maxLength)
}

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

const isLikelyBotGate = (html: string) => {
  const lower = html.toLowerCase()
  return (
    lower.includes("captcha") ||
    lower.includes("robot check") ||
    lower.includes("automated access")
  )
}

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

const getSearchContext = (request: NextRequest) => {
  const title = sanitizeInput(
    request.nextUrl.searchParams.get("title"),
    MAX_TITLE_LENGTH
  )
  if (!title) {
    throw new ApiError(400, "Missing title")
  }

  const volumeTitle = sanitizeInput(
    request.nextUrl.searchParams.get("volumeTitle"),
    MAX_VOLUME_TITLE_LENGTH
  )

  const domain = resolveAmazonDomain(request.nextUrl.searchParams.get("domain"))
  const host = AMAZON_DOMAINS[domain]

  const volumeParam = request.nextUrl.searchParams.get("volume")?.trim() ?? ""
  const format = sanitizeInput(
    request.nextUrl.searchParams.get("format"),
    MAX_FORMAT_LENGTH
  )
  const binding = sanitizeInput(request.nextUrl.searchParams.get("binding"), 40)
  const fallbackToKindle =
    request.nextUrl.searchParams.get("fallbackToKindle") === "true"

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
  }
}

type SearchContext = ReturnType<typeof getSearchContext>

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
  combinedScore: number
  hasVolumeMatch: boolean
  index: number
}

type PricedCandidate = {
  candidate: ScoredResult
  priceText: string
  priceValue: number | null
  currency: string | null
  bindingLabel: string
}

type BindingMatch = {
  link: cheerio.Cheerio<Element>
  label: string
}

type PriceSelection = {
  selected: ScoredResult
  priceText: string | null
  priceValue: number | null
  currency: string | null
  priceBinding: string | null
  priceError: string | null
}

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

const fetchAmazonHtml = async (searchUrl: string) => {
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
    const message = error instanceof Error ? error.message : "Unknown error"
    throw new ApiError(502, `Amazon request failed: ${message}`)
  }

  if (!response.ok) {
    debugLog("Amazon response not ok", {
      status: response.status,
      statusText: response.statusText
    })
    throw new ApiError(502, `Amazon request failed (${response.status})`)
  }

  const html = await response.text()
  debugLog("Fetched Amazon HTML", { length: html.length })
  if (isLikelyBotGate(html)) {
    throw new ApiError(429, "Amazon blocked the request (captcha/robot check)")
  }

  return html
}

const getSearchResults = ($: cheerio.CheerioAPI) => {
  const searchRoot = $("#search")
  if (!searchRoot.length) {
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
    throw new ApiError(502, "Could not extract result title")
  }

  return resultTitle
}

const matchesBindingLabel = (text: string, label: string) => {
  const normalizedText = normalizeBindingLabel(text)
  const normalizedLabel = normalizeBindingLabel(label)
  if (!normalizedText || !normalizedLabel) return false
  return (
    normalizedText === normalizedLabel ||
    normalizedText.startsWith(`${normalizedLabel} `)
  )
}

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

const extractProductUrl = (result: cheerio.Cheerio<Element>, host: string) => {
  const productPath = result.find("h2 a").first().attr("href")
  return productPath ? new URL(productPath, `https://${host}`).toString() : null
}

const extractImageUrl = (result: cheerio.Cheerio<Element>) => {
  const img = result.find("img.s-image").first()
  const src = img.attr("src") ?? img.attr("data-src") ?? ""
  if (!src) return null
  return getFullSizeImageUrl(src)
}

const parseAmazonResult = (
  html: string,
  context: SearchContext,
  options: { includePrice: boolean; includeImage: boolean }
) => {
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
  const scoredResults = resultElements.map((el, index) => {
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
    const combinedScore =
      matchScore +
      subtitleScore * subtitleWeight -
      modifierPenalty +
      baseTitleScore * BASE_TITLE_WEIGHT +
      volumeTitleScore * VOLUME_TITLE_WEIGHT -
      formatConflictPenalty -
      extraTokenPenalty
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
      combinedScore,
      hasVolumeMatch,
      index
    }
  })

  let candidates = scoredResults
  if (
    context.volumeNumber &&
    scoredResults.some((item) => item.hasVolumeMatch)
  ) {
    candidates = scoredResults.filter(
      (item) =>
        item.hasVolumeMatch || item.baseTitleScore >= BASE_TITLE_MATCH_THRESHOLD
    )
  }

  debugLog("Scored Amazon results", {
    candidates: candidates.map((item) => ({
      title: item.resultTitle,
      strictScore: item.strictScore.toFixed(2),
      requiredScore: item.requiredScore.toFixed(2),
      matchScore: item.matchScore.toFixed(2),
      baseTitleScore: item.baseTitleScore.toFixed(2),
      volumeTitleScore: item.volumeTitleScore.toFixed(2),
      subtitleScore: item.subtitleScore.toFixed(2),
      modifierPenalty: item.modifierPenalty.toFixed(2),
      formatConflictPenalty: item.formatConflictPenalty.toFixed(2),
      extraTokenPenalty: item.extraTokenPenalty.toFixed(2),
      combinedScore: item.combinedScore.toFixed(2),
      index: item.index
    }))
  })

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

  debugLog("Top matched Amazon result", {
    title: best.resultTitle,
    strictScore: best.strictScore,
    requiredScore: best.requiredScore,
    matchScore: best.matchScore,
    baseTitleScore: best.baseTitleScore,
    volumeTitleScore: best.volumeTitleScore,
    subtitleScore: best.subtitleScore,
    modifierPenalty: best.modifierPenalty,
    formatConflictPenalty: best.formatConflictPenalty,
    extraTokenPenalty: best.extraTokenPenalty,
    combinedScore: best.combinedScore,
    index: best.index
  })

  const meetsMatchThreshold =
    best.strictScore >= MATCH_THRESHOLD ||
    best.requiredScore >= REQUIRED_MATCH_THRESHOLD ||
    best.baseTitleScore >= BASE_TITLE_MATCH_THRESHOLD

  if (!meetsMatchThreshold) {
    debugLog("Match score below threshold", {
      strictScore: best.strictScore,
      requiredScore: best.requiredScore,
      matchScore: best.matchScore,
      baseTitleScore: best.baseTitleScore,
      resultTitle: best.resultTitle
    })
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
  const priceText = priceSelection.priceText
  const priceValue = priceSelection.priceValue
  const currency = priceSelection.currency
  const priceError = priceSelection.priceError
  const priceBinding = priceSelection.priceBinding

  debugLog("Selected Amazon result", {
    title: selected.resultTitle,
    strictScore: selected.strictScore,
    requiredScore: selected.requiredScore,
    matchScore: selected.matchScore,
    baseTitleScore: selected.baseTitleScore,
    volumeTitleScore: selected.volumeTitleScore,
    subtitleScore: selected.subtitleScore,
    modifierPenalty: selected.modifierPenalty,
    formatConflictPenalty: selected.formatConflictPenalty,
    extraTokenPenalty: selected.extraTokenPenalty,
    combinedScore: selected.combinedScore,
    index: selected.index,
    priceBinding,
    priceError
  })

  const productUrl = extractProductUrl(selected.result, context.host)
  const imageUrl = options.includeImage
    ? extractImageUrl(selected.result)
    : null

  return {
    resultTitle: selected.resultTitle,
    matchScore: selected.matchScore,
    priceText,
    priceValue,
    currency,
    priceBinding,
    priceError,
    productUrl,
    imageUrl
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check rate-limit cooldown before making any outbound request
    if (isRateLimited(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)) {
      const remaining = getCooldownRemaining(RATE_LIMIT_KEY)
      const minutes = Math.ceil(remaining / 60_000)
      debugLog("Amazon scrape blocked by cooldown", {
        remainingMs: remaining,
        minutes
      })
      return NextResponse.json(
        {
          error: `Amazon scraping is temporarily disabled due to anti-bot detection. Try again in ~${minutes} minute${minutes === 1 ? "" : "s"}.`,
          cooldownMs: remaining
        },
        { status: 429 }
      )
    }

    const includeImage =
      request.nextUrl.searchParams.get("includeImage") === "true"
    const includePrice =
      request.nextUrl.searchParams.get("includePrice") !== "false"

    debugLog("Amazon price lookup request", { includeImage, includePrice })

    const context = getSearchContext(request)
    const html = await fetchAmazonHtml(context.searchUrl)
    const parsed = parseAmazonResult(html, context, {
      includePrice,
      includeImage
    })

    return NextResponse.json({
      searchUrl: context.searchUrl,
      domain: context.domain,
      expectedTitle: context.expectedTitle,
      matchScore: parsed.matchScore,
      binding: context.bindingLabel,
      result: {
        title: parsed.resultTitle,
        priceText: parsed.priceText,
        priceValue: parsed.priceValue,
        currency: parsed.currency,
        priceBinding: parsed.priceBinding,
        priceError: parsed.priceError,
        url: parsed.productUrl,
        imageUrl: parsed.imageUrl
      }
    })
  } catch (error) {
    if (error instanceof ApiError) {
      debugLog("Amazon price lookup error", {
        status: error.status,
        message: error.message,
        details: error.details ?? null
      })
      // Record captcha / bot-gate failures toward cooldown
      if (error.status === 429) {
        recordFailure(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)
      }
      return jsonError(error)
    }

    console.error("Amazon price lookup failed", error)
    return NextResponse.json(
      { error: "Amazon price lookup failed" },
      { status: 500 }
    )
  }
}
