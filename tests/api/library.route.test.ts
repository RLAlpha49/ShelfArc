import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

type UserResult = { data: { user: { id: string } | null } }

const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: { user: { id: "user-1" } }
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qb: Record<string, any> = {}

// Every chained method returns qb itself; the terminal query (range/count) returns data
qb.select = mock(() => qb)
qb.eq = mock(() => qb)
qb.order = mock(() => qb)
qb.not = mock(() => qb)
qb.or = mock(() => qb)
qb.contains = mock(() => qb)
qb.in = mock(() => qb)
qb.limit = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({
    data: [],
    error: null
  })
)
qb.range = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({
    data: [],
    error: null
  })
)

const fromMock = mock(() => qb)

const createUserClient = mock(async () => ({
  auth: { getUser: getUserMock },
  from: fromMock
}))

const distributedRateLimitMocks = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  consumeDistributedRateLimit: mock(async (): Promise<any> => null)
}

mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/rate-limit-distributed", () => distributedRateLimitMocks)
mock.module("@/lib/csrf", () => ({ enforceSameOrigin: mock(() => undefined) }))

const loadRoute = async () => await import("../../app/api/library/route")

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(null)
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

// ---------------------------------------------------------------------------
// GET /api/library — authentication and rate limiting
// ---------------------------------------------------------------------------
describe("GET /api/library — auth and rate limit", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()
    const response = await GET(makeNextRequest("http://localhost/api/library"))

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false }
    )

    const { GET } = await loadRoute()
    const response = await GET(makeNextRequest("http://localhost/api/library"))

    expect(response.status).toBe(429)
  })
})

// ---------------------------------------------------------------------------
// GET /api/library — parameter validation (no DB hit needed)
// ---------------------------------------------------------------------------
describe("GET /api/library — parameter validation", () => {
  it("returns 400 for invalid sortField", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library?sortField=bad_field")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toContain("sortField")
  })

  it("returns 400 for invalid sortOrder", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library?sortOrder=sideways")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toContain("sortOrder")
  })

  it("returns 400 for invalid type", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library?type=comics")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toContain("type")
  })

  it("returns 400 for invalid ownershipStatus", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library?ownershipStatus=maybe")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toContain("ownershipStatus")
  })

  it("returns 400 for invalid readingStatus", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library?readingStatus=halfway")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toContain("readingStatus")
  })

  it("returns 400 for invalid view parameter", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library?view=grid")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toContain("view")
  })

  it("returns 400 when limit exceeds maximum (200)", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library?limit=999")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toContain("limit")
  })

  it("returns 400 when search query exceeds 200 characters", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library?search=" + "a".repeat(201))
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toContain("search")
  })

  it("accepts valid parameters without returning 400 or 401", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest(
        "http://localhost/api/library?type=all&sortField=title&sortOrder=asc&view=series&limit=20&page=1"
      )
    )

    expect(response.status).not.toBe(400)
    expect(response.status).not.toBe(401)
  })

  it("accepts view=volumes without returning 400", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library?view=volumes")
    )

    expect(response.status).not.toBe(400)
    expect(response.status).not.toBe(401)
  })

  it("accepts readingStatus=all without returning 400", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library?readingStatus=all")
    )

    expect(response.status).not.toBe(400)
    expect(response.status).not.toBe(401)
  })
})
