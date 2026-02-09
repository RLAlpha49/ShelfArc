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
const FETCH_TIMEOUT_MS = 12000
const MATCH_THRESHOLD = 0.6
const REQUIRED_MATCH_THRESHOLD = 0.8
const MAX_RESULTS_TO_SCORE = 3
const MAX_TITLE_LENGTH = 200
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

const tokenize = (value: string) => {
  const tokens = normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 || /^\d+$/.test(token))
  return new Set(tokens)
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

  const domain = resolveAmazonDomain(request.nextUrl.searchParams.get("domain"))
  const host = AMAZON_DOMAINS[domain]

  const volumeParam = request.nextUrl.searchParams.get("volume")?.trim() ?? ""
  const format = sanitizeInput(
    request.nextUrl.searchParams.get("format"),
    MAX_FORMAT_LENGTH
  )
  const binding = sanitizeInput(request.nextUrl.searchParams.get("binding"), 40)

  const volumeNumber = Number.parseInt(volumeParam, 10)
  const resolvedVolumeNumber = Number.isFinite(volumeNumber)
    ? volumeNumber
    : null
  const volumeLabel = resolvedVolumeNumber
    ? `Volume ${resolvedVolumeNumber}`
    : null
  const bindingLabel = binding || DEFAULT_BINDING

  const searchTokens = [title, volumeLabel, format, bindingLabel].filter(
    Boolean
  )
  const expectedTokens = [title, volumeLabel, format].filter(Boolean)
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
    volumeNumber: resolvedVolumeNumber,
    format,
    bindingLabel,
    searchQuery,
    searchUrl: url.toString()
  })

  return {
    domain,
    host,
    title,
    expectedTitle,
    requiredTitle,
    bindingLabel,
    volumeNumber: resolvedVolumeNumber,
    searchUrl: url.toString()
  }
}

type SearchContext = ReturnType<typeof getSearchContext>

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

const findBindingLink = (
  $: cheerio.CheerioAPI,
  result: cheerio.Cheerio<Element>,
  bindingLabel: string
) => {
  const bindingLower = bindingLabel.toLowerCase()
  const link = result
    .find("a")
    .filter((_: number, el: Element) => {
      const text = $(el).text().replaceAll(/\s+/g, " ").trim().toLowerCase()
      return text ? text === bindingLower : false
    })
    .first()

  if (!link.length) {
    throw new ApiError(404, `No ${bindingLabel} option found`)
  }

  return link
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
  const $ = cheerio.load(html)
  const resultElements = getSearchResults($)
  debugLog(
    `Scoring top ${resultElements.length} Amazon results against expected title`,
    {
      expectedTitle: context.expectedTitle,
      requiredTitle: context.requiredTitle,
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
    const hasVolumeMatch = context.volumeNumber
      ? hasExactVolumeMatch(resultTitle, context.volumeNumber)
      : true

    return {
      result,
      resultTitle,
      strictScore,
      requiredScore,
      matchScore,
      hasVolumeMatch,
      index
    }
  })

  let candidates = scoredResults
  if (
    context.volumeNumber &&
    scoredResults.some((item) => item.hasVolumeMatch)
  ) {
    candidates = scoredResults.filter((item) => item.hasVolumeMatch)
  }

  debugLog("Scored Amazon results", {
    candidates: candidates.map((item) => ({
      title: item.resultTitle,
      strictScore: item.strictScore.toFixed(2),
      requiredScore: item.requiredScore.toFixed(2),
      matchScore: item.matchScore.toFixed(2),
      index: item.index
    }))
  })

  const best = candidates.reduce<typeof scoredResults[number] | null>(
    (currentBest, item) => {
      if (!currentBest) return item
      if (item.matchScore > currentBest.matchScore) return item
      if (
        item.matchScore === currentBest.matchScore &&
        item.index < currentBest.index
      ) {
        return item
      }
      return currentBest
    },
    null
  )

  if (!best) {
    throw new ApiError(404, "No search results found")
  }

  debugLog("Selected Amazon result", {
    title: best.resultTitle,
    strictScore: best.strictScore,
    requiredScore: best.requiredScore,
    matchScore: best.matchScore,
    index: best.index
  })

  if (
    best.strictScore < MATCH_THRESHOLD &&
    best.requiredScore < REQUIRED_MATCH_THRESHOLD
  ) {
    debugLog("Match score below threshold", {
      strictScore: best.strictScore,
      requiredScore: best.requiredScore,
      matchScore: best.matchScore,
      resultTitle: best.resultTitle
    })
    throw new ApiError(404, "Top result did not match expected title", {
      matchScore: best.matchScore,
      strictScore: best.strictScore,
      requiredScore: best.requiredScore,
      resultTitle: best.resultTitle
    })
  }

  let priceText: string | null = null
  let priceValue: number | null = null
  let currency: string | null = null

  if (options.includePrice) {
    const bindingLink = findBindingLink($, best.result, context.bindingLabel)
    priceText = extractPriceText(best.result, bindingLink)
    priceValue = parsePriceValue(priceText, context.host)
    currency = detectCurrency(priceText, context.host)
    debugLog("Parsed Amazon price", { priceText, priceValue, currency })
  }

  const productUrl = extractProductUrl(best.result, context.host)
  const imageUrl = options.includeImage
    ? extractImageUrl(best.result)
    : null

  return {
    resultTitle: best.resultTitle,
    matchScore: best.matchScore,
    priceText,
    priceValue,
    currency,
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
    const parsed = parseAmazonResult(
      html,
      context,
      { includePrice, includeImage }
    )

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
