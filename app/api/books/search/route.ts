import { NextRequest, NextResponse } from "next/server"
import {
  isIsbnQuery,
  normalizeGoogleBooksItems,
  normalizeOpenLibraryDocs,
  type BookSearchResult,
  type BookSearchSource
} from "@/lib/books/search"
import { normalizeIsbn } from "@/lib/books/isbn"

const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"
const OPEN_LIBRARY_URL = "https://openlibrary.org/search.json"
const DEFAULT_LIMIT = 40
const MAX_LIMIT = 50
const GOOGLE_BOOKS_MAX_LIMIT = 20
const FETCH_TIMEOUT_MS = 10000

const buildGoogleQuery = (query: string) => {
  if (isIsbnQuery(query)) {
    return `isbn:${normalizeIsbn(query)}`
  }
  return query
}

const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
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

const fetchGoogleBooks = async (
  query: string,
  apiKey: string,
  page: number,
  limit: number
): Promise<{ items: BookSearchResult[]; warning?: string }> => {
  const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT)
  const startIndex = Math.max(page - 1, 0) * safeLimit
  const results: BookSearchResult[] = []

  for (let offset = 0; offset < safeLimit; offset += GOOGLE_BOOKS_MAX_LIMIT) {
    const batchSize = Math.min(GOOGLE_BOOKS_MAX_LIMIT, safeLimit - offset)
    const url = new URL(GOOGLE_BOOKS_URL)
    url.searchParams.set("q", buildGoogleQuery(query))
    url.searchParams.set("maxResults", String(batchSize))
    url.searchParams.set("startIndex", String(startIndex + offset))
    url.searchParams.set("printType", "books")
    url.searchParams.set("key", apiKey)

    let response: Response
    try {
      response = await fetchWithTimeout(
        url.toString(),
        { cache: "no-store" },
        FETCH_TIMEOUT_MS,
        "Google Books"
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      console.warn("Google Books batch failed", {
        retrieved: results.length,
        error: message
      })
      return {
        items: results.slice(0, safeLimit),
        warning: `Partial results: ${results.length} items; failed to fetch batch: ${message}`
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

      console.warn("Google Books batch failed", {
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
    { cache: "no-store" },
    FETCH_TIMEOUT_MS,
    "Open Library"
  )
  if (!response.ok) {
    throw new Error("Open Library search failed")
  }

  const data = (await response.json()) as { docs?: unknown[] }
  return normalizeOpenLibraryDocs(data.docs ?? [])
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""
  const sourceParam = request.nextUrl.searchParams.get("source")
  const pageParam = Number.parseInt(
    request.nextUrl.searchParams.get("page") ?? "1",
    10
  )
  const limitParam = Number.parseInt(
    request.nextUrl.searchParams.get("limit") ?? String(DEFAULT_LIMIT),
    10
  )
  const source: BookSearchSource =
    sourceParam === "open_library" ? "open_library" : "google_books"
  const page = Number.isNaN(pageParam) ? 1 : Math.max(1, pageParam)
  const limit = Number.isNaN(limitParam)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(limitParam, 1), MAX_LIMIT)

  if (!query) {
    return NextResponse.json(
      { results: [], sourceUsed: null, error: "Missing query" },
      { status: 400 }
    )
  }

  if (source === "google_books") {
    const googleApiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim()
    if (!googleApiKey) {
      return NextResponse.json(
        {
          results: [],
          sourceUsed: "google_books",
          error: "Google Books API key is not configured"
        },
        { status: 400 }
      )
    }

    try {
      const { items, warning } = await fetchGoogleBooks(
        query,
        googleApiKey,
        page,
        limit
      )
      return NextResponse.json({
        results: items,
        sourceUsed: "google_books",
        page,
        limit,
        ...(warning ? { warning } : {})
      })
    } catch (error) {
      console.error("Google Books search failed", error)
      return NextResponse.json(
        {
          results: [],
          sourceUsed: "google_books",
          error: "Google Books search failed"
        },
        { status: 502 }
      )
    }
  }

  try {
    const results: BookSearchResult[] = await fetchOpenLibrary(
      query,
      page,
      limit
    )
    return NextResponse.json({
      results,
      sourceUsed: "open_library",
      page,
      limit
    })
  } catch (error) {
    console.error("Open Library search failed", error)
    return NextResponse.json(
      {
        results: [],
        sourceUsed: "open_library",
        error: "Open Library search failed"
      },
      { status: 502 }
    )
  }
}
