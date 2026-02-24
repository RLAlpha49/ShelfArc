/**
 * Contract tests for POST /api/books/price/alerts
 *
 * Validates exact response envelope shapes, required field presence/types,
 * precise error codes, and header forwarding for both success and error paths.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock
} from "bun:test"

import { makeNextRequest, readJson } from "../test-utils"

// ─── Valid UUID for all tests (satisfies z.uuid()) ───────────────────────────
const VOLUME_UUID = "550e8400-e29b-41d4-a716-446655440001"

// ─── Mock DB fixtures ─────────────────────────────────────────────────────────
const MOCK_VOLUME = { id: VOLUME_UUID }
const MOCK_ALERT = {
  id: "alert-contract-uuid-1",
  volume_id: VOLUME_UUID,
  user_id: "user-contract-1",
  target_price: 9.99,
  currency: "USD",
  enabled: true,
  triggered_at: null,
  snoozed_until: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z"
}

// ─── Auth mock ────────────────────────────────────────────────────────────────
type UserResult = { data: { user: { id: string } | null } }
const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: { user: { id: "user-contract-1" } }
  })
)

// ─── Per-table query-builder mocks ────────────────────────────────────────────
// volumes table: .select().eq().eq().single()
const volumeSingleMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ data: MOCK_VOLUME, error: null })
)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const volumeQb: Record<string, any> = {}
volumeQb.select = mock(() => volumeQb)
volumeQb.eq = mock(() => volumeQb)
volumeQb.single = volumeSingleMock

// price_alerts table: .upsert().select().single()
const alertSingleMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ data: MOCK_ALERT, error: null })
)
const alertSelectReturn = { single: alertSingleMock }
const alertUpsertReturn = { select: mock(() => alertSelectReturn) }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const alertQb: Record<string, any> = {}
alertQb.upsert = mock(() => alertUpsertReturn)
alertQb.select = mock(() => alertQb)
alertQb.eq = mock(() => alertQb)
alertQb.order = mock(() => alertQb)

const fromMock = mock((table: string) => {
  if (table === "volumes") return volumeQb
  return alertQb
})
const createUserClient = mock(async () => ({
  auth: { getUser: getUserMock },
  from: fromMock
}))
const consumeDistributedRateLimit = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({
    allowed: true,
    remainingHits: 9,
    retryAfterMs: 0
  })
)

// mock.module must be called before any dynamic import of the route
mock.module("server-only", () => ({}))
mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/rate-limit-distributed", () => ({
  consumeDistributedRateLimit
}))
mock.module("@/lib/csrf", () => ({ enforceSameOrigin: mock(() => undefined) }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let POST: (...args: any[]) => Promise<Response>

beforeAll(async () => {
  const route = await import("../../../app/api/books/price/alerts/route")
  POST = route.POST
})

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-contract-1" } } })
  fromMock.mockClear()
  volumeSingleMock.mockClear()
  volumeSingleMock.mockResolvedValue({ data: MOCK_VOLUME, error: null })
  alertSingleMock.mockClear()
  alertSingleMock.mockResolvedValue({ data: MOCK_ALERT, error: null })
  consumeDistributedRateLimit.mockClear()
  consumeDistributedRateLimit.mockResolvedValue({
    allowed: true,
    remainingHits: 9,
    retryAfterMs: 0
  })
})

afterAll(() => {
  mock.restore()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
const URL = "http://localhost/api/books/price/alerts"
const CORR_ID = "corr-price-contract-test"

function postReq(body: Record<string, unknown>) {
  return makeNextRequest(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": CORR_ID
    },
    body: JSON.stringify(body)
  })
}

const VALID_BODY = { volumeId: VOLUME_UUID, targetPrice: 9.99 }

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 200 success response shape
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/books/price/alerts > 200 success — response shape contract", () => {
  it("returns HTTP 200", async () => {
    const res = await POST(postReq(VALID_BODY))
    expect(res.status).toBe(200)
  })

  it("body has top-level 'data' key that is an object", async () => {
    const res = await POST(postReq(VALID_BODY))
    const body = await readJson<{ data: unknown }>(res)
    expect(typeof body.data).toBe("object")
    expect(body.data).not.toBeNull()
    expect(Array.isArray(body.data)).toBe(false)
  })

  it("data object has required price-alert fields with correct types", async () => {
    const res = await POST(postReq(VALID_BODY))
    const body = await readJson<{ data: Record<string, unknown> }>(res)
    const { data } = body

    expect(typeof data.id).toBe("string")
    expect(typeof data.volume_id).toBe("string")
    expect(typeof data.user_id).toBe("string")
    expect(typeof data.target_price).toBe("number")
    expect(typeof data.currency).toBe("string")
    expect(typeof data.enabled).toBe("boolean")
  })

  it("data values match the mock fixture", async () => {
    const res = await POST(postReq(VALID_BODY))
    const body = await readJson<{ data: Record<string, unknown> }>(res)
    const { data } = body

    expect(data.id).toBe("alert-contract-uuid-1")
    expect(data.volume_id).toBe(VOLUME_UUID)
    expect(data.user_id).toBe("user-contract-1")
    expect(data.target_price).toBe(9.99)
    expect(data.currency).toBe("USD")
    expect(data.enabled).toBe(true)
  })

  it("response header x-correlation-id echoes the request value", async () => {
    const res = await POST(postReq(VALID_BODY))
    expect(res.headers.get("x-correlation-id")).toBe(CORR_ID)
  })

  it("success body does NOT have 'error' or 'code' keys", async () => {
    const res = await POST(postReq(VALID_BODY))
    const body = await readJson<Record<string, unknown>>(res)
    expect(body.error).toBeUndefined()
    expect(body.code).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 401 unauthenticated — error envelope shape
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/books/price/alerts > 401 unauthenticated — error shape contract", () => {
  it("returns HTTP 401 when user is null", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await POST(postReq(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it("error body has 'error' string and 'code' = 'AUTHENTICATION_REQUIRED'", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await POST(postReq(VALID_BODY))
    const body = await readJson<{ error: string; code: string }>(res)
    expect(typeof body.error).toBe("string")
    expect(body.error.length).toBeGreaterThan(0)
    expect(body.code).toBe("AUTHENTICATION_REQUIRED")
  })

  it("401 response header has x-correlation-id", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await POST(postReq(VALID_BODY))
    expect(res.headers.get("x-correlation-id")).toBe(CORR_ID)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 400 validation error — error envelope shape
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/books/price/alerts > 400 validation error — error shape contract", () => {
  it("returns HTTP 400 when volumeId is not a valid UUID", async () => {
    const res = await POST(
      postReq({ volumeId: "not-a-uuid", targetPrice: 9.99 })
    )
    expect(res.status).toBe(400)
  })

  it("error body has 'error' string and 'code' = 'VALIDATION_ERROR'", async () => {
    const res = await POST(
      postReq({ volumeId: "not-a-uuid", targetPrice: 9.99 })
    )
    const body = await readJson<{ error: string; code: string }>(res)
    expect(typeof body.error).toBe("string")
    expect(body.code).toBe("VALIDATION_ERROR")
  })

  it("400 error body has 'details' array with Zod issue objects", async () => {
    const res = await POST(
      postReq({ volumeId: "not-a-uuid", targetPrice: 9.99 })
    )
    const body = await readJson<{ details: unknown }>(res)
    expect(Array.isArray(body.details)).toBe(true)
  })

  it("returns HTTP 400 when targetPrice is missing", async () => {
    const res = await POST(postReq({ volumeId: VOLUME_UUID }))
    expect(res.status).toBe(400)
  })

  it("returns HTTP 400 when targetPrice is not positive (zero)", async () => {
    const res = await POST(postReq({ volumeId: VOLUME_UUID, targetPrice: 0 }))
    expect(res.status).toBe(400)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 404 volume not found — error envelope shape
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/books/price/alerts > 404 volume not found — error shape contract", () => {
  it("returns HTTP 404 when the volume does not belong to the user", async () => {
    volumeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    const res = await POST(postReq(VALID_BODY))
    expect(res.status).toBe(404)
  })

  it("error body has 'error' string and 'code' = 'NOT_FOUND'", async () => {
    volumeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    const res = await POST(postReq(VALID_BODY))
    const body = await readJson<{ error: string; code: string }>(res)
    expect(typeof body.error).toBe("string")
    expect(body.error.length).toBeGreaterThan(0)
    expect(body.code).toBe("NOT_FOUND")
  })

  it("404 response header has x-correlation-id", async () => {
    volumeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    const res = await POST(postReq(VALID_BODY))
    expect(res.headers.get("x-correlation-id")).toBe(CORR_ID)
  })
})
