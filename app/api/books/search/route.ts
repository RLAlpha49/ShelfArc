import { type NextRequest } from "next/server"

import { apiError, apiSuccess } from "@/lib/api-response"
import { getGoogleBooksApiKeys } from "@/lib/books/google-books-keys"
import { normalizeIsbn } from "@/lib/books/isbn"
import {
  type BookSearchResult,
  type BookSearchSource,
  isIsbnQuery,
  normalizeGoogleBooksItems,
  normalizeOpenLibraryDocs
} from "@/lib/books/search"
import { getCorrelationId } from "@/lib/correlation"
import { type Logger, logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/** Google Books Volumes API base URL. @source */
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"

/** Open Library Search API base URL. @source */
const OPEN_LIBRARY_URL = "https://openlibrary.org/search.json"

/** Default number of results per search page. @source */
const DEFAULT_LIMIT = 40

/** Maximum allowed results per page. @source */
const MAX_LIMIT = 50

/** Google Books API maximum `maxResults` per batch. @source */
const GOOGLE_BOOKS_MAX_LIMIT = 20

/** Timeout in milliseconds for upstream search requests. @source */
const FETCH_TIMEOUT_MS = 10000

/** Cache TTL for upstream search calls (seconds). @source */
const SEARCH_CACHE_TTL_SECONDS = 60

/**
 * Wraps a raw query as an ISBN query for Google Books when applicable.
 * @param query - The user's search query.
 * @returns A Google Books-compatible query string.
 * @source
 */
const buildGoogleQuery = (query: string) => {
  if (isIsbnQuery(query)) {
    return `isbn:${normalizeIsbn(query)}`
  }
  return query
}

/**
 * Fetches a URL with an abort-signal timeout.
 * @param url - Target URL.
 * @param options - Standard fetch options.
 * @param timeoutMs - Timeout in milliseconds.
 * @param contextLabel - Label used in timeout error messages.
 * @returns The upstream `Response`.
 * @throws When the request times out or the network fails.
 * @source
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit & { next?: { revalidate?: number } },
  timeoutMs: number,
  contextLabel: string
): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${contextLabel} request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Attempts a single Google Books batch request, rotating API keys on 429 responses.
 * @param query - Search query string.
 * @param apiKeys - Array of Google Books API keys.
 * @param batchSize - Number of results to request.
 * @param startIndex - Pagination offset.
 * @param keyIndex - Current position in the API key rotation.
 * @returns An object with the upstream response, updated key index, and optional error.
 * @source
 */
const fetchGoogleBooksResponse = async (
  query: string,
  apiKeys: string[],
  batchSize: number,
  startIndex: number,
  keyIndex: number
): Promise<{ response?: Response; keyIndex: number; error?: string }> => {
  const totalKeys = apiKeys.length
  let usedKeyIndex = keyIndex

  for (let attempt = 0; attempt < totalKeys; attempt += 1) {
    usedKeyIndex = (keyIndex + attempt) % totalKeys
    const apiKey = apiKeys[usedKeyIndex]
    const url = new URL(GOOGLE_BOOKS_URL)
    url.searchParams.set("q", buildGoogleQuery(query))
    url.searchParams.set("maxResults", String(batchSize))
    url.searchParams.set("startIndex", String(startIndex))
    url.searchParams.set("printType", "books")
    url.searchParams.set("key", apiKey)

    try {
      const response = await fetchWithTimeout(
        url.toString(),
        {
          cache: "force-cache",
          next: { revalidate: SEARCH_CACHE_TTL_SECONDS }
        },
        FETCH_TIMEOUT_MS,
        "Google Books"
      )

      if (response.status === 429 && totalKeys > 1 && attempt < totalKeys - 1) {
        continue
      }

      return { response, keyIndex: usedKeyIndex }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      return { error: message, keyIndex: usedKeyIndex }
    }
  }

  return { keyIndex: usedKeyIndex }
}

/**
 * Searches Google Books with pagination, batching, and API key rotation.
 * @param query - User search query.
 * @param apiKeys - Available API keys.
 * @param page - 1-based page number.
 * @param limit - Maximum results per page.
 * @returns Normalized search results with an optional warning on partial failure.
 * @source
 */
const fetchGoogleBooks = async (
  query: string,
  apiKeys: string[],
  page: number,
  limit: number,
  log: Logger
): Promise<{ items: BookSearchResult[]; warning?: string }> => {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT)
  const startIndex = Math.max(page - 1, 0) * safeLimit
  const results: BookSearchResult[] = []
  let keyIndex = 0

  for (let offset = 0; offset < safeLimit; offset += GOOGLE_BOOKS_MAX_LIMIT) {
    const batchSize = Math.min(GOOGLE_BOOKS_MAX_LIMIT, safeLimit - offset)
    const {
      response,
      keyIndex: nextKeyIndex,
      error
    } = await fetchGoogleBooksResponse(
      query,
      apiKeys,
      batchSize,
      startIndex + offset,
      keyIndex
    )

    keyIndex = nextKeyIndex

    if (error) {
      log.warn("Google Books batch failed", {
        retrieved: results.length,
        error
      })
      return {
        items: results.slice(0, safeLimit),
        warning: `Partial results: ${results.length} items; failed to fetch batch: ${error}`
      }
    }

    if (!response) {
      return {
        items: results.slice(0, safeLimit),
        warning: `Partial results: ${results.length} items; failed to fetch batch: unavailable response`
      }
    }
    if (!response.ok) {
      let errorDetails: string | undefined
      try {
        const errorBody = (await response.json()) as unknown
        errorDetails = JSON.stringify(errorBody)
      } catch {
        errorDetails = undefined
      }

      log.warn("Google Books batch failed", {
        status: response.status,
        statusText: response.statusText,
        retrieved: results.length,
        errorDetails
      })

      return {
        items: results.slice(0, safeLimit),
        warning: `Partial results: ${results.length} items; failed to fetch batch: ${response.status}`
      }
    }

    const data = (await response.json()) as { items?: unknown[] }
    const batch = normalizeGoogleBooksItems(data.items ?? [])
    results.push(...batch)
    if (batch.length < batchSize) {
      break
    }
  }

  return { items: results.slice(0, safeLimit) }
}

/**
 * Searches Open Library by query or ISBN.
 * @param query - User search query or ISBN string.
 * @param page - 1-based page number.
 * @param limit - Maximum results per page.
 * @returns Normalized search results.
 * @throws When the upstream request fails.
 * @source
 */
const fetchOpenLibrary = async (
  query: string,
  page: number,
  limit: number
): Promise<BookSearchResult[]> => {
  const url = new URL(OPEN_LIBRARY_URL)
  if (isIsbnQuery(query)) {
    url.searchParams.set("isbn", normalizeIsbn(query))
  } else {
    url.searchParams.set("q", query)
  }
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("page", String(page))

  const response = await fetchWithTimeout(
    url.toString(),
    {
      cache: "force-cache",
      next: { revalidate: SEARCH_CACHE_TTL_SECONDS }
    },
    FETCH_TIMEOUT_MS,
    "Open Library"
  )
  if (!response.ok) {
    throw new Error("Open Library search failed")
  }

  const data = (await response.json()) as { docs?: unknown[] }
  return normalizeOpenLibraryDocs(data.docs ?? [])
}

/** Parsed and validated search query parameters. @source */
type SearchParams = {
  query: string
  source: BookSearchSource
  page: number
  limit: number
}

/**
 * Parses and validates search query parameters from the request URL.
 * @param searchParams - URL search parameters.
 * @returns Validated search parameters or null if query is missing.
 * @source
 */
const parseSearchParams = (
  searchParams: URLSearchParams
): SearchParams | null => {
  const query = searchParams.get("q")?.trim() ?? ""
  if (!query) return null

  const sourceParam = searchParams.get("source")
  const pageParam = Number.parseInt(searchParams.get("page") ?? "1", 10)
  const limitParam = Number.parseInt(
    searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10
  )

  return {
    query,
    source: sourceParam === "open_library" ? "open_library" : "google_books",
    page: Number.isNaN(pageParam) ? 1 : Math.max(1, pageParam),
    limit: Number.isNaN(limitParam)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(limitParam, 1), MAX_LIMIT)
  }
}

/**
 * Handles Google Books search requests.
 * @source
 */
const handleGoogleBooks = async (
  params: SearchParams,
  correlationId: string,
  log: Logger
) => {
  const googleApiKeys = getGoogleBooksApiKeys()
  if (googleApiKeys.length === 0) {
    return apiError(503, "Google Books API key is not configured", {
      extra: { results: [], sourceUsed: "google_books" }
    })
  }

  try {
    const { items, warning } = await fetchGoogleBooks(
      params.query,
      googleApiKeys,
      params.page,
      params.limit,
      log
    )
    return apiSuccess(
      {
        data: items,
        meta: {
          sourceUsed: "google_books" as const,
          page: params.page,
          limit: params.limit,
          ...(warning ? { warning } : {})
        }
      },
      { correlationId }
    )
  } catch (error) {
    log.error("Google Books search failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(502, "Google Books search failed", {
      extra: { results: [], sourceUsed: "google_books" }
    })
  }
}

/**
 * Handles Open Library search requests.
 * @source
 */
const handleOpenLibrary = async (
  params: SearchParams,
  correlationId: string,
  log: Logger
) => {
  try {
    const results: BookSearchResult[] = await fetchOpenLibrary(
      params.query,
      params.page,
      params.limit
    )
    return apiSuccess(
      {
        data: results,
        meta: {
          sourceUsed: "open_library" as const,
          page: params.page,
          limit: params.limit
        }
      },
      { correlationId }
    )
  } catch (error) {
    log.error("Open Library search failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(502, "Open Library search failed", {
      extra: { results: [], sourceUsed: "open_library" }
    })
  }
}

/**
 * Book search endpoint supporting Google Books and Open Library sources.
 * @param request - Incoming request with `q`, optional `source`, `page`, and `limit` query parameters.
 * @returns JSON with normalized search results and source metadata.
 * @source
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    return apiError(401, "Not authenticated", { correlationId })
  }
  const rl = await consumeDistributedRateLimit({
    key: `book-search:${user.id}`,
    maxHits: 30,
    windowMs: 60000,
    cooldownMs: 30000,
    reason: "Rate limit book search"
  })
  if (rl && !rl.allowed) {
    return apiError(429, "Too many requests", {
      correlationId,
      extra: { retryAfterMs: rl.retryAfterMs }
    })
  }

  const params = parseSearchParams(request.nextUrl.searchParams)
  if (!params) {
    return apiError(400, "Missing query", {
      extra: { results: [] }
    })
  }

  if (params.source === "google_books") {
    return handleGoogleBooks(params, correlationId, log)
  }

  return handleOpenLibrary(params, correlationId, log)
}
