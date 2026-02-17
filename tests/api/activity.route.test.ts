import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { makeNextRequest, readJson } from "./test-utils"

type UserResult = { data: { user: { id: string } | null } }

const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: { user: { id: "user-1" } }
  })
)

// Terminal mock for GET (range call)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rangeMock = mock(async (): Promise<any> => ({
  data: [
    {
      id: "evt-1",
      user_id: "user-1",
      event_type: "volume_added",
      entity_type: "volume",
      entity_id: "vol-1",
      metadata: {},
      created_at: "2025-01-01T00:00:00Z"
    }
  ],
  error: null,
  count: 1
}))

// Terminal mock for POST (single call)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const insertSingleMock = mock(async (): Promise<any> => ({
  data: {
    id: "evt-new",
    user_id: "user-1",
    event_type: "volume_added",
    entity_type: "volume",
    entity_id: "vol-1",
    metadata: {}
  },
  error: null
}))

// Terminal mock for DELETE (eq at end of delete chain)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deleteEqMock = mock(async (): Promise<any> => ({ error: null }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qb: Record<string, any> = {
  select: mock(() => qb),
  eq: mock(() => qb),
  order: mock(() => qb),
  range: rangeMock,
  insert: mock(() => ({ select: mock(() => ({ single: insertSingleMock })) })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete: mock((): any => ({ eq: deleteEqMock }))
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

const loadRoute = async () => await import("../../app/api/activity/route")

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  qb.select.mockClear()
  qb.eq.mockClear()
  qb.order.mockClear()
  qb.insert.mockClear()
  qb.delete.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(null)
  enforceSameOriginMock.mockClear()
  enforceSameOriginMock.mockReturnValue(undefined)
  rangeMock.mockClear()
  insertSingleMock.mockClear()
  deleteEqMock.mockClear()

  rangeMock.mockResolvedValue({
    data: [
      {
        id: "evt-1",
        user_id: "user-1",
        event_type: "volume_added",
        entity_type: "volume",
        entity_id: "vol-1",
        metadata: {},
        created_at: "2025-01-01T00:00:00Z"
      }
    ],
    error: null,
    count: 1
  })
  insertSingleMock.mockResolvedValue({
    data: {
      id: "evt-new",
      user_id: "user-1",
      event_type: "volume_added",
      entity_type: "volume",
      entity_id: "vol-1",
      metadata: {}
    },
    error: null
  })
  deleteEqMock.mockResolvedValue({ error: null })
  qb.delete.mockReturnValue({ eq: deleteEqMock })
  qb.insert.mockReturnValue({
    select: mock(() => ({ single: insertSingleMock }))
  })
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

// ---------------------------------------------------------------------------
// GET /api/activity
// ---------------------------------------------------------------------------
describe("GET /api/activity", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/activity")
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
      makeNextRequest("http://localhost/api/activity")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toBe("Too many requests")
  })

  it("returns 400 for invalid eventType filter", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/activity?eventType=invalid_event")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid eventType filter")
  })

  it("returns paginated activity events", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/activity?page=1&limit=10")
    )

    const body = await readJson<{
      data: Array<{ id: string; event_type: string }>
      pagination: { page: number; limit: number; total: number }
    }>(response)
    expect(response.status).toBe(200)
    expect(body.data).toBeArray()
    expect(body.data[0].id).toBe("evt-1")
    expect(body.data[0].event_type).toBe("volume_added")
    expect(body.pagination.page).toBe(1)
    expect(body.pagination.total).toBe(1)
  })

  it("accepts valid eventType filter", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest(
        "http://localhost/api/activity?eventType=series_created"
      )
    )

    expect(response.status).toBe(200)
  })

  it("accepts valid entityType filter", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/activity?entityType=volume")
    )

    expect(response.status).toBe(200)
  })

  it("clamps page to minimum of 1", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/activity?page=0")
    )

    expect(response.status).toBe(200)
  })

  it("clamps limit to maximum of 100", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/activity?limit=999")
    )

    expect(response.status).toBe(200)
  })

  it("returns 500 when query fails", async () => {
    rangeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "db error" },
      count: null
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/activity")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to fetch activity events")
  })
})

// ---------------------------------------------------------------------------
// POST /api/activity
// ---------------------------------------------------------------------------
describe("POST /api/activity", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/activity", {
        method: "POST",
        body: JSON.stringify({ eventType: "volume_added" }),
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
      makeNextRequest("http://localhost/api/activity", {
        method: "POST",
        body: JSON.stringify({ eventType: "volume_added" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toBe("Too many requests")
  })

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/activity", {
        method: "POST",
        body: "{{not json",
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid JSON in request body")
  })

  it("returns 400 when eventType is missing", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/activity", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid or missing eventType")
  })

  it("returns 400 for invalid eventType", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/activity", {
        method: "POST",
        body: JSON.stringify({ eventType: "not_a_real_event" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid or missing eventType")
  })

  it("creates activity event and returns 201", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/activity", {
        method: "POST",
        body: JSON.stringify({
          eventType: "volume_added",
          entityType: "volume",
          entityId: "vol-1",
          metadata: { title: "Test" }
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ id: string; event_type: string }>(response)
    expect(response.status).toBe(201)
    expect(body.id).toBe("evt-new")
    expect(body.event_type).toBe("volume_added")
  })

  it("returns 500 when insert fails", async () => {
    insertSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" }
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/activity", {
        method: "POST",
        body: JSON.stringify({ eventType: "series_created" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to record activity event")
  })

  it("enforces CSRF protection", async () => {
    const { POST } = await loadRoute()
    await POST(
      makeNextRequest("http://localhost/api/activity", {
        method: "POST",
        body: JSON.stringify({ eventType: "volume_added" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/activity
// ---------------------------------------------------------------------------
describe("DELETE /api/activity", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest("http://localhost/api/activity", { method: "DELETE" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false }
    )

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest("http://localhost/api/activity", { method: "DELETE" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toBe("Too many requests")
  })

  it("clears activity history and returns deleted:true", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest("http://localhost/api/activity", { method: "DELETE" })
    )

    const body = await readJson<{ deleted: boolean }>(response)
    expect(response.status).toBe(200)
    expect(body.deleted).toBe(true)
  })

  it("returns 500 when delete fails", async () => {
    deleteEqMock.mockResolvedValueOnce({
      error: { message: "delete failed" }
    })

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest("http://localhost/api/activity", { method: "DELETE" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to clear activity history")
  })

  it("enforces CSRF protection", async () => {
    const { DELETE } = await loadRoute()
    await DELETE(
      makeNextRequest("http://localhost/api/activity", { method: "DELETE" })
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})
