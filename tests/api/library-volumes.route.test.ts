import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { makeNextRequest, readJson } from "./test-utils"

const getUserMock = mock(
  async (): Promise<{ data: { user: { id: string } | null } }> => ({
    data: { user: { id: "user-1" } }
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seriesSingleMock = mock(
  async (): Promise<any> => ({
    data: { id: "series-1" },
    error: null
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const volumeSingleMock = mock(
  async (): Promise<any> => ({
    data: {
      id: "vol-new",
      title: "Test Vol",
      volume_number: 1,
      user_id: "user-1",
      series_id: null,
      purchase_price: null
    },
    error: null
  })
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const seriesQb: Record<string, any> = {}
seriesQb.select = mock(() => seriesQb)
seriesQb.eq = mock(() => seriesQb)
seriesQb.single = seriesSingleMock

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const volumeQb: Record<string, any> = {}
volumeQb.insert = mock(() => ({
  select: mock(() => ({ single: volumeSingleMock }))
}))

const fromMock = mock((table: string) => {
  if (table === "series") return seriesQb
  return volumeQb
})

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
  await import("../../app/api/library/volumes/route")

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  fromMock.mockClear()
  seriesQb.select.mockClear()
  seriesQb.eq.mockClear()
  seriesSingleMock.mockClear()
  seriesSingleMock.mockResolvedValue({ data: { id: "series-1" }, error: null })
  volumeQb.insert.mockClear()
  volumeSingleMock.mockClear()
  volumeSingleMock.mockResolvedValue({
    data: {
      id: "vol-new",
      title: "Test Vol",
      volume_number: 1,
      user_id: "user-1",
      series_id: null,
      purchase_price: null
    },
    error: null
  })
  volumeQb.insert.mockReturnValue({
    select: mock(() => ({ single: volumeSingleMock }))
  })
  distributedRateLimitMocks.consumeDistributedRateLimit.mockClear()
  distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValue(null)
  enforceSameOriginMock.mockClear()
  enforceSameOriginMock.mockReturnValue(undefined)
})

afterEach(() => {
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

describe("POST /api/library/volumes", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes", {
        method: "POST",
        body: JSON.stringify({ title: "Test Vol", volume_number: 1 }),
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
      makeNextRequest("http://localhost/api/library/volumes", {
        method: "POST",
        body: JSON.stringify({ title: "Test Vol", volume_number: 1 }),
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
      makeNextRequest("http://localhost/api/library/volumes", {
        method: "POST",
        body: JSON.stringify({ title: "Test Vol", volume_number: 1 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(enforceSameOriginMock).toHaveBeenCalled()
  })

  it("creates volume without series_id and returns 201", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes", {
        method: "POST",
        body: JSON.stringify({ title: "Test Vol", volume_number: 1 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ id: string }>(response)
    expect(response.status).toBe(201)
    expect(body.id).toBe("vol-new")
  })

  it("returns 404 when series_id provided but series not found", async () => {
    seriesSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" }
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Vol",
          volume_number: 1,
          series_id: "series-1"
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(404)
  })

  it("returns 400 on DB insert error", async () => {
    volumeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "insert error" }
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes", {
        method: "POST",
        body: JSON.stringify({ title: "Test Vol", volume_number: 1 }),
        headers: { "Content-Type": "application/json" }
      })
    )

    expect(response.status).toBe(400)
  })

  it("creates volume with valid series_id and returns 201", async () => {
    volumeSingleMock.mockResolvedValueOnce({
      data: {
        id: "vol-new",
        title: "Test Vol",
        volume_number: 1,
        user_id: "user-1",
        series_id: "series-1",
        purchase_price: null
      },
      error: null
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makeNextRequest("http://localhost/api/library/volumes", {
        method: "POST",
        body: JSON.stringify({
          title: "Test Vol",
          volume_number: 1,
          series_id: "series-1"
        }),
        headers: { "Content-Type": "application/json" }
      })
    )

    const body = await readJson<{ id: string; series_id: string }>(response)
    expect(response.status).toBe(201)
    expect(body.series_id).toBe("series-1")
  })
})
