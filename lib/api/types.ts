import type { BookSearchResult, BookSearchSource } from "@/lib/books/search"
import type { PriceAlert } from "@/lib/types/database"

// ── Search ──────────────────────────────────────────────────────────

export interface SearchBooksParams {
  q: string
  source: BookSearchSource
  page?: number
  limit?: number
}

export interface SearchBooksResponse {
  results: BookSearchResult[]
  sourceUsed: BookSearchSource | null
  page?: number
  limit?: number
  warning?: string
}

// ── Volume ──────────────────────────────────────────────────────────

export interface FetchVolumeResponse {
  result: BookSearchResult
}

// ── Price ───────────────────────────────────────────────────────────

export interface FetchPriceParams {
  title: string
  volume: string | number
  volumeTitle?: string
  format?: string
  binding: string
  domain: string
  includeImage?: boolean
  includePrice?: boolean
  fallbackToKindle?: boolean
}

export interface FetchPriceResult {
  title?: string
  priceText?: string | null
  priceValue?: number | null
  currency?: string | null
  priceBinding?: string | null
  priceError?: string | null
  url?: string | null
  imageUrl?: string | null
}

export interface FetchPriceResponse {
  searchUrl: string
  domain: string
  expectedTitle: string
  matchScore: number
  binding: string
  result: FetchPriceResult
}

// ── Price Alerts ────────────────────────────────────────────────────

export interface FetchAlertsResponse {
  data: PriceAlert[]
}
