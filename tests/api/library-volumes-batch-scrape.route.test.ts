import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

const getUserMock = mock(
  async (): Promise<{ data: { user: { id: string } | null } }> => ({
    data: { user: { id: "user-1" } }
  })
)

const VOL_1_ID = "11111111-1111-4111-8111-111111111111"
const VOL_2_ID = "22222222-2222-4222-8222-222222222222"

const volumesFetchMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({
    data: [
      {
        id: VOL_1_ID,
        title: "Test Vol",
        volume_number: 1,
        series_id: "s-1",
        purchase_price: null,
        cover_image_url: null,
        series: { id: "s-1", title: "Test Series", type: "manga" }
      }
    ],
    error: null
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchQb: Record<string, any> = {
  select: mock(() => fetchQb),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  in: mock((): any => fetchQb),
  eq: volumesFetchMock
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateQb: Record<string, any> = {
  update: mock(() => updateQb),
  eq: mock(() => updateQb)
}

let volumesCallIndex = 0
const fromMock = mock((table: string) => {
  if (table === "volumes") {
    const result = volumesCallIndex === 0 ? fetchQb : updateQb
    volumesCallIndex++
    return result
  }
  return {}
})

const createUserClient = mock(async () => ({
  auth: { getUser: getUserMock },
  from: fromMock
}))

const distributedRateLimitMocks = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  consumeDistributedRateLimit: mock(async (): Promise<any> => null)
}

const enforceSameOriginMock = mock(() => undefined)

mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/rate-limit-distributed", () => distributedRateLimitMocks)
mock.module("@/lib/csrf", () => ({ enforceSameOrigin: enforceSameOriginMock }))

mock.module("@/lib/books/price/amazon-price", () => ({
  createAmazonSearchContext: mock(() => ({
    searchUrl: "https://amazon.com/s?k=test"
  })),
  fetchAmazonHtml: mock(async () => "<html></html>"),
  parseAmazonResult: mock(() => ({
    priceValue: 12.99,
    imageUrl: null,
    productUrl: null
  }))
}))

mock.module("@/lib/books/amazon-query", () => ({
  buildFetchPriceParams: mock(() => ({
    params: {
      title: "Test",
      volume: 1,
      binding: "Paperback",
      domain: "amazon.com",
      format: null,
      volumeTitle: null,
      fallbackToKindle: false
    }
  }))
}))

const loadRoute = async () =>
  await import("../../app/api/library/volumes/batch-scrape/route")

beforeEach(() => {
  volumesCallIndex = 0
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  fetchQb.select.mockClear()
  fetchQb.in.mockClear()
  volumesFetchMock.mockClear()
  volumesFetchMock.mockResolvedValue({
    data: [
      {
        id: VOL_1_ID,
        title: "Test Vol",
        volume_number: 1,
        series_id: "s-1",
        purchase_price: null,
        cover_image_url: null,
        series: { id: "s-1", title: "Test Series", type: "manga" }
      }
    ],
    error: null
  })
  updateQb.update.mockClear()
  updateQb.eq.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(null)
  enforceSameOriginMock.mockClear()
  enforceSameOriginMock.mockReturnValue(undefined)
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

describe("POST /api/library/volumes/batch-scrape", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({ volumeIds: [VOL_1_ID], mode: "price" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false }
    )

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({ volumeIds: [VOL_1_ID], mode: "price" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toBe("Rate limit exceeded")
  })

  it("enforces CSRF protection", async () => {
    const { POST } = await loadRoute()
    await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({ volumeIds: [VOL_1_ID], mode: "price" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })

  it("returns 400 when volumeIds is missing", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({ mode: "price" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when mode is invalid", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({ volumeIds: [VOL_1_ID], mode: "invalid" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when volumeIds exceeds 10", async () => {
    const ids = Array.from(
      { length: 11 },
      (_, i) =>
        `11111111-1111-4111-8111-1111111111${i.toString().padStart(2, "0")}`
    )

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({ volumeIds: ids, mode: "price" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 404 when no matching volumes found", async () => {
    volumesFetchMock.mockResolvedValueOnce({ data: [], error: null })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({ volumeIds: [VOL_1_ID], mode: "price" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson(response)
    console.log(body)

    expect(response.status).toBe(404)
  })

  it("returns job results on success (1 volume, mode=price)", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({ volumeIds: [VOL_1_ID], mode: "price" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{
      data: {
        results: unknown[]
        summary: { total: number; succeeded: number }
      }
    }>(response)
    expect(response.status).toBe(200)
    expect(body.data.results).toBeArray()
    expect(body.data.summary.total).toBe(1)
  })

  it("returns 207 when some volumes fail", async () => {
    volumesFetchMock.mockResolvedValueOnce({
      data: [
        {
          id: VOL_1_ID,
          title: "Test Vol 1",
          volume_number: 1,
          series_id: "s-1",
          purchase_price: null,
          cover_image_url: null,
          series: { id: "s-1", title: "Test Series", type: "manga" }
        },
        {
          id: VOL_2_ID,
          title: "Test Vol 2",
          volume_number: 2,
          series_id: "s-1",
          purchase_price: null,
          cover_image_url: null,
          series: { id: "s-1", title: "Test Series", type: "manga" }
        }
      ],
      error: null
    })

    // Mock buildFetchPriceParams to fail for the second volume
    const { buildFetchPriceParams } = await import("@/lib/books/amazon-query")
    const mockBuild = buildFetchPriceParams as ReturnType<typeof mock>
    mockBuild
      .mockReturnValueOnce({
        params: {
          title: "Test",
          volume: 1,
          binding: "Paperback",
          domain: "amazon.com",
          format: null,
          volumeTitle: null,
          fallbackToKindle: false
        }
      })
      .mockReturnValueOnce({
        error: "Failed to build params"
      })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({
          volumeIds: [VOL_1_ID, VOL_2_ID],
          mode: "price"
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{
      data: {
        results: unknown[]
        summary: { total: number; done: number; failed: number }
      }
    }>(response)
    expect(response.status).toBe(207)
    expect(body.data.summary.total).toBe(2)
    expect(body.data.summary.done).toBe(1)
    expect(body.data.summary.failed).toBe(1)
  })

  it("returns 422 when all volumes fail", async () => {
    volumesFetchMock.mockResolvedValueOnce({
      data: [
        {
          id: VOL_1_ID,
          title: "Test Vol 1",
          volume_number: 1,
          series_id: "s-1",
          purchase_price: null,
          cover_image_url: null,
          series: { id: "s-1", title: "Test Series", type: "manga" }
        }
      ],
      error: null
    })

    // Mock buildFetchPriceParams to fail
    const { buildFetchPriceParams } = await import("@/lib/books/amazon-query")
    const mockBuild = buildFetchPriceParams as ReturnType<typeof mock>
    mockBuild.mockReturnValueOnce({
      error: "Failed to build params"
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({ volumeIds: [VOL_1_ID], mode: "price" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{
      data: {
        results: unknown[]
        summary: { total: number; done: number; failed: number }
      }
    }>(response)
    expect(response.status).toBe(422)
    expect(body.data.summary.total).toBe(1)
    expect(body.data.summary.done).toBe(0)
    expect(body.data.summary.failed).toBe(1)
  })

  it("returns 400 when some volume IDs are not found", async () => {
    // Request 2 IDs but mock only returns 1
    volumesFetchMock.mockResolvedValueOnce({
      data: [
        {
          id: VOL_1_ID,
          title: "Test Vol",
          volume_number: 1,
          series_id: "s-1",
          purchase_price: null,
          cover_image_url: null,
          series: { id: "s-1", title: "Test Series", type: "manga" }
        }
      ],
      error: null
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes/batch-scrape", {
        method: "POST",
        body: JSON.stringify({
          volumeIds: [VOL_1_ID, VOL_2_ID],
          mode: "price"
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })
})
