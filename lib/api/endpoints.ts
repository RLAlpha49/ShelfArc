import { apiFetch } from "./client"
import type {
  BatchScrapeParams,
  BatchScrapeResponse,
  BatchUpdateVolumesParams,
  BatchUpdateVolumesResponse,
  ExportLibraryParams,
  FetchAlertsResponse,
  FetchAnalyticsResponse,
  FetchLibraryParams,
  FetchLibrarySeriesResponse,
  FetchLibraryVolumesResponse,
  FetchPriceParams,
  FetchPriceResponse,
  FetchSuggestionsParams,
  FetchSuggestionsResponse,
  FetchVolumeResponse,
  SearchBooksParams,
  SearchBooksResponse
} from "./types"

export function searchBooks(
  params: SearchBooksParams,
  signal?: AbortSignal
): Promise<SearchBooksResponse> {
  const sp = new URLSearchParams()
  sp.set("q", params.q)
  sp.set("source", params.source)
  if (params.page != null) sp.set("page", String(params.page))
  if (params.limit != null) sp.set("limit", String(params.limit))
  return apiFetch<SearchBooksResponse>(`/api/books/search?${sp}`, { signal })
}

export function fetchBookVolume(
  volumeId: string,
  signal?: AbortSignal
): Promise<FetchVolumeResponse> {
  return apiFetch<FetchVolumeResponse>(
    `/api/books/volume/${encodeURIComponent(volumeId)}`,
    { signal }
  )
}

export function fetchPrice(
  params: FetchPriceParams,
  signal?: AbortSignal
): Promise<FetchPriceResponse> {
  const sp = new URLSearchParams()
  sp.set("title", params.title)
  sp.set("volume", String(params.volume))
  if (params.volumeTitle?.trim()) sp.set("volumeTitle", params.volumeTitle)
  if (params.format) sp.set("format", params.format)
  sp.set("binding", params.binding)
  sp.set("domain", params.domain)
  if (params.volumeId) sp.set("volumeId", params.volumeId)
  if (params.includeImage) sp.set("includeImage", "true")
  if (params.includePrice === false) sp.set("includePrice", "false")
  if (params.includePrice !== false && params.fallbackToKindle) {
    sp.set("fallbackToKindle", "true")
  }
  return apiFetch<FetchPriceResponse>(`/api/books/price?${sp}`, { signal })
}

export function fetchPriceAlerts(
  signal?: AbortSignal
): Promise<FetchAlertsResponse> {
  return apiFetch<FetchAlertsResponse>("/api/books/price/alerts", { signal })
}

export function fetchAnalytics(
  signal?: AbortSignal
): Promise<FetchAnalyticsResponse> {
  return apiFetch<FetchAnalyticsResponse>("/api/library/analytics", { signal })
}

export function fetchLibrary(
  params: FetchLibraryParams,
  options?: { signal?: AbortSignal }
): Promise<FetchLibrarySeriesResponse | FetchLibraryVolumesResponse> {
  const searchParams = new URLSearchParams()
  if (params.page) searchParams.set("page", String(params.page))
  if (params.limit) searchParams.set("limit", String(params.limit))
  if (params.sortField) searchParams.set("sortField", params.sortField)
  if (params.sortOrder) searchParams.set("sortOrder", params.sortOrder)
  if (params.search) searchParams.set("search", params.search)
  if (params.type) searchParams.set("type", params.type)
  if (params.ownershipStatus)
    searchParams.set("ownershipStatus", params.ownershipStatus)
  if (params.readingStatus)
    searchParams.set("readingStatus", params.readingStatus)
  if (params.tags?.length) searchParams.set("tags", params.tags.join(","))
  if (params.excludeTags?.length)
    searchParams.set("excludeTags", params.excludeTags.join(","))
  if (params.view) searchParams.set("view", params.view)

  const url = `/api/library?${searchParams.toString()}`
  return apiFetch<FetchLibrarySeriesResponse | FetchLibraryVolumesResponse>(
    url,
    { signal: options?.signal }
  )
}

export function batchUpdateVolumes(
  params: BatchUpdateVolumesParams,
  signal?: AbortSignal
): Promise<BatchUpdateVolumesResponse> {
  return apiFetch<BatchUpdateVolumesResponse>("/api/library/volumes/batch", {
    method: "PATCH",
    body: params,
    signal
  })
}

export function fetchSuggestions(
  params: FetchSuggestionsParams,
  signal?: AbortSignal
): Promise<FetchSuggestionsResponse> {
  const sp = new URLSearchParams()
  sp.set("q", params.q)
  if (params.field) sp.set("field", params.field)
  return apiFetch<FetchSuggestionsResponse>(`/api/library/suggest?${sp}`, {
    signal
  })
}

export async function exportLibrary(
  params: ExportLibraryParams,
  signal?: AbortSignal
): Promise<Blob> {
  const res = await fetch("/api/library/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? `Export failed with status ${res.status}`)
  }
  return res.blob()
}

export function batchScrapeVolumes(
  params: BatchScrapeParams,
  signal?: AbortSignal
): Promise<BatchScrapeResponse> {
  return apiFetch<BatchScrapeResponse>("/api/library/volumes/batch-scrape", {
    method: "POST",
    body: params,
    signal
  })
}
