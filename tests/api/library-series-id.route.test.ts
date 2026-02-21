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
      tags: [],
      user_id: "user-1",
      volumes: [{ id: "vol-1", volume_number: 1, title: "Vol 1" }]
    },
    error: null
  })
)

const volumesOrderMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({
    data: [{ id: "vol-1", volume_number: 1, title: "Vol 1" }],
    error: null
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deleteMock = mock(async (): Promise<any> => ({ error: null }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qb: Record<string, any> = {}
qb.select = mock(() => qb)
qb.eq = mock(() => qb)
qb.update = mock(() => qb)
qb.single = singleMock
qb.order = volumesOrderMock
qb.delete = mock(() => ({ eq: mock(() => ({ eq: deleteMock })) }))

const fromMock = mock(() => qb)

const rpcMock = mock(
  async (): Promise<{ data: null; error: null }> => ({
    data: null,
    error: null
  })
)

const createUserClient = mock(async () => ({
  auth: { getUser: getUserMock },
  from: fromMock,
  rpc: rpcMock
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
  await import("../../app/api/library/series/[id]/route")

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  qb.select.mockClear()
  qb.eq.mockClear()
  qb.update.mockClear()
  qb.delete.mockClear()
  rpcMock.mockClear()
  rpcMock.mockResolvedValue({ data: null, error: null })
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
      tags: [],
      user_id: "user-1",
      volumes: [{ id: "vol-1", volume_number: 1, title: "Vol 1" }]
    },
    error: null
  })
  volumesOrderMock.mockClear()
  volumesOrderMock.mockResolvedValue({
    data: [{ id: "vol-1", volume_number: 1, title: "Vol 1" }],
    error: null
  })
  deleteMock.mockClear()
  deleteMock.mockResolvedValue({ error: null })
  qb.delete.mockReturnValue({ eq: mock(() => ({ eq: deleteMock })) })
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

// ---------------------------------------------------------------------------
// GET /api/library/series/[id]
// ---------------------------------------------------------------------------
describe("GET /api/library/series/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/series/series-1"),
      { params: Promise.resolve({ id: "series-1" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false }
    )

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/series/series-1"),
      { params: Promise.resolve({ id: "series-1" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toBe("Rate limit exceeded")
  })

  it("returns 404 when series not found", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" }
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest(
        "http://localhost/api/library/series/00000000-0000-0000-0000-000000000001"
      ),
      {
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" })
      }
    )

    expect(response.status).toBe(404)
  })

  it("returns series with volumes on success", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest(
        "http://localhost/api/library/series/00000000-0000-0000-0000-000000000001"
      ),
      {
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" })
      }
    )

    const body = await readJson<{
      id: string
      title: string
      volumes: unknown[]
    }>(response)
    expect(response.status).toBe(200)
    expect(body.id).toBe("series-1")
    expect(body.title).toBe("Test Series")
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/library/series/[id]
// ---------------------------------------------------------------------------
describe("PATCH /api/library/series/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/series/series-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated" }),
        headers: { "Content-Type": "application/json" }
      }),
      { params: Promise.resolve({ id: "series-1" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 400 for malformed JSON", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest(
        "http://localhost/api/library/series/00000000-0000-0000-0000-000000000001",
        {
          method: "PATCH",
          body: "{{not json",
          headers: { "Content-Type": "application/json" }
        }
      ),
      {
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" })
      }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid JSON in request body")
  })

  it("returns 404 when series not found or update failed", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" }
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest(
        "http://localhost/api/library/series/00000000-0000-0000-0000-000000000001",
        {
          method: "PATCH",
          body: JSON.stringify({ title: "Updated" }),
          headers: { "Content-Type": "application/json" }
        }
      ),
      {
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" })
      }
    )

    expect(response.status).toBe(404)
  })

  it("returns updated series on success", async () => {
    // First call: select("tags")
    singleMock.mockResolvedValueOnce({
      data: { tags: [] },
      error: null
    })
    // Second call: update().select().single()
    singleMock.mockResolvedValueOnce({
      data: {
        id: "series-1",
        title: "Updated",
        type: "manga",
        tags: [],
        user_id: "user-1"
      },
      error: null
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest(
        "http://localhost/api/library/series/00000000-0000-0000-0000-000000000001",
        {
          method: "PATCH",
          body: JSON.stringify({ title: "Updated" }),
          headers: { "Content-Type": "application/json" }
        }
      ),
      {
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" })
      }
    )

    const body = await readJson<{ id: string; title: string }>(response)
    expect(response.status).toBe(200)
    expect(body.title).toBe("Updated")
  })

  it("enforces CSRF protection", async () => {
    const { PATCH } = await loadRoute()
    await PATCH(
      makeNextRequest(
        "http://localhost/api/library/series/00000000-0000-0000-0000-000000000001",
        {
          method: "PATCH",
          body: JSON.stringify({ title: "Updated" }),
          headers: { "Content-Type": "application/json" }
        }
      ),
      {
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" })
      }
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/library/series/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/library/series/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest("http://localhost/api/library/series/series-1", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ id: "series-1" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns { deleted: true } on success", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest(
        "http://localhost/api/library/series/00000000-0000-0000-0000-000000000001",
        {
          method: "DELETE"
        }
      ),
      {
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" })
      }
    )

    const body = await readJson<{ deleted: boolean }>(response)
    expect(response.status).toBe(200)
    expect(body.deleted).toBe(true)
  })

  it("also deletes volumes when deleteVolumes=true", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest(
        "http://localhost/api/library/series/00000000-0000-0000-0000-000000000001?deleteVolumes=true",
        { method: "DELETE" }
      ),
      {
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" })
      }
    )

    expect(response.status).toBe(200)
  })

  it("enforces CSRF protection", async () => {
    const { DELETE } = await loadRoute()
    await DELETE(
      makeNextRequest(
        "http://localhost/api/library/series/00000000-0000-0000-0000-000000000001",
        {
          method: "DELETE"
        }
      ),
      {
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" })
      }
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})
