import { type NextRequest } from "next/server"
import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"
import { apiError } from "@/lib/api-response"
import { getCorrelationId, CORRELATION_HEADER } from "@/lib/correlation"
import { logger } from "@/lib/logger"

/** Base URL for the Open Library Covers API. @source */
const OPEN_LIBRARY_BASE = "https://covers.openlibrary.org/b/isbn"

/** Allowed cover size parameters (`S`, `M`, `L`). @source */
const VALID_SIZES = new Set(["S", "M", "L"])

/** Timeout in milliseconds for upstream cover fetch requests. @source */
const FETCH_TIMEOUT_MS = 5000

/**
 * Proxies a book cover image from the Open Library Covers API by ISBN.
 * @param request - Incoming request with `isbn` and optional `size` query parameters.
 * @returns The cover image stream with appropriate caching headers.
 * @source
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  const isbnRaw = request.nextUrl.searchParams.get("isbn")?.trim() ?? ""
  const sizeRaw = request.nextUrl.searchParams.get("size")?.trim() ?? "L"

  if (!isbnRaw || !isValidIsbn(isbnRaw)) {
    return apiError(400, "Invalid ISBN")
  }

  const normalized = normalizeIsbn(isbnRaw)
  const size = VALID_SIZES.has(sizeRaw.toUpperCase())
    ? (sizeRaw.toUpperCase() as "S" | "M" | "L")
    : "L"

  const url = `${OPEN_LIBRARY_BASE}/${normalized}-${size}.jpg?default=false`

  let response: Response
  try {
    response = await fetch(url, {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      return new Response(null, { status: 504 })
    }
    log.error("Open Library cover fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return new Response(null, { status: 502 })
  }

  if (response.status === 404) {
    return new Response(null, { status: 404 })
  }

  if (!response.ok) {
    return new Response(null, { status: 502 })
  }

  if (!response.body) {
    return new Response(null, { status: 502 })
  }

  const headers = new Headers()
  const upstreamContentType = response.headers.get("content-type") ?? ""
  const normalizedContentType = upstreamContentType
    .split(";")[0]
    .trim()
    .toLowerCase()
  const allowedContentTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif"
  ])

  headers.set(
    "Content-Type",
    allowedContentTypes.has(normalizedContentType)
      ? normalizedContentType
      : "image/jpeg"
  )
  headers.set(
    "Cache-Control",
    "public, max-age=86400, stale-while-revalidate=604800"
  )
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set(CORRELATION_HEADER, correlationId)

  return new Response(response.body, { headers })
}
