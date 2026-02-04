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
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 40

const buildGoogleQuery = (query: string) => {
  if (isIsbnQuery(query)) {
    return `isbn:${normalizeIsbn(query)}`
  }
  return query
}

const fetchGoogleBooks = async (
  query: string,
  apiKey: string,
  page: number,
  limit: number
): Promise<BookSearchResult[]> => {
  const url = new URL(GOOGLE_BOOKS_URL)
  const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT)
  const startIndex = Math.max(page - 1, 0) * safeLimit
  url.searchParams.set("q", buildGoogleQuery(query))
  url.searchParams.set("maxResults", String(safeLimit))
  url.searchParams.set("startIndex", String(startIndex))
  url.searchParams.set("printType", "books")
  url.searchParams.set("key", apiKey)

  const response = await fetch(url.toString(), { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Google Books search failed")
  }

  const data = (await response.json()) as { items?: unknown[] }
  return normalizeGoogleBooksItems(data.items ?? [])
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

  const response = await fetch(url.toString(), { cache: "no-store" })
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
      const results: BookSearchResult[] = await fetchGoogleBooks(
        query,
        googleApiKey,
        page,
        limit
      )
      return NextResponse.json({
        results,
        sourceUsed: "google_books",
        page,
        limit
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
