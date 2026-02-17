import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { makeNextRequest, readJson } from "./test-utils"

const getUserMock = mock(async (): Promise<{ data: { user: { id: string } | null } }> => ({
  data: { user: { id: "user-1" } }
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eqMock = mock(async (): Promise<any> => ({
  data: [],
  error: null
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qb: Record<string, any> = {
  select: mock(() => qb),
  eq: eqMock
}

const fromMock = mock(() => qb)

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

const loadRoute = async () => await import("../../app/api/library/analytics/route")

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  qb.select.mockClear()
  eqMock.mockClear()
  eqMock.mockResolvedValue({ data: [], error: null })
  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(null)
  enforceSameOriginMock.mockClear()
  enforceSameOriginMock.mockReturnValue(undefined)
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

describe("GET /api/library/analytics", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()
    const response = await GET(makeNextRequest("http://localhost/api/library/analytics"))

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce({ allowed: false })

    const { GET } = await loadRoute()
    const response = await GET(makeNextRequest("http://localhost/api/library/analytics"))

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toBe("Rate limit exceeded")
  })

  it("returns analytics data on success", async () => {
    const { GET } = await loadRoute()
    const response = await GET(makeNextRequest("http://localhost/api/library/analytics"))

    const body = await readJson<{
      collectionStats: object
      priceBreakdown: object
      wishlistStats: object
      healthScore: number
    }>(response)
    expect(response.status).toBe(200)
    expect(body).toHaveProperty("collectionStats")
    expect(body).toHaveProperty("priceBreakdown")
    expect(body).toHaveProperty("wishlistStats")
    expect(body).toHaveProperty("healthScore")
  })

  it("includes Cache-Control header in response", async () => {
    const { GET } = await loadRoute()
    const response = await GET(makeNextRequest("http://localhost/api/library/analytics"))

    expect(response.status).toBe(200)
    const cacheControl = response.headers.get("Cache-Control")
    expect(cacheControl).not.toBeNull()
    expect(cacheControl).toContain("private")
  })

  it("returns 500 on DB error", async () => {
    eqMock.mockResolvedValueOnce({ data: null, error: { message: "db error" } })

    const { GET } = await loadRoute()
    const response = await GET(makeNextRequest("http://localhost/api/library/analytics"))

    expect(response.status).toBe(500)
  })
})
