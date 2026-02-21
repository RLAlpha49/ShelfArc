import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

const getUserMock = mock(
  async (): Promise<{ data: { user: { id: string } | null } }> => ({
    data: { user: { id: "user-1" } }
  })
)

const singleMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({
    data: {
      id: "series-1",
      title: "Test Series",
      type: "manga",
      user_id: "user-1",
      tags: []
    },
    error: null
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qb: Record<string, any> = {}
qb.select = mock(() => qb)
qb.eq = mock(() => qb)
qb.order = mock(() => qb)
qb.insert = mock(() => ({ select: mock(() => ({ single: singleMock })) }))

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

const loadRoute = async () => await import("../../app/api/library/series/route")

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  qb.select.mockClear()
  qb.eq.mockClear()
  qb.order.mockClear()
  qb.insert.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(null)
  enforceSameOriginMock.mockClear()
  enforceSameOriginMock.mockReturnValue(undefined)
  singleMock.mockClear()
  singleMock.mockResolvedValue({
    data: {
      id: "series-1",
      title: "Test Series",
      type: "manga",
      user_id: "user-1",
      tags: []
    },
    error: null
  })
  qb.insert.mockReturnValue({ select: mock(() => ({ single: singleMock })) })
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

describe("POST /api/library/series", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/series", {
        method: "POST",
        body: JSON.stringify({ title: "My Series" }),
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
      makeNextRequest("http://localhost/api/library/series", {
        method: "POST",
        body: JSON.stringify({ title: "My Series" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toBe("Rate limit exceeded")
  })

  it("returns 400 when title is missing", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/series", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 when body is malformed JSON", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/series", {
        method: "POST",
        body: "{{not json",
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when body is not a JSON object (array)", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/series", {
        method: "POST",
        body: JSON.stringify([{ title: "My Series" }]),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("creates series and returns 201", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/series", {
        method: "POST",
        body: JSON.stringify({ title: "Test Series", type: "manga" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ id: string; title: string }>(response)
    expect(response.status).toBe(201)
    expect(body.id).toBe("series-1")
    expect(body.title).toBe("Test Series")
  })

  it("returns 400 on DB insert error", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "db error" }
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/series", {
        method: "POST",
        body: JSON.stringify({ title: "Test Series" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to create series")
  })

  it("enforces CSRF protection", async () => {
    const { POST } = await loadRoute()
    await POST(
      makeNextRequest("http://localhost/api/library/series", {
        method: "POST",
        body: JSON.stringify({ title: "Test Series" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})
