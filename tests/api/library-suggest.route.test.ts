import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { makeNextRequest, readJson } from "./test-utils"

const getUserMock = mock(async (): Promise<{ data: { user: { id: string } | null } }> => ({
  data: { user: { id: "user-1" } }
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const limitMock = mock(async (): Promise<any> => ({
  data: [{ title: "Alpha" }, { title: "Beta" }, { title: "alpha" }],
  error: null
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qb: Record<string, any> = {
  select: mock(() => qb),
  eq: mock(() => qb),
  ilike: mock(() => qb),
  limit: limitMock
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

const loadRoute = async () => await import("../../app/api/library/suggest/route")

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  qb.select.mockClear()
  qb.eq.mockClear()
  qb.ilike.mockClear()
  limitMock.mockClear()
  limitMock.mockResolvedValue({
    data: [{ title: "Alpha" }, { title: "Beta" }, { title: "alpha" }],
    error: null
  })
  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(null)
  enforceSameOriginMock.mockClear()
  enforceSameOriginMock.mockReturnValue(undefined)
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

describe("GET /api/library/suggest", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/suggest?q=test")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 400 when q is missing", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/suggest")
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when q exceeds 100 characters", async () => {
    const longQ = "a".repeat(101)

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest(`http://localhost/api/library/suggest?q=${longQ}`)
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when field is invalid", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/suggest?q=test&field=invalid")
    )

    expect(response.status).toBe(400)
  })

  it("returns unique deduplicated suggestions on success", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/suggest?q=al")
    )

    const body = await readJson<{ data: string[] }>(response)
    expect(response.status).toBe(200)
    expect(body.data).toBeArray()
    // "Alpha" and "alpha" should be deduplicated (case-insensitive)
    const lowerData = body.data.map((s) => s.toLowerCase())
    const unique = new Set(lowerData)
    expect(unique.size).toBe(lowerData.length)
  })

  it("accepts field=author", async () => {
    limitMock.mockResolvedValueOnce({
      data: [{ author: "Author One" }, { author: "Author Two" }],
      error: null
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/suggest?q=Author&field=author")
    )

    expect(response.status).toBe(200)
  })

  it("accepts field=publisher", async () => {
    limitMock.mockResolvedValueOnce({
      data: [{ publisher: "Publisher A" }],
      error: null
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/suggest?q=Pub&field=publisher")
    )

    expect(response.status).toBe(200)
  })

  it("returns 500 on DB error", async () => {
    limitMock.mockResolvedValueOnce({ data: null, error: { message: "db error" } })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/suggest?q=test")
    )

    expect(response.status).toBe(500)
  })
})
