import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { makeNextRequest, readJson } from "./test-utils"

type RateLimitModule = {
  isRateLimited: ReturnType<typeof mock>
  getCooldownRemaining: ReturnType<typeof mock>
  recordFailure: ReturnType<typeof mock>
}

const rateLimitMocks: RateLimitModule = {
  isRateLimited: mock(() => false),
  getCooldownRemaining: mock(() => 0),
  recordFailure: mock(() => undefined)
}

mock.module("@/lib/rate-limit", () => rateLimitMocks)

const distributedRateLimitMocks = {
  consumeDistributedRateLimit: mock(async () => null)
}

mock.module("@/lib/rate-limit-distributed", () => distributedRateLimitMocks)

const loadRoute = async () => await import("../../app/api/books/price/route")

const originalFetch = globalThis.fetch

describe("GET /api/books/price", () => {
  beforeEach(() => {
    rateLimitMocks.isRateLimited.mockClear()
    rateLimitMocks.getCooldownRemaining.mockClear()
    rateLimitMocks.recordFailure.mockClear()
    rateLimitMocks.isRateLimited.mockReturnValue(false)
    rateLimitMocks.getCooldownRemaining.mockReturnValue(0)

    distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(
      null
    )
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("returns 400 when title is missing", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/price")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Missing title")
  })

  it("returns 429 when rate limited", async () => {
    rateLimitMocks.isRateLimited.mockReturnValue(true)
    rateLimitMocks.getCooldownRemaining.mockReturnValue(120_000)

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/price?title=My%20Book")
    )

    const body = await readJson<{ error: string; cooldownMs: number }>(response)
    expect(response.status).toBe(429)
    expect(body.cooldownMs).toBe(120_000)
    expect(body.error).toContain("Amazon scraping is temporarily disabled")
  })

  it("returns parsed Amazon result payload", async () => {
    const html = `
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

    const fetchMock = mock(async () => new Response(html, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

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
})
