import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

type UserResult = { data: { user: { id: string } | null } }
type AdminQueryResult = {
  data: Array<{ id: string }>
  error: Record<string, unknown> | null
}

const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: { user: { id: "user-1" } }
  })
)

const createUserClient = mock(async () => ({
  auth: {
    getUser: getUserMock
  }
}))

const limitMock = mock(
  async (): Promise<AdminQueryResult> => ({
    data: [],
    error: null
  })
)

const queryBuilder = {
  select: () => queryBuilder,
  ilike: () => queryBuilder,
  neq: () => queryBuilder,
  limit: limitMock
}

const fromMock = mock(() => queryBuilder)

const createAdminClient = mock(() => ({
  from: fromMock
}))

const rateLimitMocks = {
  isRateLimited: mock(() => false),
  recordFailure: mock(() => undefined),
  getCooldownRemaining: mock(() => 0)
}

const distributedRateLimitMocks = {
  consumeDistributedRateLimit: mock(async () => null)
}

mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/supabase/admin", () => ({ createAdminClient }))
mock.module("@/lib/rate-limit", () => rateLimitMocks)
mock.module("@/lib/rate-limit-distributed", () => distributedRateLimitMocks)

const loadRoute = async () => await import("../../app/api/username/check/route")

beforeEach(() => {
  getUserMock.mockClear()
  createUserClient.mockClear()
  createAdminClient.mockClear()
  fromMock.mockClear()
  limitMock.mockClear()
  rateLimitMocks.isRateLimited.mockClear()
  rateLimitMocks.recordFailure.mockClear()

  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(null)

  rateLimitMocks.isRateLimited.mockReturnValue(false)
  limitMock.mockResolvedValue({ data: [], error: null })
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

afterEach(() => {
  rateLimitMocks.isRateLimited.mockReturnValue(false)
})

describe("GET /api/username/check", () => {
  it("returns 400 when username is missing", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/username/check")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid username format")
  })

  it("returns 400 when username format is invalid", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/username/check?username=bad-name")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid username format")
  })

  it("returns 401 when user is not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/username/check?username=valid_name")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false, retryAfterMs: 0 } as unknown as null
    )

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/username/check?username=valid_name")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toBe("Too many requests")
  })

  it("returns 500 when admin query fails", async () => {
    limitMock.mockResolvedValueOnce({
      data: [],
      error: { message: "boom" }
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/username/check?username=valid_name")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to check username")
  })

  it("returns available=true when username is unused", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/username/check?username=valid_name")
    )

    const body = await readJson<{ data: { available: boolean } }>(response)
    expect(response.status).toBe(200)
    expect(body.data.available).toBe(true)
  })

  it("returns available=false when username is taken", async () => {
    limitMock.mockResolvedValueOnce({ data: [{ id: "other" }], error: null })

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/username/check?username=valid_name")
    )

    const body = await readJson<{ data: { available: boolean } }>(response)
    expect(response.status).toBe(200)
    expect(body.data.available).toBe(false)
  })
})
