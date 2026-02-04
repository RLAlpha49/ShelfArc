import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"

const STORAGE_PREFIX = "storage:"
const OPEN_LIBRARY_COVERS = "/api/covers/open-library"

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
