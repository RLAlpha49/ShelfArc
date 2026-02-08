import { NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import type { Element } from "domhandler"

export const dynamic = "force-dynamic"

const AMAZON_SEARCH_PATH = "/s"
const DEFAULT_BINDING = "Paperback"
const FETCH_TIMEOUT_MS = 12000
const MATCH_THRESHOLD = 0.6
const REQUIRED_MATCH_THRESHOLD = 0.8
const MAX_TITLE_LENGTH = 200
const MAX_FORMAT_LENGTH = 80
const MAX_QUERY_LENGTH = 260

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
  const volumeLabel = Number.isFinite(volumeNumber)
    ? `Volume ${volumeNumber}`
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

  return {
    domain,
    host,
    title,
    expectedTitle,
    requiredTitle,
    bindingLabel,
    searchUrl: url.toString()
  }
}

const fetchAmazonHtml = async (searchUrl: string) => {
  let response: Response
  try {
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
    throw new ApiError(502, `Amazon request failed (${response.status})`)
  }

  const html = await response.text()
  if (isLikelyBotGate(html)) {
    throw new ApiError(429, "Amazon blocked the request (captcha/robot check)")
  }

  return html
}

const getTopResult = ($: cheerio.CheerioAPI) => {
  const searchRoot = $("#search")
  if (!searchRoot.length) {
    throw new ApiError(502, "Amazon search results not found")
  }

  const result = searchRoot
    .find('div[data-component-type="s-search-result"]')
    .filter((_: number, el: Element) => $(el).attr("data-ad") !== "true")
    .first()

  if (!result.length) {
    throw new ApiError(404, "No search results found")
  }

  return result
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

  if (!primaryPrice) {
    const resultSnippet = result
      .text()
      .replaceAll(/\s+/g, " ")
      .trim()
      .slice(0, 200)
    const bindingLinkHtml = bindingLink.html()
    console.warn("Amazon price selector fallback", {
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

const parseAmazonResult = (
  html: string,
  expectedTitle: string,
  requiredTitle: string,
  bindingLabel: string,
  fallbackTitle: string,
  host: string
) => {
  const $ = cheerio.load(html)
  const result = getTopResult($)
  const resultTitle = extractResultTitle(result)
  const strictScore = similarityScore(
    expectedTitle || fallbackTitle,
    resultTitle
  )
  const requiredScore = tokenCoverageScore(
    requiredTitle || fallbackTitle,
    resultTitle
  )
  const matchScore = Math.max(strictScore, requiredScore)

  if (
    strictScore < MATCH_THRESHOLD &&
    requiredScore < REQUIRED_MATCH_THRESHOLD
  ) {
    console.debug("Match score below threshold", {
      strictScore,
      requiredScore,
      matchScore,
      resultTitle
    })
    throw new ApiError(404, "Top result did not match expected title", {
      matchScore,
      strictScore,
      requiredScore,
      resultTitle
    })
  }

  const bindingLink = findBindingLink($, result, bindingLabel)
  const priceText = extractPriceText(result, bindingLink)
  const priceValue = parsePriceValue(priceText, host)
  const currency = detectCurrency(priceText, host)
  const productUrl = extractProductUrl(result, host)

  return {
    resultTitle,
    matchScore,
    priceText,
    priceValue,
    currency,
    productUrl
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = getSearchContext(request)
    const html = await fetchAmazonHtml(context.searchUrl)
    const parsed = parseAmazonResult(
      html,
      context.expectedTitle,
      context.requiredTitle,
      context.bindingLabel,
      context.title,
      context.host
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
        url: parsed.productUrl
      }
    })
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonError(error)
    }

    console.error("Amazon price lookup failed", error)
    return NextResponse.json(
      { error: "Amazon price lookup failed" },
      { status: 500 }
    )
  }
}
