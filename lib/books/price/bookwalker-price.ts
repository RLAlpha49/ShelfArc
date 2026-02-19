import "server-only"

import * as cheerio from "cheerio"

import { ApiError } from "@/lib/books/price/api-error"

/** Timeout in milliseconds for outbound BookWalker requests. @source */
const FETCH_TIMEOUT_MS = 12000

/** Maximum number of BookWalker search results to score. @source */
const MAX_RESULTS_TO_SCORE = 12

/** Minimum token-overlap score to accept a result. @source */
const MATCH_THRESHOLD = 0.5

/** Maximum allowed character length for the series title input. @source */
const MAX_TITLE_LENGTH = 200

/** Maximum allowed character length for the volume input. @source */
const MAX_VOLUME_LENGTH = 20

/** BookWalker Global search endpoint. @source */
const BOOKWALKER_SEARCH_URL = "https://global.bookwalker.jp/search/"

export type BookWalkerPriceResult = {
  resultTitle: string
  priceText: string | null
  priceValue: number | null
  currency: string | null
  productUrl: string | null
  matchScore: number
}

export type BookWalkerSearchContext = {
  title: string
  volumeNumber: number | null
  searchUrl: string
  query: string
}

/**
 * Trims and truncates a nullable input string to the given max length.
 * @source
 */
const sanitizeInput = (value: string | null, maxLength: number) => {
  const trimmed = value?.trim() ?? ""
  return trimmed.slice(0, maxLength)
}

/**
 * Tokenizes text into a set of lowercase words for fuzzy overlap matching.
 * @source
 */
const tokenize = (s: string): Set<string> => {
  return new Set(
    s
      .toLowerCase()
      .replaceAll(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1)
  )
}

/**
 * Computes a token-overlap match score between a query and a result title.
 * Returns 0–1 based on what fraction of query tokens appear in the title.
 * @source
 */
const computeMatchScore = (query: string, title: string): number => {
  const queryTokens = tokenize(query)
  const titleTokens = tokenize(title)
  if (!queryTokens.size) return 0
  let hits = 0
  for (const t of queryTokens) {
    if (titleTokens.has(t)) hits++
  }
  return hits / queryTokens.size
}

/**
 * Builds a BookWalker Global search context from URL search params.
 * @source
 */
export const createBookWalkerSearchContext = (
  searchParams: URLSearchParams
): BookWalkerSearchContext => {
  const title = sanitizeInput(searchParams.get("title"), MAX_TITLE_LENGTH)
  if (!title) {
    throw new ApiError(400, "Missing title")
  }

  const volumeParam = sanitizeInput(
    searchParams.get("volume"),
    MAX_VOLUME_LENGTH
  )
  const volumeNumber = Number.parseInt(volumeParam, 10)
  const resolvedVolumeNumber = Number.isFinite(volumeNumber)
    ? volumeNumber
    : null

  const queryParts = [title]
  if (resolvedVolumeNumber != null) {
    queryParts.push(`Volume ${resolvedVolumeNumber}`)
  }
  const query = queryParts.join(" ")

  const url = new URL(BOOKWALKER_SEARCH_URL)
  url.searchParams.set("word", query)
  url.searchParams.set("np", "0")

  return {
    title,
    volumeNumber: resolvedVolumeNumber,
    searchUrl: url.toString(),
    query
  }
}

/**
 * Fetches a URL with an abort-signal timeout.
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
 * Fetches and returns the raw HTML from a BookWalker search results URL.
 * @source
 */
export const fetchBookWalkerHtml = async (
  searchUrl: string
): Promise<string> => {
  const fetchStart = performance.now()
  let response: Response
  try {
    response = await fetchWithTimeout(
      searchUrl,
      {
        cache: "no-store",
        headers: {
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9"
        }
      },
      FETCH_TIMEOUT_MS
    )
  } catch (error) {
    const fetchMs = Math.round(performance.now() - fetchStart)
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("Error fetching BookWalker search page", {
      searchUrl,
      message,
      fetchMs
    })
    throw new ApiError(502, `BookWalker request failed: ${message}`)
  }

  if (!response.ok) {
    const fetchMs = Math.round(performance.now() - fetchStart)
    console.error("BookWalker response not ok", {
      searchUrl,
      status: response.status,
      statusText: response.statusText,
      fetchMs
    })
    throw new ApiError(502, `BookWalker request failed (${response.status})`)
  }

  return response.text()
}

/**
 * Parses a BookWalker search results page and returns the best-matching result.
 * @source
 */
export const parseBookWalkerResult = (
  html: string,
  context: { title: string; volumeNumber: number | null; query: string }
): BookWalkerPriceResult => {
  const $ = cheerio.load(html)

  // Collect candidate items; filter out those with no title text.
  const items = $("li.o-tile-list-item")
    .toArray()
    .filter((el) => $(el).find(".a-tile-ttl").text().trim().length > 0)
    .slice(0, MAX_RESULTS_TO_SCORE)

  if (!items.length) {
    throw new ApiError(404, "No results found on BookWalker")
  }

  type Candidate = BookWalkerPriceResult & { score: number }

  const candidates: Candidate[] = items.map((el) => {
    const titleText = $(el).find(".a-tile-ttl").text().trim()

    const rawPriceText =
      $(el).find(".a-tile-price-pay").text().trim() ||
      $(el).find(".a-tile-price").text().trim()

    // Normalize whitespace from the scraped price text.
    const priceText = rawPriceText.replaceAll(/\s+/g, " ").trim() || null

    // Parse numeric USD price (e.g. "$6.99" → 6.99).
    let priceValue: number | null = null
    let currency: string | null = null
    if (priceText) {
      const match = /\$\s*(\d+(?:[.,]\d{1,2})?)/.exec(priceText)
      if (match?.[1]) {
        const numeric = match[1].replaceAll(",", ".")
        const parsed = Number.parseFloat(numeric)
        if (Number.isFinite(parsed)) {
          priceValue = parsed
          currency = "USD"
        }
      }
    }

    // Prefer the tile anchor's href; fall back to the first anchor in the item.
    const href =
      $(el).find("a.m-tile-inner").attr("href") ||
      $(el).find("a").first().attr("href") ||
      null

    let productUrl: string | null = null
    if (href) {
      if (href.startsWith("http://") || href.startsWith("https://")) {
        productUrl = href
      } else {
        const slash = href.startsWith("/") ? "" : "/"
        productUrl = `https://global.bookwalker.jp${slash}${href}`
      }
    }

    const score = computeMatchScore(context.query, titleText)

    return {
      resultTitle: titleText,
      priceText,
      priceValue,
      currency,
      productUrl,
      matchScore: score,
      score
    }
  })

  // Sort by descending score; use result order as a tiebreaker.
  const sorted = candidates.slice().sort((a, b) => b.score - a.score)
  const best = sorted[0]

  if (!best || best.score < MATCH_THRESHOLD) {
    throw new ApiError(404, "No matching result found on BookWalker")
  }

  return {
    resultTitle: best.resultTitle,
    priceText: best.priceText,
    priceValue: best.priceValue,
    currency: best.currency,
    productUrl: best.productUrl,
    matchScore: best.matchScore
  }
}
