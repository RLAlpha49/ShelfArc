import { describe, expect, it } from "bun:test"

import {
  buildOpenLibraryCoverUrl,
  extractStoragePath,
  getCoverCandidates,
  resolveImageUrl
} from "@/lib/uploads/resolve-image-url"

// ─── extractStoragePath ────────────────────────────────────────────────────

describe("extractStoragePath", () => {
  it("returns null for null input", () => {
    expect(extractStoragePath(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(extractStoragePath()).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(extractStoragePath("")).toBeNull()
  })

  it("returns null for a whitespace-only string", () => {
    expect(extractStoragePath("   ")).toBeNull()
  })

  it("extracts path from a storage: prefixed value", () => {
    expect(extractStoragePath("storage:user-1/covers/book.webp")).toBe(
      "user-1/covers/book.webp"
    )
  })

  it("returns an empty string for 'storage:' with no path", () => {
    // The prefix is stripped; result is empty string
    expect(extractStoragePath("storage:")).toBe("")
  })

  it("extracts the path query param from a relative /api/storage/file? URL", () => {
    expect(
      extractStoragePath("/api/storage/file?path=user-1%2Fcovers%2Fbook.webp")
    ).toBe("user-1/covers/book.webp")
  })

  it("extracts the path query param from a full /api/storage/file? URL", () => {
    expect(
      extractStoragePath(
        "http://localhost:3000/api/storage/file?path=user-1%2Fbook.webp"
      )
    ).toBe("user-1/book.webp")
  })

  it("returns null for a plain HTTPS URL that is not a storage reference", () => {
    expect(extractStoragePath("https://example.com/image.jpg")).toBeNull()
  })

  it("returns null for a plain relative path", () => {
    expect(extractStoragePath("user-1/covers/book.webp")).toBeNull()
  })

  it("returns null when /api/storage/file? URL has no path param", () => {
    expect(extractStoragePath("/api/storage/file?foo=bar")).toBeNull()
  })
})

// ─── resolveImageUrl ───────────────────────────────────────────────────────

describe("resolveImageUrl", () => {
  it("returns undefined for null", () => {
    expect(resolveImageUrl(null)).toBeUndefined()
  })

  it("returns undefined for undefined", () => {
    expect(resolveImageUrl()).toBeUndefined()
  })

  it("returns undefined for an empty string", () => {
    expect(resolveImageUrl("")).toBeUndefined()
  })

  it("returns undefined for a whitespace-only string", () => {
    expect(resolveImageUrl("   ")).toBeUndefined()
  })

  it("passes through an https:// URL unchanged", () => {
    expect(resolveImageUrl("https://example.com/cover.jpg")).toBe(
      "https://example.com/cover.jpg"
    )
  })

  it("passes through an http:// URL unchanged", () => {
    expect(resolveImageUrl("http://example.com/cover.jpg")).toBe(
      "http://example.com/cover.jpg"
    )
  })

  it("passes through a data: URL unchanged", () => {
    const data = "data:image/png;base64,abc123"
    expect(resolveImageUrl(data)).toBe(data)
  })

  it("passes through a blob: URL unchanged", () => {
    const blob = "blob:http://localhost/some-uuid"
    expect(resolveImageUrl(blob)).toBe(blob)
  })

  it("passes through a /api/storage/file? URL unchanged", () => {
    const url = "/api/storage/file?path=user-1%2Fcovers%2Fbook.webp"
    expect(resolveImageUrl(url)).toBe(url)
  })

  it("converts a storage: prefixed value to a /api/storage/file? URL", () => {
    expect(resolveImageUrl("storage:user-1/covers/book.webp")).toBe(
      "/api/storage/file?path=user-1%2Fcovers%2Fbook.webp"
    )
  })

  it("converts a plain relative path to a /api/storage/file? URL", () => {
    expect(resolveImageUrl("user-1/covers/book.webp")).toBe(
      "/api/storage/file?path=user-1%2Fcovers%2Fbook.webp"
    )
  })

  it("encodes special characters in storage paths", () => {
    expect(resolveImageUrl("storage:user-1/covers/my book.webp")).toBe(
      "/api/storage/file?path=user-1%2Fcovers%2Fmy%20book.webp"
    )
  })
})

// ─── buildOpenLibraryCoverUrl ──────────────────────────────────────────────

describe("buildOpenLibraryCoverUrl", () => {
  const validIsbn10 = "0-306-40615-2" // normalises to 0306406152
  const validIsbn13 = "978-0-306-40615-7" // normalises to 9780306406157

  it("returns null for null input", () => {
    expect(buildOpenLibraryCoverUrl(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(buildOpenLibraryCoverUrl()).toBeNull()
  })

  it("returns null for an invalid ISBN", () => {
    expect(buildOpenLibraryCoverUrl("1234567890")).toBeNull()
  })

  it("returns null for a short invalid string", () => {
    expect(buildOpenLibraryCoverUrl("000")).toBeNull()
  })

  it("builds a proxy URL for a valid ISBN-10", () => {
    const url = buildOpenLibraryCoverUrl(validIsbn10)
    expect(url).toContain("/api/covers/open-library")
    expect(url).toContain("isbn=0306406152")
    expect(url).toContain("size=L")
  })

  it("builds a proxy URL for a valid ISBN-13", () => {
    const url = buildOpenLibraryCoverUrl(validIsbn13)
    expect(url).toContain("/api/covers/open-library")
    expect(url).toContain("isbn=9780306406157")
    expect(url).toContain("size=L")
  })

  it("defaults to size L", () => {
    const url = buildOpenLibraryCoverUrl(validIsbn10)
    expect(url).toContain("size=L")
  })

  it("uses the supplied size parameter", () => {
    expect(buildOpenLibraryCoverUrl(validIsbn10, "S")).toContain("size=S")
    expect(buildOpenLibraryCoverUrl(validIsbn10, "M")).toContain("size=M")
    expect(buildOpenLibraryCoverUrl(validIsbn10, "L")).toContain("size=L")
  })

  it("URL-encodes the normalised ISBN", () => {
    const url = buildOpenLibraryCoverUrl(validIsbn10)
    // The normalised value (digits only) doesn't need encoding, but verify
    // the param is present without raw hyphens from the raw input
    expect(url).not.toContain("306-40615")
  })
})

// ─── getCoverCandidates ────────────────────────────────────────────────────

describe("getCoverCandidates", () => {
  const validIsbn = "0-306-40615-2"

  it("returns an empty array when all inputs are empty", () => {
    expect(getCoverCandidates({})).toEqual([])
  })

  it("returns the primary URL when only coverImageUrl is set", () => {
    const candidates = getCoverCandidates({
      coverImageUrl: "https://example.com/cover.jpg"
    })
    expect(candidates).toEqual(["https://example.com/cover.jpg"])
  })

  it("returns both primary and fallback when both are set and different", () => {
    const candidates = getCoverCandidates({
      coverImageUrl: "https://example.com/cover.jpg",
      fallbackCoverImageUrl: "https://example.com/fallback.jpg"
    })
    expect(candidates[0]).toBe("https://example.com/cover.jpg")
    expect(candidates[1]).toBe("https://example.com/fallback.jpg")
    expect(candidates).toHaveLength(2)
  })

  it("deduplicates identical primary and fallback URLs", () => {
    const candidates = getCoverCandidates({
      coverImageUrl: "https://example.com/cover.jpg",
      fallbackCoverImageUrl: "https://example.com/cover.jpg"
    })
    expect(candidates).toHaveLength(1)
  })

  it("includes an Open Library URL for a valid ISBN", () => {
    const candidates = getCoverCandidates({ isbn: validIsbn })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toContain("/api/covers/open-library")
    expect(candidates[0]).toContain("isbn=0306406152")
  })

  it("omits the Open Library URL for an invalid ISBN", () => {
    const candidates = getCoverCandidates({ isbn: "not-an-isbn" })
    expect(candidates).toHaveLength(0)
  })

  it("returns candidates in priority order: primary, fallback, Open Library", () => {
    const candidates = getCoverCandidates({
      coverImageUrl: "https://example.com/cover.jpg",
      fallbackCoverImageUrl: "https://example.com/fallback.jpg",
      isbn: validIsbn
    })
    expect(candidates[0]).toBe("https://example.com/cover.jpg")
    expect(candidates[1]).toBe("https://example.com/fallback.jpg")
    expect(candidates[2]).toContain("/api/covers/open-library")
    expect(candidates).toHaveLength(3)
  })

  it("does not add Open Library URL when it matches the primary URL", () => {
    // Construct the exact Open Library URL as coverImageUrl
    const olUrl = buildOpenLibraryCoverUrl(validIsbn)!
    const candidates = getCoverCandidates({
      coverImageUrl: olUrl,
      isbn: validIsbn
    })
    // Should not be duplicated
    const olCount = candidates.filter((c) => c.includes("/api/covers")).length
    expect(olCount).toBe(1)
  })

  it("resolves storage: prefixed coverImageUrl to a proper URL", () => {
    const candidates = getCoverCandidates({
      coverImageUrl: "storage:user-1/covers/book.webp"
    })
    expect(candidates[0]).toContain("/api/storage/file?path=")
  })

  it("returns deduplicated results as a Set", () => {
    const url = "https://example.com/cover.jpg"
    const candidates = getCoverCandidates({
      coverImageUrl: url,
      fallbackCoverImageUrl: url,
      isbn: "not-an-isbn" // invalid so no Open Library URL
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toBe(url)
  })
})
