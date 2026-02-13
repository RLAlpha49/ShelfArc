import { apiFetch } from "./client"
import type {
  FetchAlertsResponse,
  FetchPriceParams,
  FetchPriceResponse,
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
