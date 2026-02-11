import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"

/** Prefix indicating a Supabase storage path. @source */
const STORAGE_PREFIX = "storage:"
/** Internal API route for Open Library cover proxying. @source */
const OPEN_LIBRARY_COVERS = "/api/covers/open-library"

/**
 * Extracts a Supabase storage path from a URL or `storage:` prefixed value.
 * @param value - The raw image URL or storage reference.
 * @returns The extracted storage path, or `null` if not a storage reference.
 * @source
 */
export function extractStoragePath(value?: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith(STORAGE_PREFIX)) {
    return trimmed.slice(STORAGE_PREFIX.length)
  }

  if (trimmed.startsWith("/api/storage/file?")) {
    try {
      const url = new URL(trimmed, "http://localhost")
      return url.searchParams.get("path")
    } catch {
      return null
    }
  }

  if (trimmed.includes("/api/storage/file?")) {
    try {
      const url = new URL(trimmed)
      if (
        (url.pathname === "/api/storage/file" ||
          url.pathname.startsWith("/api/storage/file/")) &&
        url.searchParams.has("path")
      ) {
        return url.searchParams.get("path")
      }
      return null
    } catch {
      return null
    }
  }

  return null
}

/**
 * Resolves an image value to a displayable URL, handling storage references.
 * @param value - The raw image URL or storage reference.
 * @returns A resolved URL string, or `undefined` if empty.
 * @source
 */
export function resolveImageUrl(value?: string | null): string | undefined {
  if (!value) return undefined

  const trimmed = value.trim()
  if (!trimmed) return undefined

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/api/storage/file?")
  ) {
    return trimmed
  }

  const path = trimmed.startsWith(STORAGE_PREFIX)
    ? trimmed.slice(STORAGE_PREFIX.length)
    : trimmed

  return `/api/storage/file?path=${encodeURIComponent(path)}`
}

/**
 * Builds an Open Library cover proxy URL for the given ISBN.
 * @param isbn - The raw ISBN string.
 * @param size - Cover size: "S", "M", or "L".
 * @returns The proxy URL, or `null` if the ISBN is invalid.
 * @source
 */
export function buildOpenLibraryCoverUrl(
  isbn?: string | null,
  size: "S" | "M" | "L" = "L"
): string | null {
  if (!isbn || !isValidIsbn(isbn)) return null
  const normalized = normalizeIsbn(isbn)
  return `${OPEN_LIBRARY_COVERS}?isbn=${encodeURIComponent(
    normalized
  )}&size=${size}`
}

/**
 * Builds a prioritized list of cover image URL candidates from available sources.
 * @param options - Object with `isbn`, `coverImageUrl`, and `fallbackCoverImageUrl`.
 * @returns A deduplicated array of candidate URLs.
 * @source
 */
export function getCoverCandidates({
  isbn,
  coverImageUrl,
  fallbackCoverImageUrl
}: {
  isbn?: string | null
  coverImageUrl?: string | null
  fallbackCoverImageUrl?: string | null
}): string[] {
  const candidates: string[] = []
  const primary = resolveImageUrl(coverImageUrl)
  if (primary) candidates.push(primary)

  const fallback = resolveImageUrl(fallbackCoverImageUrl)
  if (fallback && fallback !== primary) candidates.push(fallback)

  const openLibraryUrl = buildOpenLibraryCoverUrl(isbn)
  if (
    openLibraryUrl &&
    openLibraryUrl !== primary &&
    openLibraryUrl !== fallback
  ) {
    candidates.push(openLibraryUrl)
  }

  return Array.from(new Set(candidates))
}
