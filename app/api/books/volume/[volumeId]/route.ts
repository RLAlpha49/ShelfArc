import { NextRequest, NextResponse } from "next/server"
import { normalizeGoogleBooksItems } from "@/lib/books/search"
import { getGoogleBooksApiKeys } from "@/lib/books/google-books-keys"
import { apiError } from "@/lib/api-response"
import { getCorrelationId, CORRELATION_HEADER } from "@/lib/correlation"
import { logger } from "@/lib/logger"

/** Google Books Volumes API base URL. @source */
const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes"

/** Cache TTL for upstream volume lookups (seconds). @source */
const VOLUME_CACHE_TTL_SECONDS = 60 * 60 * 12

/** Timeout in milliseconds for upstream volume fetch requests. @source */
const FETCH_TIMEOUT_MS = 10000

/**
 * Maps a Google Books response status to a client-facing HTTP status.
 * @param response - The upstream Google Books response.
 * @returns The appropriate HTTP status code.
 * @source
 */
const resolveGoogleBooksStatus = (response: Response) => {
  if (response.status === 404) return 404
  if (response.status === 429) return 429
  return 502
}

/**
 * Fetches a single volume from Google Books, cycling API keys on 429 rate limits.
 * @param volumeId - The Google Books volume ID.
 * @param apiKeys - Array of Google Books API keys to rotate through.
 * @returns The upstream response, or `undefined` if all keys are exhausted.
 * @source
 */
const fetchGoogleBooksVolumeResponse = async (
  volumeId: string,
  apiKeys: string[]
): Promise<Response | undefined> => {
  for (let attempt = 0; attempt < apiKeys.length; attempt += 1) {
    const apiKey = apiKeys[attempt]
    const url = new URL(`${GOOGLE_BOOKS_URL}/${encodeURIComponent(volumeId)}`)
    url.searchParams.set("key", apiKey)
    const response = await fetch(url.toString(), {
      cache: "force-cache",
      next: { revalidate: VOLUME_CACHE_TTL_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    } as RequestInit)

    if (
      response.status === 429 &&
      apiKeys.length > 1 &&
      attempt < apiKeys.length - 1
    ) {
      continue
    }

    return response
  }

  return undefined
}

/** Route context carrying the dynamic `volumeId` segment. @source */
interface RouteContext {
  params: Promise<{
    volumeId: string
  }>
}

/**
 * Retrieves a single Google Books volume by its ID.
 * @param request - Incoming request (volume ID is extracted from the route segment).
 * @param params - Dynamic route context containing `volumeId`.
 * @returns JSON with the normalized volume result or an error.
 * @source
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  const { volumeId: paramVolumeId } = await params
  const volumeIdFromParams = paramVolumeId.trim()
  const fallbackSegment = request.nextUrl.pathname
    .split("/")
    .findLast((segment) => segment.length > 0)
  const fallbackId = fallbackSegment ? decodeURIComponent(fallbackSegment) : ""
  const volumeId = (volumeIdFromParams || fallbackId).trim()
  if (!volumeId) {
    return apiError(400, "Missing volume id")
  }

  const googleApiKeys = getGoogleBooksApiKeys()
  if (googleApiKeys.length === 0) {
    return apiError(400, "Google Books API key is not configured")
  }

  try {
    const response = await fetchGoogleBooksVolumeResponse(
      volumeId,
      googleApiKeys
    )

    if (!response) {
      return apiError(502, "Google Books volume fetch failed")
    }

    if (!response.ok) {
      const status = resolveGoogleBooksStatus(response)
      return apiError(status, "Google Books volume fetch failed")
    }

    const data = (await response.json()) as unknown
    const result = normalizeGoogleBooksItems([data])[0]
    if (!result) {
      return apiError(404, "Google Books volume not found")
    }

    const jsonResponse = NextResponse.json({ result })
    jsonResponse.headers.set(CORRELATION_HEADER, correlationId)
    return jsonResponse
  } catch (error) {
    log.error("Google Books volume fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(502, "Google Books volume fetch failed")
  }
}
