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
  page?: number
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
  page: number
  limit: number
  total: number
  totalPages: number
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
