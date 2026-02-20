import { type NextRequest } from "next/server"

import { apiError } from "@/lib/api-response"
import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"
import { CORRELATION_HEADER, getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"

/** Base URL for the Open Library Covers API. @source */
const OPEN_LIBRARY_BASE = "https://covers.openlibrary.org/b/isbn"

/** Allowed cover size parameters (`S`, `M`, `L`). @source */
const VALID_SIZES = new Set(["S", "M", "L"])

/** Timeout in milliseconds for upstream cover fetch requests. @source */
const FETCH_TIMEOUT_MS = 5000

/** Maximum allowed upstream response size in bytes (5 MB). @source */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024

/** Allowed image content types for proxied responses. @source */
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif"
])

/** Resolves the normalized content-type from an upstream response. @source */
function resolveContentType(response: Response): string {
  const raw = response.headers.get("content-type") ?? ""
  const normalized = raw.split(";")[0].trim().toLowerCase()
  return ALLOWED_CONTENT_TYPES.has(normalized) ? normalized : "image/jpeg"
}

/** Returns true when the upstream content-length exceeds the allowed maximum. @source */
function exceedsMaxSize(response: Response): boolean {
  const header = response.headers.get("content-length")
  if (!header) return false
  const length = Number.parseInt(header, 10)
  return !Number.isNaN(length) && length > MAX_RESPONSE_BYTES
}

/**
 * Reads the full body of a response with a hard byte cap.
 * Returns the assembled buffer, or null if the cap is exceeded. @source
 */
async function readBodyWithCap(
  body: ReadableStream<Uint8Array>
): Promise<ArrayBuffer | null> {
  const reader = body.getReader()
  let totalBytes = 0
  const chunks: Uint8Array[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.length
    if (totalBytes > MAX_RESPONSE_BYTES) {
      reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const buffer = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.length
  }
  return buffer.buffer
}

/** Fetches a cover from Open Library and returns the raw response or an error status. @source */
async function fetchCover(
  url: string,
  log: ReturnType<typeof logger.withCorrelationId>
): Promise<Response | { status: number }> {
  try {
    return await fetch(url, {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    })
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      return { status: 504 }
    }
    log.error("Open Library cover fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return { status: 502 }
  }
}

/**
 * Proxies a book cover image from the Open Library Covers API by ISBN.
 * Requires authentication to prevent open proxy abuse.
 * @param request - Incoming request with `isbn` and optional `size` query parameters.
 * @returns The cover image stream with appropriate caching headers.
 * @source
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)

  // Require authentication to prevent open proxy abuse
  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) {
    return apiError(401, "Not authenticated", { correlationId })
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  const rl = await consumeDistributedRateLimit({
    key: `cover-proxy:user:${user.id}:ip:${clientIp}`,
    maxHits: 120,
    windowMs: 60_000,
    cooldownMs: 30_000,
    reason: "Rate limit cover proxy"
  })
  if (rl && !rl.allowed) {
    return apiError(429, "Too many requests", {
      correlationId,
      extra: { retryAfterMs: rl.retryAfterMs }
    })
  }
  const log = logger.withCorrelationId(correlationId)

  const isbnRaw = request.nextUrl.searchParams.get("isbn")?.trim() ?? ""
  const sizeRaw = request.nextUrl.searchParams.get("size")?.trim() ?? "L"

  if (!isbnRaw || !isValidIsbn(isbnRaw)) {
    return apiError(400, "Invalid ISBN")
  }

  const normalized = normalizeIsbn(isbnRaw)

  if (!/^[0-9X]{10,13}$/.test(normalized)) {
    return apiError(400, "Invalid ISBN")
  }

  const size = VALID_SIZES.has(sizeRaw.toUpperCase())
    ? (sizeRaw.toUpperCase() as "S" | "M" | "L")
    : "L"

  const base = new URL(OPEN_LIBRARY_BASE)
  const upstream = new URL(`${normalized}-${size}.jpg?default=false`, base)
  if (upstream.origin !== base.origin || upstream.protocol !== "https:") {
    log.error("Rejected invalid upstream cover URL", {
      url: upstream.toString()
    })
    return apiError(400, "Invalid cover request")
  }

  const result = await fetchCover(upstream.toString(), log)

  if (!("headers" in result)) {
    return new Response(null, { status: result.status })
  }

  const response = result
  if (response.status === 404) return new Response(null, { status: 404 })
  if (!response.ok || !response.body) return new Response(null, { status: 502 })
  if (exceedsMaxSize(response)) return new Response(null, { status: 413 })

  // Stream-read the body with a hard byte cap — guards against missing Content-Length
  const body = await readBodyWithCap(response.body)
  if (!body) return new Response(null, { status: 413 })

  const responseHeaders = new Headers()
  responseHeaders.set("Content-Type", resolveContentType(response))
  responseHeaders.set(
    "Cache-Control",
    "public, max-age=86400, stale-while-revalidate=604800"
  )
  responseHeaders.set("X-Content-Type-Options", "nosniff")
  responseHeaders.set(CORRELATION_HEADER, correlationId)

  return new Response(body, { headers: responseHeaders })
}
