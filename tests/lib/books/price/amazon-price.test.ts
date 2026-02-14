import { describe, expect, it } from "bun:test"
import {
  createAmazonSearchContext,
  parseAmazonResult,
  type SearchContext
} from "@/lib/books/price/amazon-price"
import { ApiError } from "@/lib/books/price/api-error"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand to build URLSearchParams from a plain object. */
const params = (obj: Record<string, string>) => new URLSearchParams(obj)

/** Build a minimal SearchContext for parseAmazonResult tests. */
const makeContext = (overrides: Partial<SearchContext> = {}): SearchContext => ({
  domain: "amazon.com",
  host: "www.amazon.com",
  title: "One Piece",
  expectedTitle: "One Piece Volume 1 Manga Paperback",
  requiredTitle: "One Piece Volume 1",
  format: "Manga",
  bindingLabel: "Paperback",
  bindingLabels: ["Paperback", "Hardcover", "Hardback"],
  fallbackToKindle: false,
  volumeNumber: 1,
  volumeTitle: "One Piece, Vol. 1",
  volumeSubtitle: "",
  searchUrl: "https://www.amazon.com/s?k=One+Piece+Volume+1+Manga+Paperback",
  ...overrides
})

// ---------------------------------------------------------------------------
// HTML fixture builders
// ---------------------------------------------------------------------------

/**
 * Wraps result items in the Amazon search page skeleton.
 * Each item should be a `<div data-component-type="s-search-result">` string.
 */
const wrapInSearchPage = (...items: string[]) =>
  `<html><body><div id="search">${items.join("")}</div></body></html>`

/** Builds a single Amazon search result div with customisable parts. */
const makeResultItem = ({
  asin = "B0EXAMPLE1",
  title = "One Piece, Vol. 1",
  binding = "Paperback",
  price = "$9.99",
  imageUrl = "https://m.media-amazon.com/images/I/51abc._AC_UY218_.jpg",
  sponsored = false,
  extraLinks = ""
}: {
  asin?: string
  title?: string
  binding?: string
  price?: string | null
  imageUrl?: string | null
  sponsored?: boolean
  extraLinks?: string
} = {}) => {
  const adAttr = sponsored ? ' data-ad="true"' : ""
  const priceBlock = price
    ? `<span class="a-price"><span class="a-offscreen">${price}</span></span>`
    : ""
  const imgBlock = imageUrl
    ? `<img class="s-image" src="${imageUrl}" />`
    : ""

  return `
    <div data-component-type="s-search-result" data-asin="${asin}"${adAttr}>
      <h2><a href="/dp/${asin}"><span class="a-text-normal">${title}</span></a></h2>
      ${imgBlock}
      <div>
        <a>${binding}</a>
        <div>${priceBlock}</div>
      </div>
      ${extraLinks}
    </div>
  `
}

// ---------------------------------------------------------------------------
// createAmazonSearchContext
// ---------------------------------------------------------------------------

describe("createAmazonSearchContext", () => {
  it("builds a basic context from title only", () => {
    const ctx = createAmazonSearchContext(params({ title: "Naruto" }))
    expect(ctx.title).toBe("Naruto")
    expect(ctx.domain).toBe("amazon.com")
    expect(ctx.host).toBe("www.amazon.com")
    expect(ctx.bindingLabel).toBe("Paperback")
    expect(ctx.volumeNumber).toBeNull()
    expect(ctx.searchUrl).toContain("amazon.com/s?k=")
    expect(ctx.searchUrl).toContain("Naruto")
  })

  it("throws ApiError(400) when title is missing", () => {
    expect(() => createAmazonSearchContext(params({}))).toThrow(ApiError)
    try {
      createAmazonSearchContext(params({}))
    } catch (e) {
      expect((e as ApiError).status).toBe(400)
    }
  })

  it("throws ApiError(400) when title is empty/whitespace", () => {
    expect(() => createAmazonSearchContext(params({ title: "   " }))).toThrow(
      ApiError
    )
  })

  it("resolves volume number from params", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "One Piece", volume: "5" })
    )
    expect(ctx.volumeNumber).toBe(5)
    expect(ctx.requiredTitle).toContain("Volume 5")
  })

  it("treats non-numeric volume as null", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "One Piece", volume: "abc" })
    )
    expect(ctx.volumeNumber).toBeNull()
  })

  it("uses the supplied binding label", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "Naruto", binding: "Hardcover" })
    )
    expect(ctx.bindingLabel).toBe("Hardcover")
  })

  it("resolves domain to amazon.co.uk", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "Naruto", domain: "amazon.co.uk" })
    )
    expect(ctx.domain).toBe("amazon.co.uk")
    expect(ctx.host).toBe("www.amazon.co.uk")
    expect(ctx.searchUrl).toContain("amazon.co.uk")
  })

  it("resolves domain to amazon.de", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "Naruto", domain: "amazon.de" })
    )
    expect(ctx.domain).toBe("amazon.de")
    expect(ctx.host).toBe("www.amazon.de")
  })

  it("resolves domain to amazon.co.jp", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "Naruto", domain: "amazon.co.jp" })
    )
    expect(ctx.domain).toBe("amazon.co.jp")
    expect(ctx.host).toBe("www.amazon.co.jp")
  })

  it("defaults unknown domain to amazon.com", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "Naruto", domain: "amazon.fr" })
    )
    expect(ctx.domain).toBe("amazon.com")
  })

  it("strips protocol/www prefix from domain", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "Naruto", domain: "https://www.amazon.co.uk" })
    )
    expect(ctx.domain).toBe("amazon.co.uk")
  })

  it("includes format in search URL", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "Naruto", volume: "1", format: "Manga" })
    )
    expect(ctx.searchUrl).toContain("Manga")
    expect(ctx.format).toBe("Manga")
  })

  it("adds hardcover fallback for paperback binding", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "Naruto", binding: "Paperback" })
    )
    expect(ctx.bindingLabels).toContain("Paperback")
    expect(ctx.bindingLabels).toContain("Hardcover")
    expect(ctx.bindingLabels).toContain("Hardback")
  })

  it("adds Kindle fallback when enabled", () => {
    const ctx = createAmazonSearchContext(
      params({
        title: "Naruto",
        binding: "Paperback",
        fallbackToKindle: "true"
      })
    )
    expect(ctx.bindingLabels).toContain("Kindle")
  })

  it("does not add Kindle fallback when disabled", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "Naruto", binding: "Paperback" })
    )
    const hasKindle = ctx.bindingLabels.some((l) =>
      l.toLowerCase().includes("kindle")
    )
    expect(hasKindle).toBe(false)
  })

  it("truncates overly long titles", () => {
    const longTitle = "A".repeat(300)
    const ctx = createAmazonSearchContext(params({ title: longTitle }))
    expect(ctx.title.length).toBeLessThanOrEqual(200)
  })

  it("populates volumeTitle and volumeSubtitle", () => {
    const ctx = createAmazonSearchContext(
      params({
        title: "One Piece",
        volume: "1",
        volumeTitle: "One Piece, Vol. 1 (Special Edition)"
      })
    )
    expect(ctx.volumeTitle).toBe("One Piece, Vol. 1 (Special Edition)")
    // "Special Edition" minus the series/volume/format/binding tokens → subtitle
    expect(ctx.volumeSubtitle).toContain("special")
  })

  it("generates a valid search URL", () => {
    const ctx = createAmazonSearchContext(
      params({ title: "My Hero Academia", volume: "3", format: "Manga" })
    )
    expect(() => new URL(ctx.searchUrl)).not.toThrow()
    const url = new URL(ctx.searchUrl)
    expect(url.searchParams.get("k")).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// parseAmazonResult — scoring & ranking
// ---------------------------------------------------------------------------

describe("parseAmazonResult — scoring", () => {
  it("returns the best-matching result", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "One Piece, Vol. 1",
        price: "$9.99"
      }),
      makeResultItem({
        asin: "A2",
        title: "Two Piece, Vol. 1",
        price: "$8.99"
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toBe("One Piece, Vol. 1")
    expect(result.matchScore).toBeGreaterThan(0)
  })

  it("prefers exact volume match over partial title match", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "One Piece, Vol. 2",
        price: "$9.99"
      }),
      makeResultItem({
        asin: "A2",
        title: "One Piece, Vol. 1",
        price: "$10.99"
      })
    )
    const ctx = makeContext({ volumeNumber: 1 })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toBe("One Piece, Vol. 1")
  })

  it("rejects results below match threshold", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "Totally Unrelated Book About Cooking",
        price: "$5.00"
      })
    )
    const ctx = makeContext()
    expect(() =>
      parseAmazonResult(html, ctx, {
        includePrice: true,
        includeImage: false
      })
    ).toThrow(ApiError)
  })

  it("applies format conflict penalty (manga vs light novel)", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "One Piece, Vol. 1 (Light Novel)",
        price: "$12.99"
      }),
      makeResultItem({
        asin: "A2",
        title: "One Piece, Vol. 1",
        price: "$9.99"
      })
    )
    const ctx = makeContext({ format: "Manga" })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    // The non-light-novel result should win since format is Manga
    expect(result.resultTitle).toBe("One Piece, Vol. 1")
  })

  it("skips sponsored results", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "AD1",
        title: "One Piece, Vol. 1 (SPONSORED)",
        price: "$1.00",
        sponsored: true
      }),
      makeResultItem({
        asin: "A1",
        title: "One Piece, Vol. 1",
        price: "$9.99"
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toBe("One Piece, Vol. 1")
  })

  it("ignores low-scoring results and selects the best match", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "WEAK",
        title: "Totally Different Gardening Guide",
        price: "$4.99"
      }),
      makeResultItem({
        asin: "A1",
        title: "One Piece, Vol. 1",
        price: "$9.99"
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toBe("One Piece, Vol. 1")
  })

  it("handles special characters in titles", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "Re:ZERO −Starting Life in Another World−, Vol. 1",
        price: "$14.99"
      })
    )
    const ctx = makeContext({
      title: "Re:ZERO Starting Life in Another World",
      expectedTitle:
        "Re:ZERO Starting Life in Another World Volume 1 Light Novel Paperback",
      requiredTitle: "Re:ZERO Starting Life in Another World Volume 1",
      volumeNumber: 1,
      volumeTitle: "Re:ZERO −Starting Life in Another World−, Vol. 1",
      format: "Light Novel"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toContain("Re:ZERO")
    expect(result.matchScore).toBeGreaterThan(0)
  })

  it("handles volume number with zero-padding (Vol. 01)", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "Naruto, Vol. 01",
        price: "$9.99"
      })
    )
    const ctx = makeContext({
      title: "Naruto",
      expectedTitle: "Naruto Volume 1 Manga Paperback",
      requiredTitle: "Naruto Volume 1",
      volumeNumber: 1,
      volumeTitle: "Naruto, Vol. 1"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toBe("Naruto, Vol. 01")
  })

  it("penalizes volume range that doesn't include expected volume", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "One Piece Box Set Vol. 4-6",
        price: "$29.99"
      }),
      makeResultItem({
        asin: "A2",
        title: "One Piece, Vol. 1",
        price: "$9.99"
      })
    )
    const ctx = makeContext({ volumeNumber: 1 })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toBe("One Piece, Vol. 1")
  })

  it("accepts volume range that includes expected volume", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "One Piece Box Set Vol. 1-3",
        price: "$25.99"
      })
    )
    const ctx = makeContext({
      volumeNumber: 2,
      expectedTitle: "One Piece Volume 2 Manga Paperback",
      requiredTitle: "One Piece Volume 2"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toContain("One Piece")
  })

  it("handles no volumeNumber gracefully", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "One Piece Complete Box Set",
        price: "$149.99"
      })
    )
    const ctx = makeContext({
      volumeNumber: null,
      expectedTitle: "One Piece Manga Paperback",
      requiredTitle: "One Piece"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toContain("One Piece")
  })
})

// ---------------------------------------------------------------------------
// parseAmazonResult — price extraction & formatting
// ---------------------------------------------------------------------------

describe("parseAmazonResult — price extraction", () => {
  it("extracts USD price", () => {
    const html = wrapInSearchPage(
      makeResultItem({ title: "One Piece, Vol. 1", price: "$9.99" })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceText).toBe("$9.99")
    expect(result.priceValue).toBe(9.99)
    expect(result.currency).toBe("USD")
    expect(result.priceBinding).toBe("Paperback")
    expect(result.priceError).toBeNull()
  })

  it("extracts GBP price", () => {
    const html = wrapInSearchPage(
      makeResultItem({ title: "One Piece, Vol. 1", price: "£7.99" })
    )
    const ctx = makeContext({
      domain: "amazon.co.uk",
      host: "www.amazon.co.uk"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceValue).toBe(7.99)
    expect(result.currency).toBe("GBP")
  })

  it("extracts EUR price with comma decimal (amazon.de)", () => {
    const html = wrapInSearchPage(
      makeResultItem({ title: "One Piece, Vol. 1", price: "8,99 €" })
    )
    const ctx = makeContext({
      domain: "amazon.de",
      host: "www.amazon.de"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceValue).toBe(8.99)
    expect(result.currency).toBe("EUR")
  })

  it("extracts JPY price", () => {
    const html = wrapInSearchPage(
      makeResultItem({ title: "One Piece, Vol. 1", price: "¥550" })
    )
    const ctx = makeContext({
      domain: "amazon.co.jp",
      host: "www.amazon.co.jp"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceValue).toBe(550)
    expect(result.currency).toBe("JPY")
  })

  it("extracts CAD price", () => {
    const html = wrapInSearchPage(
      makeResultItem({ title: "One Piece, Vol. 1", price: "CA$13.99" })
    )
    const ctx = makeContext({
      domain: "amazon.ca",
      host: "www.amazon.ca"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceValue).toBe(13.99)
    expect(result.currency).toBe("CAD")
  })

  it("handles high price values", () => {
    const html = wrapInSearchPage(
      makeResultItem({ title: "One Piece, Vol. 1", price: "$1,299.99" })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceValue).toBe(1299.99)
  })

  it("skips price extraction when includePrice is false", () => {
    const html = wrapInSearchPage(
      makeResultItem({ title: "One Piece, Vol. 1", price: "$9.99" })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: false,
      includeImage: false
    })
    expect(result.priceText).toBeNull()
    expect(result.priceValue).toBeNull()
    expect(result.currency).toBeNull()
    expect(result.priceBinding).toBeNull()
    expect(result.priceError).toBeNull()
  })

  it("reports price error when no binding link matches", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        title: "One Piece, Vol. 1",
        binding: "Audio CD",
        price: "$9.99"
      })
    )
    const ctx = makeContext({ bindingLabels: ["Paperback"] })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceError).toBeTruthy()
    expect(result.priceText).toBeNull()
  })

  it("reports price error when price element is missing", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        title: "One Piece, Vol. 1",
        binding: "Paperback",
        price: null
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceError).toBeTruthy()
    expect(result.priceValue).toBeNull()
  })

  it("falls back to next candidate when best has no price", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "One Piece, Vol. 1",
        binding: "Audio CD",
        price: "$99.99"
      }),
      makeResultItem({
        asin: "A2",
        title: "One Piece, Vol. 1 (Manga)",
        binding: "Paperback",
        price: "$9.99"
      })
    )
    const ctx = makeContext({
      bindingLabels: ["Paperback"],
      expectedTitle: "One Piece Volume 1 Manga Paperback",
      requiredTitle: "One Piece Volume 1"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceValue).toBe(9.99)
    expect(result.priceBinding).toBe("Paperback")
  })
})

// ---------------------------------------------------------------------------
// parseAmazonResult — URL & image extraction
// ---------------------------------------------------------------------------

describe("parseAmazonResult — URL & image extraction", () => {
  it("extracts ASIN-based product URL", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "B0MYASIN01",
        title: "One Piece, Vol. 1",
        price: "$9.99"
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.productUrl).toBe(
      "https://www.amazon.com/dp/B0MYASIN01"
    )
  })

  it("extracts full-size image URL from thumbnail", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        title: "One Piece, Vol. 1",
        price: "$9.99",
        imageUrl:
          "https://m.media-amazon.com/images/I/51abc123._AC_UY218_.jpg"
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: true
    })
    expect(result.imageUrl).toBe(
      "https://m.media-amazon.com/images/I/51abc123.jpg"
    )
  })

  it("returns null image when includeImage is false", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        title: "One Piece, Vol. 1",
        price: "$9.99",
        imageUrl:
          "https://m.media-amazon.com/images/I/51abc123._AC_UY218_.jpg"
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.imageUrl).toBeNull()
  })

  it("returns null image when img element is missing", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        title: "One Piece, Vol. 1",
        price: "$9.99",
        imageUrl: null
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: true
    })
    expect(result.imageUrl).toBeNull()
  })

  it("returns null image when src is not a media-amazon.com URL", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        title: "One Piece, Vol. 1",
        price: "$9.99",
        imageUrl: "https://example.com/image.jpg"
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: true
    })
    expect(result.imageUrl).toBeNull()
  })

  it("builds product URL on non-US domain", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "B0UK12345",
        title: "One Piece, Vol. 1",
        price: "£7.99"
      })
    )
    const ctx = makeContext({
      domain: "amazon.co.uk",
      host: "www.amazon.co.uk"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.productUrl).toBe(
      "https://www.amazon.co.uk/dp/B0UK12345"
    )
  })
})

// ---------------------------------------------------------------------------
// parseAmazonResult — error handling
// ---------------------------------------------------------------------------

describe("parseAmazonResult — error handling", () => {
  it("throws 502 when #search root is missing", () => {
    const html = "<html><body><div>no search div</div></body></html>"
    const ctx = makeContext()
    try {
      parseAmazonResult(html, ctx, {
        includePrice: true,
        includeImage: false
      })
      expect(true).toBe(false) // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(502)
    }
  })

  it("throws 404 when search root exists but has no results", () => {
    const html = '<html><body><div id="search"></div></body></html>'
    const ctx = makeContext()
    try {
      parseAmazonResult(html, ctx, {
        includePrice: true,
        includeImage: false
      })
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(404)
    }
  })

  it("throws 404 when all results are below match threshold", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        title: "Completely Unrelated Title About Gardening",
        price: "$5.00"
      })
    )
    const ctx = makeContext()
    try {
      parseAmazonResult(html, ctx, {
        includePrice: true,
        includeImage: false
      })
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
      expect((e as ApiError).status).toBe(404)
      expect((e as ApiError).message).toContain("match")
    }
  })

  it("handles empty HTML gracefully (throws, not crash)", () => {
    const ctx = makeContext()
    expect(() =>
      parseAmazonResult("", ctx, {
        includePrice: true,
        includeImage: false
      })
    ).toThrow(ApiError)
  })

  it("handles malformed HTML without crashing", () => {
    const html =
      '<div id="search"><div data-component-type="s-search-result"><h2><a><span class="a-text-normal">One Piece, Vol. 1</span></a></h2></div></div>'
    const ctx = makeContext()
    // Should either return a result or throw ApiError, but never crash
    try {
      const result = parseAmazonResult(html, ctx, {
        includePrice: true,
        includeImage: false
      })
      expect(result.resultTitle).toBe("One Piece, Vol. 1")
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError)
    }
  })

  it("throws when all result items lack titles", () => {
    const badItem = `
      <div data-component-type="s-search-result" data-asin="BAD1">
      </div>
    `
    const html = wrapInSearchPage(badItem)
    const ctx = makeContext()
    expect(() =>
      parseAmazonResult(html, ctx, {
        includePrice: true,
        includeImage: false
      })
    ).toThrow()
  })
})

// ---------------------------------------------------------------------------
// parseAmazonResult — binding fallback
// ---------------------------------------------------------------------------

describe("parseAmazonResult — binding fallback", () => {
  it("falls back to Hardcover when Paperback link not found", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        title: "One Piece, Vol. 1",
        binding: "Hardcover",
        price: "$15.99"
      })
    )
    const ctx = makeContext({
      bindingLabel: "Paperback",
      bindingLabels: ["Paperback", "Hardcover", "Hardback"]
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceValue).toBe(15.99)
    expect(result.priceBinding).toBe("Hardcover")
  })

  it("falls back to Kindle when enabled", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        title: "One Piece, Vol. 1",
        binding: "Kindle",
        price: "$6.99"
      })
    )
    const ctx = makeContext({
      bindingLabel: "Paperback",
      bindingLabels: ["Paperback", "Hardcover", "Hardback", "Kindle"],
      fallbackToKindle: true
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.priceValue).toBe(6.99)
    expect(result.priceBinding).toBe("Kindle")
  })
})

// ---------------------------------------------------------------------------
// parseAmazonResult — result shape
// ---------------------------------------------------------------------------

describe("parseAmazonResult — result shape", () => {
  it("returns all expected fields", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "B012345",
        title: "One Piece, Vol. 1",
        price: "$9.99",
        imageUrl:
          "https://m.media-amazon.com/images/I/51test._AC_UY218_.jpg"
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: true
    })

    expect(result).toHaveProperty("resultTitle")
    expect(result).toHaveProperty("matchScore")
    expect(result).toHaveProperty("priceText")
    expect(result).toHaveProperty("priceValue")
    expect(result).toHaveProperty("currency")
    expect(result).toHaveProperty("priceBinding")
    expect(result).toHaveProperty("priceError")
    expect(result).toHaveProperty("productUrl")
    expect(result).toHaveProperty("imageUrl")

    expect(typeof result.resultTitle).toBe("string")
    expect(typeof result.matchScore).toBe("number")
    expect(result.matchScore).toBeGreaterThan(0)
    expect(result.matchScore).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// parseAmazonResult — multiple results ranking
// ---------------------------------------------------------------------------

describe("parseAmazonResult — multi-result ranking", () => {
  it("ranks exact title higher than partial match", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "One Piece: Pirate Recipes Vol 1",
        price: "$19.99"
      }),
      makeResultItem({
        asin: "A2",
        title: "One Piece, Vol. 1",
        price: "$9.99"
      }),
      makeResultItem({
        asin: "A3",
        title: "One Piece Omnibus Edition Vol. 1",
        price: "$14.99"
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toBe("One Piece, Vol. 1")
  })

  it("penalizes results with extra unrecognized tokens", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title:
          "One Piece, Vol. 1 Collector Premium Deluxe Gold Limited Legacy",
        price: "$49.99"
      }),
      makeResultItem({
        asin: "A2",
        title: "One Piece, Vol. 1",
        price: "$9.99"
      })
    )
    const ctx = makeContext()
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toBe("One Piece, Vol. 1")
  })

  it("applies manga vs light novel format penalty", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "Overlord, Vol. 1 (light novel)",
        price: "$14.99"
      }),
      makeResultItem({
        asin: "A2",
        title: "Overlord, Vol. 1 (manga)",
        price: "$12.99"
      })
    )
    const ctx = makeContext({
      title: "Overlord",
      expectedTitle: "Overlord Volume 1 Manga Paperback",
      requiredTitle: "Overlord Volume 1",
      volumeNumber: 1,
      volumeTitle: "Overlord, Vol. 1",
      format: "Manga"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toContain("manga")
  })

  it("applies light novel vs manga format penalty (reverse)", () => {
    const html = wrapInSearchPage(
      makeResultItem({
        asin: "A1",
        title: "Overlord, Vol. 1 (manga)",
        price: "$12.99"
      }),
      makeResultItem({
        asin: "A2",
        title: "Overlord, Vol. 1 (light novel)",
        price: "$14.99"
      })
    )
    const ctx = makeContext({
      title: "Overlord",
      expectedTitle: "Overlord Volume 1 Light Novel Paperback",
      requiredTitle: "Overlord Volume 1",
      volumeNumber: 1,
      volumeTitle: "Overlord, Vol. 1",
      format: "Light Novel"
    })
    const result = parseAmazonResult(html, ctx, {
      includePrice: true,
      includeImage: false
    })
    expect(result.resultTitle).toContain("light novel")
  })
})
