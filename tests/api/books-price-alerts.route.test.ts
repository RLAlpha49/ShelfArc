import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { makeNextRequest, readJson } from "./test-utils"

type UserResult = { data: { user: { id: string } | null } }
type QueryResult = {
  data: Array<Record<string, unknown>> | Record<string, unknown> | null
  error: { message: string } | null
}

const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: { user: { id: "user-1" } }
  })
)

const orderMock = mock(
  async (): Promise<QueryResult> => ({
    data: [
      {
        id: "alert-1",
        volume_id: "vol-1",
        target_price: 7.99,
        currency: "USD",
        enabled: true
      }
    ],
    error: null
  })
)

const singleMock = mock(
  async (): Promise<QueryResult> => ({
    data: {
      id: "alert-1",
      volume_id: "vol-1",
      target_price: 7.99,
      currency: "USD"
    },
    error: null
  })
)

const deleteMockResult = mock(
  async (): Promise<{ error: { message: string } | null }> => ({
    error: null
  })
)

const builder = {
  select: mock(() => builder),
  eq: mock(() => builder),
  order: orderMock,
  upsert: mock(() => builder),
  update: mock(() => builder),
  delete: mock(() => ({ eq: mock(() => ({ eq: deleteMockResult })) })),
  single: singleMock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as Record<string, any>

const fromMock = mock(() => builder)

const createUserClient = mock(async () => ({
  auth: { getUser: getUserMock },
  from: fromMock
}))

const enforceSameOriginMock = mock(() => undefined)

mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/csrf", () => ({ enforceSameOrigin: enforceSameOriginMock }))

const loadRoute = async () =>
  await import("../../app/api/books/price/alerts/route")

beforeEach(() => {
  getUserMock.mockClear()
  createUserClient.mockClear()
  fromMock.mockClear()
  enforceSameOriginMock.mockClear()
  builder.select.mockClear()
  builder.eq.mockClear()
  orderMock.mockClear()
  builder.upsert.mockClear()
  builder.update.mockClear()
  builder.delete.mockClear()
  singleMock.mockClear()
  deleteMockResult.mockClear()

  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  orderMock.mockResolvedValue({
    data: [
      {
        id: "alert-1",
        volume_id: "vol-1",
        target_price: 7.99,
        currency: "USD",
        enabled: true
      }
    ],
    error: null
  })
  singleMock.mockResolvedValue({
    data: {
      id: "alert-1",
      volume_id: "vol-1",
      target_price: 7.99,
      currency: "USD"
    },
    error: null
  })
  deleteMockResult.mockResolvedValue({ error: null })
  enforceSameOriginMock.mockReturnValue(undefined)
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe("GET /api/books/price/alerts", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/books/price/alerts")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns all alerts for user", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/books/price/alerts")
    )

    const body = await readJson<{
      data: Array<{ id: string; target_price: number }>
    }>(response)
    expect(response.status).toBe(200)
    expect(body.data).toBeArray()
    expect(body.data[0].id).toBe("alert-1")
    expect(body.data[0].target_price).toBe(7.99)
  })

  it("filters by volumeId when provided", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest(
        "http://localhost/api/books/price/alerts?volumeId=vol-1"
      )
    )

    expect(response.status).toBe(200)
    // eq should be called for user_id and volume_id
    expect(builder.eq).toHaveBeenCalled()
  })

  it("returns 500 on query failure", async () => {
    orderMock.mockResolvedValueOnce({
      data: null,
      error: { message: "db error" }
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/books/price/alerts")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to fetch price alerts")
  })
})

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
describe("POST /api/books/price/alerts", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "POST",
        body: JSON.stringify({ volumeId: "vol-1", targetPrice: 7.99 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 400 when volumeId is missing", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "POST",
        body: JSON.stringify({ targetPrice: 7.99 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("volumeId is required")
  })

  it("returns 400 when targetPrice is invalid", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "POST",
        body: JSON.stringify({ volumeId: "vol-1", targetPrice: -1 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("targetPrice must be a positive number")
  })

  it("returns 400 when targetPrice is zero", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "POST",
        body: JSON.stringify({ volumeId: "vol-1", targetPrice: 0 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("targetPrice must be a positive number")
  })

  it("returns data on success", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "POST",
        body: JSON.stringify({ volumeId: "vol-1", targetPrice: 7.99 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{
      data: { id: string; target_price: number }
    }>(response)
    expect(response.status).toBe(200)
    expect(body.data.id).toBe("alert-1")
  })

  it("returns 500 on upsert failure", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "upsert failed" }
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "POST",
        body: JSON.stringify({ volumeId: "vol-1", targetPrice: 7.99 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to save price alert")
  })

  it("calls enforceSameOrigin for CSRF protection", async () => {
    const { POST } = await loadRoute()
    await POST(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "POST",
        body: JSON.stringify({ volumeId: "vol-1", targetPrice: 7.99 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------
describe("PATCH /api/books/price/alerts", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "PATCH",
        body: JSON.stringify({ id: "alert-1" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 400 when id is missing", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "PATCH",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("id is required")
  })

  it("returns data on success", async () => {
    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "PATCH",
        body: JSON.stringify({ id: "alert-1" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{
      data: { id: string }
    }>(response)
    expect(response.status).toBe(200)
    expect(body.data.id).toBe("alert-1")
  })

  it("returns 500 on update failure", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "update failed" }
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "PATCH",
        body: JSON.stringify({ id: "alert-1" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to trigger price alert")
  })

  it("calls enforceSameOrigin for CSRF protection", async () => {
    const { PATCH } = await loadRoute()
    await PATCH(
      makeNextRequest("http://localhost/api/books/price/alerts", {
        method: "PATCH",
        body: JSON.stringify({ id: "alert-1" }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe("DELETE /api/books/price/alerts", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest(
        "http://localhost/api/books/price/alerts?id=alert-1"
      )
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 400 when id is missing", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest("http://localhost/api/books/price/alerts")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("id is required")
  })

  it("returns success on delete", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest(
        "http://localhost/api/books/price/alerts?id=alert-1"
      )
    )

    const body = await readJson<{ success: boolean }>(response)
    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("returns 500 on delete failure", async () => {
    deleteMockResult.mockResolvedValueOnce({
      error: { message: "delete failed" }
    })

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeNextRequest(
        "http://localhost/api/books/price/alerts?id=alert-1"
      )
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to delete price alert")
  })

  it("calls enforceSameOrigin for CSRF protection", async () => {
    const { DELETE } = await loadRoute()
    await DELETE(
      makeNextRequest(
        "http://localhost/api/books/price/alerts?id=alert-1"
      )
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})
