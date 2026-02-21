import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

type UserResult = { data: { user: { id: string } | null } }
type QueryResult = {
  data: Array<Record<string, unknown>> | null
  error: { message: string } | null
}

const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: { user: { id: "user-1" } }
  })
)

const limitMock = mock(
  async (): Promise<QueryResult> => ({
    data: [
      {
        id: "ph-1",
        volume_id: "123e4567-e89b-12d3-a456-426614174000",
        price: 9.99,
        currency: "USD",
        source: "amazon",
        scraped_at: "2025-01-01T00:00:00Z"
      }
    ],
    error: null
  })
)

const singleMock = mock(
  async (): Promise<QueryResult> => ({
    data: {
      id: "ph-new",
      volume_id: "123e4567-e89b-12d3-a456-426614174000",
      price: 12.5,
      currency: "USD",
      source: "amazon"
    } as unknown as Array<Record<string, unknown>>,
    error: null
  })
)

const queryBuilder = {
  select: mock(() => queryBuilder),
  eq: mock(() => queryBuilder),
  gte: mock(() => queryBuilder),
  order: mock(() => queryBuilder),
  limit: limitMock,
  insert: mock(() => queryBuilder),
  single: singleMock
}

const fromMock = mock(() => queryBuilder)

const createUserClient = mock(async () => ({
  auth: { getUser: getUserMock },
  from: fromMock
}))

const enforceSameOriginMock = mock(() => undefined)

mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/csrf", () => ({ enforceSameOrigin: enforceSameOriginMock }))

const loadRoute = async () =>
  await import("../../app/api/books/price/history/route")

beforeEach(() => {
  getUserMock.mockClear()
  createUserClient.mockClear()
  fromMock.mockClear()
  enforceSameOriginMock.mockClear()
  queryBuilder.select.mockClear()
  queryBuilder.eq.mockClear()
  queryBuilder.gte.mockClear()
  queryBuilder.order.mockClear()
  limitMock.mockClear()
  queryBuilder.insert.mockClear()
  singleMock.mockClear()

  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  limitMock.mockResolvedValue({
    data: [
      {
        id: "ph-1",
        volume_id: "123e4567-e89b-12d3-a456-426614174000",
        price: 9.99,
        currency: "USD",
        source: "amazon",
        scraped_at: "2025-01-01T00:00:00Z"
      }
    ],
    error: null
  })
  singleMock.mockResolvedValue({
    data: {
      id: "ph-new",
      volume_id: "123e4567-e89b-12d3-a456-426614174000",
      price: 12.5,
      currency: "USD",
      source: "amazon"
    } as unknown as Array<Record<string, unknown>>,
    error: null
  })
  enforceSameOriginMock.mockReturnValue(undefined)
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  limitMock.mockResolvedValue({
    data: [
      {
        id: "ph-1",
        volume_id: "123e4567-e89b-12d3-a456-426614174000",
        price: 9.99,
        currency: "USD",
        source: "amazon",
        scraped_at: "2025-01-01T00:00:00Z"
      }
    ],
    error: null
  })
})

describe("GET /api/books/price/history", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/books/price/history?volumeId=vol-1")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 400 when volumeId is missing", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/books/price/history")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("volumeId is required")
  })

  it("returns data array on success", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/books/price/history?volumeId=vol-1")
    )

    const body = await readJson<{
      data: Array<{ id: string; price: number }>
    }>(response)
    expect(response.status).toBe(200)
    expect(body.data).toBeArray()
    expect(body.data[0].id).toBe("ph-1")
    expect(body.data[0].price).toBe(9.99)
  })

  it("returns 500 when query fails", async () => {
    limitMock.mockResolvedValueOnce({
      data: null,
      error: { message: "db error" }
    })

    const { GET } = await loadRoute()
    const response = await GET(
      makeNextRequest("http://localhost/api/books/price/history?volumeId=vol-1")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to fetch price history")
  })
})

describe("POST /api/books/price/history", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({
          volumeId: "123e4567-e89b-12d3-a456-426614174000",
          price: 9.99
        }),
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
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({ price: 9.99 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 when volumeId is empty", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({ volumeId: "  ", price: 9.99 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 when price is negative", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({
          volumeId: "123e4567-e89b-12d3-a456-426614174000",
          price: -5
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 when price is zero", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({
          volumeId: "123e4567-e89b-12d3-a456-426614174000",
          price: 0
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 when price is not a number", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({
          volumeId: "123e4567-e89b-12d3-a456-426614174000",
          price: "abc"
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: "{{not json",
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid JSON in request body")
  })

  it("returns 400 when body is not a JSON object", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify("just a string"),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Request body must be a JSON object")
  })

  it("returns 400 for invalid currency code", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({
          volumeId: "123e4567-e89b-12d3-a456-426614174000",
          price: 9.99,
          currency: "TOOLONG"
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 when source is not in allowlist", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({
          volumeId: "123e4567-e89b-12d3-a456-426614174000",
          price: 9.99,
          source: "x".repeat(51)
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 for invalid productUrl", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({
          volumeId: "123e4567-e89b-12d3-a456-426614174000",
          price: 9.99,
          productUrl: "https://evil.com/product"
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns data on successful insert", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" }
    })
    singleMock.mockResolvedValueOnce({
      data: {
        id: "ph-new",
        volume_id: "123e4567-e89b-12d3-a456-426614174000",
        price: 12.5,
        currency: "USD",
        source: "amazon"
      } as unknown as Array<Record<string, unknown>>,
      error: null
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({
          volumeId: "123e4567-e89b-12d3-a456-426614174000",
          price: 12.5
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{
      data: { id: string; volume_id: string; price: number }
    }>(response)
    expect(response.status).toBe(200)
    expect(body.data.id).toBe("ph-new")
    expect(body.data.price).toBe(12.5)
  })

  it("returns 500 on insert failure", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" }
    })
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" }
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({
          volumeId: "123e4567-e89b-12d3-a456-426614174000",
          price: 9.99
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to save price history")
  })

  it("calls enforceSameOrigin for CSRF protection", async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" }
    })
    const { POST } = await loadRoute()
    await POST(
      makeNextRequest("http://localhost/api/books/price/history", {
        method: "POST",
        body: JSON.stringify({
          volumeId: "123e4567-e89b-12d3-a456-426614174000",
          price: 9.99
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })
})
