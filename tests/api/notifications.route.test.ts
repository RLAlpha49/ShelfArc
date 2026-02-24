import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

type UserResult = { data: { user: { id: string } | null } }

const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: { user: { id: "user-1" } }
  })
)

// Terminal mocks for specific query patterns
const rangeMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ data: [], error: null, count: 0 })
)

const deleteEqMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ error: null })
)

const insertSingleMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({
    data: {
      id: "notif-1",
      user_id: "user-1",
      type: "info",
      title: "Hello",
      message: "World",
      created_at: "2025-01-01T00:00:00Z"
    },
    error: null
  })
)

// Profile single mock — used when checking notification preferences
const profileSingleMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ data: { settings: {} }, error: null })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qb: Record<string, any> = {}

qb.select = mock(() => qb)
qb.eq = mock(() => qb)
qb.order = mock(() => qb)
qb.range = rangeMock
qb.single = profileSingleMock
// eslint-disable-next-line @typescript-eslint/no-explicit-any
qb.delete = mock((): any => ({ eq: deleteEqMock }))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
qb.insert = mock((): any => ({
  select: mock(() => ({ single: insertSingleMock }))
}))

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

const loadRoute = async () => await import("../../app/api/notifications/route")

// Helpers
const makeGetRequest = (url = "http://localhost/api/notifications") =>
  makeNextRequest(url)

const makePostRequest = (body: Record<string, unknown>) =>
  makeNextRequest("http://localhost/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

const makeDeleteRequest = () =>
  makeNextRequest("http://localhost/api/notifications", {
    method: "DELETE"
  })

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  qb.select.mockClear()
  qb.eq.mockClear()
  qb.order.mockClear()
  qb.single.mockClear()
  qb.delete.mockClear()
  qb.insert.mockClear()
  rangeMock.mockClear()
  deleteEqMock.mockClear()
  insertSingleMock.mockClear()
  profileSingleMock.mockClear()

  rangeMock.mockResolvedValue({ data: [], error: null, count: 0 })
  deleteEqMock.mockResolvedValue({ error: null })
  insertSingleMock.mockResolvedValue({
    data: {
      id: "notif-1",
      user_id: "user-1",
      type: "info",
      title: "Hello",
      message: "World",
      created_at: "2025-01-01T00:00:00Z"
    },
    error: null
  })
  profileSingleMock.mockResolvedValue({ data: { settings: {} }, error: null })
  qb.delete.mockReturnValue({ eq: deleteEqMock })
  qb.insert.mockReturnValue({
    select: mock(() => ({ single: insertSingleMock }))
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

// ---------------------------------------------------------------------------
// GET /api/notifications
// ---------------------------------------------------------------------------

describe("GET /api/notifications — authentication", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()
    const response = await GET(makeGetRequest())

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false, retryAfterMs: 30_000 }
    )

    const { GET } = await loadRoute()
    const response = await GET(makeGetRequest())

    expect(response.status).toBe(429)
  })
})

describe("GET /api/notifications — success", () => {
  it("returns notification list with pagination metadata", async () => {
    rangeMock.mockResolvedValueOnce({
      data: [
        {
          id: "notif-1",
          user_id: "user-1",
          type: "info",
          title: "Test",
          message: "Hello",
          created_at: "2025-01-01T00:00:00Z"
        }
      ],
      error: null,
      count: 1
    })

    const { GET } = await loadRoute()
    const response = await GET(makeGetRequest())

    const body = await readJson<{
      data: Array<{ id: string }>
      pagination: { page: number; limit: number; total: number }
    }>(response)

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe("notif-1")
    expect(body.pagination.total).toBe(1)
    expect(body.pagination.page).toBe(1)
  })

  it("returns empty list when no notifications exist", async () => {
    const { GET } = await loadRoute()
    const response = await GET(makeGetRequest())

    const body = await readJson<{
      data: unknown[]
      pagination: { total: number }
    }>(response)

    expect(response.status).toBe(200)
    expect(body.data).toHaveLength(0)
    expect(body.pagination.total).toBe(0)
  })

  it("returns 500 when database fetch fails", async () => {
    rangeMock.mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
      count: null
    })

    const { GET } = await loadRoute()
    const response = await GET(makeGetRequest())

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to fetch notifications")
  })
})

// ---------------------------------------------------------------------------
// POST /api/notifications
// ---------------------------------------------------------------------------

describe("POST /api/notifications — authentication", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ type: "info", title: "Hi", message: "World" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false, retryAfterMs: 30_000 }
    )

    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ type: "info", title: "Hi", message: "World" })
    )

    expect(response.status).toBe(429)
  })
})

describe("POST /api/notifications — validation", () => {
  it("returns 400 for invalid notification type", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ type: "unknown_type", title: "Hi", message: "World" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 when title is missing", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ type: "info", message: "World" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })
})

describe("POST /api/notifications — successful creation", () => {
  it("creates and returns a notification with status 201", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({
        type: "info",
        title: "Hello",
        message: "World"
      })
    )

    const body = await readJson<{ id: string; type: string; title: string }>(
      response
    )
    expect(response.status).toBe(201)
    expect(body.id).toBe("notif-1")
    expect(body.type).toBe("info")
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/notifications
// ---------------------------------------------------------------------------

describe("DELETE /api/notifications — authentication", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { DELETE } = await loadRoute()
    const response = await DELETE(makeDeleteRequest())

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false, retryAfterMs: 30_000 }
    )

    const { DELETE } = await loadRoute()
    const response = await DELETE(makeDeleteRequest())

    expect(response.status).toBe(429)
  })
})

describe("DELETE /api/notifications — bulk clear", () => {
  it("clears all notifications and returns { deleted: true }", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(makeDeleteRequest())

    const body = await readJson<{ deleted: boolean }>(response)
    expect(response.status).toBe(200)
    expect(body.deleted).toBe(true)
  })

  it("returns 500 when database delete fails", async () => {
    deleteEqMock.mockResolvedValueOnce({
      error: { message: "Delete failed" }
    })
    qb.delete.mockReturnValueOnce({ eq: deleteEqMock })

    const { DELETE } = await loadRoute()
    const response = await DELETE(makeDeleteRequest())

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to clear notifications")
  })
})
