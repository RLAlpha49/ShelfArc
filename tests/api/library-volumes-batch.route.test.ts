import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { makeNextRequest, readJson } from "./test-utils"

const getUserMock = mock(
  async (): Promise<{ data: { user: { id: string } | null } }> => ({
    data: { user: { id: "user-1" } }
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectIdMock = mock(
  async (): Promise<any> => ({
    data: [{ id: "vol-1" }, { id: "vol-2" }],
    error: null
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qb: Record<string, any> = {
  update: mock(() => qb),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  in: mock((): any => qb),
  eq: mock(() => qb),
  select: mock(() => selectIdMock())
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

const loadRoute = async () =>
  await import("../../app/api/library/volumes/batch/route")

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  qb.update.mockClear()
  qb.in.mockClear()
  qb.eq.mockClear()
  qb.select.mockClear()
  selectIdMock.mockClear()
  selectIdMock.mockResolvedValue({
    data: [{ id: "vol-1" }, { id: "vol-2" }],
    error: null
  })
  qb.select.mockImplementation(() => selectIdMock())
  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(null)
  enforceSameOriginMock.mockClear()
  enforceSameOriginMock.mockReturnValue(undefined)
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

describe("PATCH /api/library/volumes/batch", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: ["vol-1"],
          updates: { ownership_status: "owned" }
        }),
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

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: ["vol-1"],
          updates: { ownership_status: "owned" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toBe("Rate limit exceeded")
  })

  it("enforces CSRF protection", async () => {
    const { PATCH } = await loadRoute()
    await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: ["vol-1", "vol-2"],
          updates: { ownership_status: "owned" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })

  it("returns 400 when volumeIds is empty", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: [],
          updates: { ownership_status: "owned" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when volumeIds exceeds 200", async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `vol-${i}`)

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: ids,
          updates: { ownership_status: "owned" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when updates is missing", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({ volumeIds: ["vol-1"] }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 for invalid ownership_status", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: ["vol-1"],
          updates: { ownership_status: "invalid" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 for invalid reading_status", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: ["vol-1"],
          updates: { reading_status: "invalid" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 for invalid rating (out of range)", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({ volumeIds: ["vol-1"], updates: { rating: 11 } }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 for invalid rating (string)", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: ["vol-1"],
          updates: { rating: "five" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns 400 when updates has no valid fields", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: ["vol-1"],
          updates: { unknown_field: "value" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("returns { updated, requested } on success", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: ["vol-1", "vol-2"],
          updates: { ownership_status: "owned" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ updated: number; requested: number }>(
      response
    )
    expect(response.status).toBe(200)
    expect(body.updated).toBe(2)
    expect(body.requested).toBe(2)
  })

  it("returns 400 on DB update error", async () => {
    selectIdMock.mockResolvedValueOnce({
      data: null,
      error: { message: "db error" }
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/batch", {
        method: "PATCH",
        body: JSON.stringify({
          volumeIds: ["vol-1", "vol-2"],
          updates: { ownership_status: "owned" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })
})
