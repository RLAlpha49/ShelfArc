import { NextRequest, NextResponse } from "next/server"
import {
  isIsbnQuery,
  normalizeGoogleBooksItems,
  normalizeIsbn,
  normalizeOpenLibraryDocs,
  type BookSearchResult
} from "@/lib/books/search"

const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"
const OPEN_LIBRARY_URL = "https://openlibrary.org/search.json"

const buildGoogleQuery = (query: string) => {
  if (isIsbnQuery(query)) {
    return `isbn:${normalizeIsbn(query)}`
  }
  return query
}

const fetchGoogleBooks = async (
  query: string,
  apiKey: string
): Promise<BookSearchResult[]> => {
  const url = new URL(GOOGLE_BOOKS_URL)
  url.searchParams.set("q", buildGoogleQuery(query))
  url.searchParams.set("maxResults", "12")
  url.searchParams.set("printType", "books")
  url.searchParams.set("key", apiKey)

  const response = await fetch(url.toString(), { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Google Books search failed")
  }

  const data = (await response.json()) as { items?: unknown[] }
  return normalizeGoogleBooksItems(data.items ?? [])
}

const fetchOpenLibrary = async (query: string): Promise<BookSearchResult[]> => {
  const url = new URL(OPEN_LIBRARY_URL)
  if (isIsbnQuery(query)) {
    url.searchParams.set("isbn", normalizeIsbn(query))
  } else {
    url.searchParams.set("q", query)
  }
  url.searchParams.set("limit", "12")

  const response = await fetch(url.toString(), { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Open Library search failed")
  }

  const data = (await response.json()) as { docs?: unknown[] }
  return normalizeOpenLibraryDocs(data.docs ?? [])
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""

  if (!query) {
    return NextResponse.json(
      { results: [], sourceUsed: null, error: "Missing query" },
      { status: 400 }
    )
  }

  const googleApiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim()
  let results: BookSearchResult[] = []
  let sourceUsed: "google_books" | "open_library" | null = null

  if (googleApiKey) {
    try {
      results = await fetchGoogleBooks(query, googleApiKey)
      if (results.length > 0) {
        sourceUsed = "google_books"
        return NextResponse.json({ results, sourceUsed })
      }
    } catch (error) {
      console.error("Google Books search failed", error)
    }
  }

  try {
    results = await fetchOpenLibrary(query)
    sourceUsed = "open_library"
    return NextResponse.json({ results, sourceUsed })
  } catch (error) {
    console.error("Open Library search failed", error)
    return NextResponse.json(
      { results: [], sourceUsed, error: "Search failed" },
      { status: 500 }
    )
  }
}
