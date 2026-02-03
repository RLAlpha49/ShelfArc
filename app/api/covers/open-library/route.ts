import { NextResponse, type NextRequest } from "next/server"
import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"

const OPEN_LIBRARY_BASE = "https://covers.openlibrary.org/b/isbn"
const VALID_SIZES = new Set(["S", "M", "L"])
const FETCH_TIMEOUT_MS = 5000

export async function GET(request: NextRequest) {
  const isbnRaw = request.nextUrl.searchParams.get("isbn")?.trim() ?? ""
  const sizeRaw = request.nextUrl.searchParams.get("size")?.trim() ?? "L"

  if (!isbnRaw || !isValidIsbn(isbnRaw)) {
    return NextResponse.json({ error: "Invalid ISBN" }, { status: 400 })
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
    console.error("Open Library cover fetch failed", error)
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

  return new Response(response.body, { headers })
}
