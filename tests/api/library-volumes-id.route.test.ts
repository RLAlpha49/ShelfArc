import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { makeNextRequest, readJson } from "./test-utils"

const getUserMock = mock(
  async (): Promise<{ data: { user: { id: string } | null } }> => ({
    data: { user: { id: "user-1" } }
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const singleMock = mock(
  async (): Promise<any> => ({
    data: {
      id: "vol-1",
      title: "Test Vol",
      volume_number: 1,
      user_id: "user-1",
      series_id: "series-1",
      purchase_price: null,
      series: { id: "series-1", title: "Test Series", type: "manga" }
    },
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
qb.delete = mock(() => ({ eq: mock(() => ({ eq: deleteMock })) }))

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
  await import("../../app/api/library/volumes/[id]/route")

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  qb.select.mockClear()
  qb.eq.mockClear()
  qb.update.mockClear()
  qb.delete.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(null)
  enforceSameOriginMock.mockClear()
  enforceSameOriginMock.mockReturnValue(undefined)
  singleMock.mockClear()
  singleMock.mockResolvedValue({
    data: {
      id: "vol-1",
      title: "Test Vol",
      volume_number: 1,
      user_id: "user-1",
      series_id: "series-1",
      purchase_price: null,
      series: { id: "series-1", title: "Test Series", type: "manga" }
    },
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
// GET /api/library/volumes/[id]
// ---------------------------------------------------------------------------
describe("GET /api/library/volumes/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/volumes/vol-1"),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 404 when volume not found", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" }
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/volumes/vol-1"),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    expect(response.status).toBe(404)
  })

  it("returns volume with series on success", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/library/volumes/vol-1"),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    const body = await readJson<{ id: string; title: string }>(response)
    expect(response.status).toBe(200)
    expect(body.id).toBe("vol-1")
    expect(body.title).toBe("Test Vol")
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/library/volumes/[id]
// ---------------------------------------------------------------------------
describe("PATCH /api/library/volumes/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/vol-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated Vol" }),
        headers: { "Content-Type": "application/json" }
      }),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 400 for malformed JSON", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/vol-1", {
        method: "PATCH",
        body: "{{not json",
        headers: { "Content-Type": "application/json" }
      }),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid JSON in request body")
  })

  it("returns 404 when volume not found or update failed", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" }
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/vol-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated Vol" }),
        headers: { "Content-Type": "application/json" }
      }),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    expect(response.status).toBe(404)
  })

  it("returns updated volume on success", async () => {
    singleMock.mockResolvedValueOnce({
      data: {
        id: "vol-1",
        title: "Updated Vol",
        volume_number: 1,
        user_id: "user-1",
        series_id: "series-1",
        purchase_price: null
      },
      error: null
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/vol-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated Vol" }),
        headers: { "Content-Type": "application/json" }
      }),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    const body = await readJson<{ id: string; title: string }>(response)
    expect(response.status).toBe(200)
    expect(body.title).toBe("Updated Vol")
  })

  it("enforces CSRF protection", async () => {
    const { PATCH } = await loadRoute()
    await PATCH(
      makeNextRequest("http://localhost/api/library/volumes/vol-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated Vol" }),
        headers: { "Content-Type": "application/json" }
      }),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/library/volumes/[id]
// ---------------------------------------------------------------------------
describe("DELETE /api/library/volumes/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest("http://localhost/api/library/volumes/vol-1", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns { deleted: true } on success", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest("http://localhost/api/library/volumes/vol-1", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    const body = await readJson<{ deleted: boolean }>(response)
    expect(response.status).toBe(200)
    expect(body.deleted).toBe(true)
  })

  it("returns 400 on delete error", async () => {
    deleteMock.mockResolvedValueOnce({ error: { message: "delete failed" } })

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest("http://localhost/api/library/volumes/vol-1", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it("enforces CSRF protection", async () => {
    const { DELETE } = await loadRoute()
    await DELETE(
      makeNextRequest("http://localhost/api/library/volumes/vol-1", {
        method: "DELETE"
      }),
      { params: Promise.resolve({ id: "vol-1" }) }
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})
