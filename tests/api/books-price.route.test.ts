import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { ApiError } from "../../lib/books/price/api-error"
import { ConcurrencyLimitError } from "../../lib/concurrency/limiter"
import { makeNextRequest, readJson } from "./test-utils"

// Prevent "server-only" guard from throwing in the test environment
mock.module("server-only", () => ({}))

// Prevent cheerio (used by bookwalker-price) from loading in the test
// environment, where node:stream 'finished' may not be available.
mock.module("@/lib/books/price/bookwalker-price", () => ({
  createBookWalkerSearchContext: mock(() => {
    throw new Error("BookWalker not under test")
  }),
  fetchBookWalkerHtml: mock(async () => ""),
  parseBookWalkerResult: mock(() => {
    throw new Error("BookWalker not under test")
  })
}))

type RateLimitModule = {
  isRateLimited: ReturnType<typeof mock>
  getCooldownRemaining: ReturnType<typeof mock>
  recordFailure: ReturnType<typeof mock>
}

type AmazonPriceMocks = {
  createAmazonSearchContext: ReturnType<typeof mock>
  fetchAmazonHtml: ReturnType<typeof mock>
  parseAmazonResult: ReturnType<typeof mock>
}

// Default search context returned by the mock unless overridden.
const makeDefaultContext = () => ({
  domain: "amazon.com",
  host: "www.amazon.com",
  title: "My Book",
  expectedTitle: "My Book",
  requiredTitle: "My Book",
  format: "",
  bindingLabel: "Paperback",
  bindingLabels: ["Paperback"],
  fallbackToKindle: false,
  volumeNumber: null,
  volumeTitle: "",
  volumeSubtitle: "",
  searchUrl: "https://www.amazon.com/s?k=My+Book+Paperback"
})

// Re-registers the amazon-price mocks for each test so that module-level
// mocks from other test files (e.g. library-volumes-batch-scrape) cannot
// contaminate this file when Bun collects all modules before running tests.
const registerAmazonPriceMocks = (overrides?: Partial<AmazonPriceMocks>) => {
  const local: AmazonPriceMocks = {
    createAmazonSearchContext: mock(() => makeDefaultContext()),
    fetchAmazonHtml: mock(async () => "<html></html>"),
    parseAmazonResult: mock(() => ({
      resultTitle: "My Book",
      matchScore: 1,
      priceText: null,
      priceValue: null,
      currency: null,
      priceBinding: null,
      priceError: null,
      productUrl: null,
      imageUrl: null
    })),
    ...overrides
  }
  mock.module("@/lib/books/price/amazon-price", () => local)
  return local
}

// Helper to register fresh rate-limit mocks for a test
const registerRateLimitMocks = (overrides?: Partial<RateLimitModule>) => {
  const local = {
    isRateLimited: mock(() => false),
    getCooldownRemaining: mock(() => 0),
    recordFailure: mock(() => undefined),
    ...overrides
  } as RateLimitModule
  mock.module("@/lib/rate-limit", () => local)
  return local
}

// Helper to register fresh distributed rate-limit mock
const registerDistributedRateLimitMocks = (
  override?: Partial<{ consumeDistributedRateLimit: ReturnType<typeof mock> }>
) => {
  const local = {
    consumeDistributedRateLimit: mock(async () => ({
      allowed: true,
      remainingHits: 10,
      retryAfterMs: 0
    })),
    ...override
  }
  mock.module("@/lib/rate-limit-distributed", () => local)
  return local
}

type BookWalkerMocks = {
  createBookWalkerSearchContext: ReturnType<typeof mock>
  fetchBookWalkerHtml: ReturnType<typeof mock>
  parseBookWalkerResult: ReturnType<typeof mock>
}

// Default BookWalker search context
const makeDefaultBWContext = () => ({
  title: "My Book",
  expectedTitle: "My Book",
  searchUrl: "https://bookwalker.jp/search/?word=My+Book"
})

// Re-registers BookWalker mocks for tests that exercise the bookwalker path.
const registerBookWalkerMocks = (overrides?: Partial<BookWalkerMocks>) => {
  const local: BookWalkerMocks = {
    createBookWalkerSearchContext: mock(() => makeDefaultBWContext()),
    fetchBookWalkerHtml: mock(async () => "<html></html>"),
    parseBookWalkerResult: mock(() => ({
      resultTitle: "My Book",
      matchScore: 1,
      priceText: "¥880",
      priceValue: 880,
      currency: "JPY",
      priceError: null,
      productUrl: null
    })),
    ...overrides
  }
  mock.module("@/lib/books/price/bookwalker-price", () => local)
  return local
}

// Build a chainable Supabase query stub that returns no cached rows
const makeQueryChain = () => ({
  select: () => makeQueryChain(),
  eq: () => makeQueryChain(),
  gt: () => makeQueryChain(),
  order: () => makeQueryChain(),
  limit: () => Promise.resolve({ data: [] })
})

const getUserMock = mock(
  async (): Promise<{ data: { user: { id: string } | null } }> => ({
    data: { user: { id: "user-1" } }
  })
)

const createUserClient = mock(async () => ({
  auth: { getUser: getUserMock },
  from: () => makeQueryChain()
}))

mock.module("@/lib/supabase/server", () => ({ createUserClient }))

const loadRoute = async () => await import("../../app/api/books/price/route")

let originalFetch: typeof globalThis.fetch

describe("GET /api/books/price", () => {
  beforeEach(() => {
    // capture current global.fetch per-test to avoid cross-test leakage when run concurrently
    originalFetch = globalThis.fetch

    // user/supabase mocks
    getUserMock.mockClear()
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
    createUserClient.mockClear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("returns 400 when title is missing", async () => {
    registerRateLimitMocks()
    registerDistributedRateLimitMocks()
    registerAmazonPriceMocks({
      createAmazonSearchContext: mock(() => {
        throw new ApiError(400, "Missing title")
      })
    })

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/price")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Missing title")
  })

  it("returns 429 when rate limited", async () => {
    registerRateLimitMocks()
    registerDistributedRateLimitMocks({
      consumeDistributedRateLimit: mock(async () => ({
        allowed: false,
        retryAfterMs: 120_000
      }))
    })
    registerAmazonPriceMocks()

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/price?title=My%20Book")
    )

    const body = await readJson<{ error: string; retryAfterMs: number }>(
      response
    )
    expect(response.status).toBe(429)
    expect(body.retryAfterMs).toBe(120_000)
    expect(body.error).toBe("Too many requests")
  })

  // ------------------------------------------------------------------
  // Timeout, concurrency errors, caching, and BookWalker error branches
  // ------------------------------------------------------------------

  it("returns 504 when the price pipeline times out", async () => {
    registerRateLimitMocks()
    registerDistributedRateLimitMocks()
    registerAmazonPriceMocks({
      fetchAmazonHtml: mock(async () => {
        throw new Error("Price pipeline timed out")
      })
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/books/price?title=My%20Book")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(504)
    expect(body.error).toContain("timed out")
  })

  it("returns 503 when the concurrency limiter queue is full", async () => {
    registerRateLimitMocks()
    registerDistributedRateLimitMocks()
    registerAmazonPriceMocks({
      fetchAmazonHtml: mock(async () => {
        throw new ConcurrencyLimitError("Server is busy, please retry", 1200)
      })
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/books/price?title=My%20Book")
    )

    const body = await readJson<{ error: string; retryAfterMs: number }>(
      response
    )
    expect(response.status).toBe(503)
    expect(body.error).toContain("busy")
    expect(body.retryAfterMs).toBe(1200)
  })

  it("returns cached Amazon price without calling the scraper", async () => {
    registerRateLimitMocks()
    registerDistributedRateLimitMocks()
    const amazonMocks = registerAmazonPriceMocks()

    const cachedRow = {
      price: "9.99",
      currency: "USD",
      product_url: "https://www.amazon.com/dp/BXYZ",
      scraped_at: new Date().toISOString()
    }

    // Build a query chain whose terminal .limit() returns the cached row.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const makeCacheChain = (data: unknown[]): any => ({
      select: () => makeCacheChain(data),
      eq: () => makeCacheChain(data),
      gt: () => makeCacheChain(data),
      order: () => makeCacheChain(data),
      limit: async () => ({ data })
    })

    createUserClient.mockResolvedValueOnce({
      auth: { getUser: getUserMock },
      from: (tbl: string) =>
        tbl === "price_history" ? makeCacheChain([cachedRow]) : makeQueryChain()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest(
        "http://localhost/api/books/price?title=My%20Book&volumeId=vol-123"
      )
    )

    const body = await readJson<{
      data: { result: { priceValue: number; currency: string } }
    }>(response)
    expect(response.status).toBe(200)
    expect(body.data.result.priceValue).toBe(9.99)
    expect(body.data.result.currency).toBe("USD")
    // The live scraper must not have been invoked.
    expect(amazonMocks.fetchAmazonHtml).not.toHaveBeenCalled()
  })

  it("returns 500 when BookWalker scraping throws an error", async () => {
    registerRateLimitMocks()
    registerDistributedRateLimitMocks()
    registerBookWalkerMocks({
      fetchBookWalkerHtml: mock(async () => {
        throw new Error("Network error")
      })
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest(
        "http://localhost/api/books/price?source=bookwalker&title=My%20Book"
      )
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toContain("failed")
  })

  it("returns parsed Amazon result payload", async () => {
    registerRateLimitMocks()
    registerDistributedRateLimitMocks()
    registerAmazonPriceMocks({
      fetchAmazonHtml: mock(
        async () => `
      <div id="search">
        <div data-component-type="s-search-result" data-asin="B123">
          <h2>
            <a href="/dp/B123">
              <span class="a-text-normal">My Book</span>
            </a>
          </h2>
          <div class="binding">
            <a>Paperback</a>
            <span class="a-price"><span class="a-offscreen">$12.34</span></span>
          </div>
          <img class="s-image" src="https://m.media-amazon.com/images/I/abc._AC_UY218_.jpg" />
        </div>
      </div>
    `
      ),
      parseAmazonResult: mock(() => ({
        resultTitle: "My Book",
        matchScore: 1,
        priceText: "$12.34",
        priceValue: 12.34,
        currency: "USD",
        priceBinding: "Paperback",
        priceError: null,
        productUrl: "https://www.amazon.com/dp/B123",
        imageUrl: "https://m.media-amazon.com/images/I/abc.jpg"
      }))
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest(
        "http://localhost/api/books/price?title=My%20Book&includeImage=true"
      )
    )

    const body = await readJson<{
      data: {
        result: {
          title: string
          priceText: string | null
          priceValue: number | null
          currency: string | null
          priceBinding: string | null
          priceError: string | null
          url: string | null
          imageUrl: string | null
        }
      }
    }>(response)

    expect(response.status).toBe(200)
    expect(body.data.result.title).toBe("My Book")
    expect(body.data.result.priceText).toBe("$12.34")
    expect(body.data.result.priceValue).toBe(12.34)
    expect(body.data.result.currency).toBe("USD")
    expect(body.data.result.priceBinding).toBe("Paperback")
    expect(body.data.result.priceError).toBeNull()
    expect(body.data.result.url).toBe("https://www.amazon.com/dp/B123")
    expect(body.data.result.imageUrl).toBe(
      "https://m.media-amazon.com/images/I/abc.jpg"
    )
  })

  // NOTE: This test trips the module-level circuit breaker and must run last
  // within this describe block since the tripped state persists in the module.
  it("returns 429 when global Amazon cooldown is active (circuit breaker)", async () => {
    // Trip the circuit: 3 requests that each return ApiError(429) from the
    // scraper trigger cbRecordFailure 3 times, which sets cooldownUntil.
    registerDistributedRateLimitMocks()
    registerAmazonPriceMocks({
      fetchAmazonHtml: mock(async () => {
        throw new ApiError(429, "anti-bot detected")
      })
    })

    const { GET } = await loadRoute()
    // Three triggering calls — after maxFailures=3 the circuit is tripped.
    for (let i = 0; i < 3; i++) {
      await GET(
        makeNextRequest("http://localhost/api/books/price?title=My%20Book")
      )
    }

    // The fourth request should hit checkGlobalCooldown() and return early.
    const response = await GET(
      makeNextRequest("http://localhost/api/books/price?title=My%20Book")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toContain("temporarily disabled")
  })
})
