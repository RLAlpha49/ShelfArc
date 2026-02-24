import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

const getUserMock = mock(
  async (): Promise<{ data: { user: { id: string } | null } }> => ({
    data: { user: { id: "user-1" } }
  })
)

const eqMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({
    data: [{ id: "s-1", title: "Series", volumes: [{ id: "v-1" }] }],
    error: null
  })
)

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
  consumeDistributedRateLimit: mock(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (): Promise<any> => ({
      allowed: true,
      remainingHits: 10,
      retryAfterMs: 0
    })
  )
}

const enforceSameOriginMock = mock(() => undefined)

mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/rate-limit-distributed", () => distributedRateLimitMocks)
mock.module("@/lib/csrf", () => ({ enforceSameOrigin: enforceSameOriginMock }))

const loadRoute = async () => await import("../../app/api/library/export/route")

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  qb.select.mockClear()
  eqMock.mockClear()
  eqMock.mockResolvedValue({
    data: [{ id: "s-1", title: "Series", volumes: [{ id: "v-1" }] }],
    error: null
  })
  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue({
    allowed: true,
    remainingHits: 10,
    retryAfterMs: 0
  })
  enforceSameOriginMock.mockClear()
  enforceSameOriginMock.mockReturnValue(undefined)
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

describe("POST /api/library/export", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "json", scope: "all" }),
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
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "json", scope: "all" }),
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
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "json", scope: "all" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })

  it("returns 400 when format is invalid", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "xml", scope: "all" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when scope is invalid", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "json", scope: "partial" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when scope=selected but ids missing", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "json", scope: "selected" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when scope=selected with empty ids", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "json", scope: "selected", ids: [] }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when scope=selected with more than 500 ids", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `s-${i}`)

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "json", scope: "selected", ids }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 404 when no data to export", async () => {
    eqMock.mockResolvedValueOnce({ data: [], error: null, count: 0 })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "json", scope: "all" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(404)
  })

  it("returns JSON with Content-Disposition header on success", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "json", scope: "all" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(200)
    const disposition = response.headers.get("Content-Disposition")
    expect(disposition).not.toBeNull()
    expect(disposition).toContain("attachment")
  })

  it("returns CSV with correct Content-Type on success", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/export", {
        method: "POST",
        body: JSON.stringify({ format: "csv", scope: "all" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(200)
    const contentType = response.headers.get("Content-Type")
    expect(contentType).toContain("text/csv")
  })
})
