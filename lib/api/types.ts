import type { BookSearchResult, BookSearchSource } from "@/lib/books/search"
import type {
  CollectionStats,
  PriceBreakdown,
  WishlistStats
} from "@/lib/library/analytics"
import type { HealthScore } from "@/lib/library/health-score"
import type { PriceAlert } from "@/lib/types/database"

// ── Search ──────────────────────────────────────────────────────────

export interface SearchBooksParams {
  q: string
  source: BookSearchSource
  page?: number
  limit?: number
}

export interface SearchBooksResponse {
  data: BookSearchResult[]
  meta: {
    sourceUsed: BookSearchSource | null
    page?: number
    limit?: number
    warning?: string
  }
}

// ── Volume ──────────────────────────────────────────────────────────

export interface FetchVolumeResponse {
  data: BookSearchResult
}

// ── Price ───────────────────────────────────────────────────────────

export interface FetchPriceParams {
  title: string
  volume: string | number
  volumeTitle?: string
  format?: string
  binding: string
  domain: string
  volumeId?: string
  includeImage?: boolean
  includePrice?: boolean
  fallbackToKindle?: boolean
  source?: string
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
  data: {
    searchUrl: string
    domain: string
    expectedTitle: string
    matchScore: number
    binding: string
    result: FetchPriceResult
  }
}

// ── Price Alerts ────────────────────────────────────────────────────

export interface FetchAlertsResponse {
  data: PriceAlert[]
}

// ── Analytics ───────────────────────────────────────────────────────

/** Pre-computed dashboard analytics response. @source */
export interface FetchAnalyticsResponse {
  collectionStats: CollectionStats
  priceBreakdown: PriceBreakdown
  wishlistStats: WishlistStats
  healthScore: HealthScore
}

// ── Library ─────────────────────────────────────────────────────────

/** Query parameters for paginated library data. @source */
export interface FetchLibraryParams {
  cursor?: string | null
  includeCount?: boolean
  limit?: number
  sortField?: string
  sortOrder?: "asc" | "desc"
  search?: string
  type?: string
  ownershipStatus?: string
  readingStatus?: string
  tags?: string[]
  excludeTags?: string[]
  view?: "series" | "volumes"
}

/** Pagination metadata. @source */
export interface PaginationMeta {
  limit: number
  total?: number
  nextCursor?: string | null
  hasMore: boolean
}

/** Paginated library series response. @source */
export interface FetchLibrarySeriesResponse {
  data: Array<{
    id: string
    title: string
    original_title: string | null
    description: string | null
    notes: string | null
    author: string | null
    artist: string | null
    publisher: string | null
    cover_image_url: string | null
    type: string
    total_volumes: number | null
    status: string | null
    tags: string[]
    created_at: string
    updated_at: string
    user_id: string
    volumes: Array<Record<string, unknown>>
  }>
  pagination: PaginationMeta
}

// ── Batch Update ────────────────────────────────────────────────────

/** Parameters for batch volume updates. @source */
export interface BatchUpdateVolumesParams {
  volumeIds: string[]
  updates: {
    ownership_status?: string
    reading_status?: string
    rating?: number | null
    purchase_price?: number | null
  }
}

/** Response from batch volume update. @source */
export interface BatchUpdateVolumesResponse {
  updated: number
  requested: number
}

// ── Suggestions ─────────────────────────────────────────────────────

/** Parameters for library search suggestions. @source */
export interface FetchSuggestionsParams {
  q: string
  field?: "title" | "author" | "publisher"
}

/** Response from search suggestions endpoint. @source */
export interface FetchSuggestionsResponse {
  data: string[]
}

// ── Export ───────────────────────────────────────────────────────────

/** Parameters for library data export. @source */
export interface ExportLibraryParams {
  format: "json" | "csv"
  scope: "all" | "selected"
  ids?: string[]
}

// ── Batch Scrape ────────────────────────────────────────────────────

/** Parameters for batch price/image scraping. @source */
export interface BatchScrapeParams {
  volumeIds: string[]
  mode: "price" | "image" | "both"
  skipExisting?: boolean
  domain?: string
  binding?: string
}

/** Single result from batch scrape job. @source */
export interface BatchScrapeJobResult {
  volumeId: string
  status: "done" | "failed" | "skipped"
  priceValue?: number | null
  imageUrl?: string | null
  errorMessage?: string
}

/** Response from batch scrape endpoint. @source */
export interface BatchScrapeResponse {
  data: {
    results: BatchScrapeJobResult[]
    summary: {
      total: number
      done: number
      failed: number
      skipped: number
    }
  }
}

/** Paginated library volumes response. @source */
export interface FetchLibraryVolumesResponse {
  data: Array<{
    volume: Record<string, unknown>
    series: {
      id: string
      title: string
      author: string | null
      type: string
      tags: string[]
    }
  }>
  pagination: PaginationMeta
}
