/**
 * Contract tests for GET /api/library
 *
 * Validates exact response envelope shapes, required field presence/types,
 * precise error codes, and header forwarding.  These complement the existing
 * mock-based unit tests (library.route.test.ts) and are intentionally narrow:
 * they verify *what the API returns*, not *which functions were called*.
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

// ─── Mock DB fixture for series view ─────────────────────────────────────────
const MOCK_SERIES_ROW = {
  id: "series-contract-abc",
  title: "Contract Test Manga",
  original_title: null,
  description: null,
  notes: null,
  author: "Test Author",
  artist: null,
  publisher: null,
  cover_image_url: "https://example.com/cover.jpg",
  type: "manga",
  total_volumes: 2,
  status: "ongoing",
  tags: ["action", "shonen"],
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-02T00:00:00Z",
  user_id: "user-contract-1",
  is_public: false,
  volumes: [
    {
      id: "vol-contract-1",
      volume_number: 1,
      ownership_status: "owned",
      reading_status: "completed",
      rating: null,
      cover_image_url: null
    }
  ]
}

// ─── Auth mock ────────────────────────────────────────────────────────────────
type UserResult = { data: { user: { id: string } | null } }
const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: { user: { id: "user-contract-1" } }
  })
)

// ─── Chainable Supabase query-builder mock ────────────────────────────────────
// Every non-terminal method returns `qb`; `.limit()` is the async terminal.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qb: Record<string, any> = {}
qb.select = mock(() => qb)
qb.eq = mock(() => qb)
qb.order = mock(() => qb)
qb.not = mock(() => qb)
qb.or = mock(() => qb)
qb.contains = mock(() => qb)
qb.in = mock(() => qb)
qb.limit = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ data: [MOCK_SERIES_ROW], error: null })
)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
qb.range = mock(async (): Promise<any> => ({ data: [], error: null }))

const fromMock = mock(() => qb)
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
let GET: (...args: any[]) => Promise<Response>

beforeAll(async () => {
  const route = await import("../../../app/api/library/route")
  GET = route.GET
})

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-contract-1" } } })
  fromMock.mockClear()
  qb.limit.mockClear()
  qb.limit.mockResolvedValue({ data: [MOCK_SERIES_ROW], error: null })
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
const BASE = "http://localhost/api/library"
const CORR_ID = "corr-lib-contract-test"

function req(qs = "") {
  return makeNextRequest(qs ? `${BASE}?${qs}` : BASE, {
    headers: { "x-correlation-id": CORR_ID }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 200 success response shape
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/library > 200 success — response shape contract", () => {
  it("returns HTTP 200", async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
  })

  it("body has top-level 'data' key that is an array", async () => {
    const res = await GET(req())
    const body = await readJson<{ data: unknown[] }>(res)
    expect(Array.isArray(body.data)).toBe(true)
  })

  it("body has top-level 'pagination' key that is an object", async () => {
    const res = await GET(req())
    const body = await readJson<{ pagination: unknown }>(res)
    expect(typeof body.pagination).toBe("object")
    expect(body.pagination).not.toBeNull()
  })

  it("pagination.limit is a number", async () => {
    const res = await GET(req())
    const body = await readJson<{ pagination: Record<string, unknown> }>(res)
    expect(typeof body.pagination.limit).toBe("number")
  })

  it("pagination.hasMore is a boolean", async () => {
    const res = await GET(req())
    const body = await readJson<{ pagination: Record<string, unknown> }>(res)
    expect(typeof body.pagination.hasMore).toBe("boolean")
  })

  it("pagination.nextCursor is null or a string", async () => {
    const res = await GET(req())
    const body = await readJson<{ pagination: Record<string, unknown> }>(res)
    const { nextCursor } = body.pagination
    expect(nextCursor === null || typeof nextCursor === "string").toBe(true)
  })

  it("series item has required contract fields with correct types", async () => {
    const res = await GET(req())
    const body = await readJson<{ data: Array<Record<string, unknown>> }>(res)
    const item = body.data[0]

    expect(typeof item.id).toBe("string")
    expect(typeof item.title).toBe("string")
    expect(typeof item.type).toBe("string")
    expect(Array.isArray(item.tags)).toBe(true)
    expect(typeof item.created_at).toBe("string")
    expect(typeof item.updated_at).toBe("string")
    expect(typeof item.user_id).toBe("string")
    expect(Array.isArray(item.volumes)).toBe(true)
  })

  it("series item values match the mock fixture", async () => {
    const res = await GET(req())
    const body = await readJson<{ data: Array<Record<string, unknown>> }>(res)
    const item = body.data[0]

    expect(item.id).toBe("series-contract-abc")
    expect(item.title).toBe("Contract Test Manga")
    expect(item.type).toBe("manga")
    expect(item.user_id).toBe("user-contract-1")
    expect(item.tags).toEqual(["action", "shonen"])
  })

  it("response header x-correlation-id echoes the request value", async () => {
    const res = await GET(req())
    expect(res.headers.get("x-correlation-id")).toBe(CORR_ID)
  })

  it("success body does NOT have an 'error' or 'code' key", async () => {
    const res = await GET(req())
    const body = await readJson<Record<string, unknown>>(res)
    expect(body.error).toBeUndefined()
    expect(body.code).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 401 unauthenticated — error envelope shape
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/library > 401 unauthenticated — error shape contract", () => {
  it("returns HTTP 401 when user is null", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it("error body has 'error' field that is a non-empty string", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await GET(req())
    const body = await readJson<{ error: string }>(res)
    expect(typeof body.error).toBe("string")
    expect(body.error.length).toBeGreaterThan(0)
  })

  it("error body has 'code' = 'AUTHENTICATION_REQUIRED'", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await GET(req())
    const body = await readJson<{ code: string }>(res)
    expect(body.code).toBe("AUTHENTICATION_REQUIRED")
  })

  it("401 response header has x-correlation-id", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await GET(req())
    expect(res.headers.get("x-correlation-id")).toBe(CORR_ID)
  })

  it("401 error body contains only allowed envelope keys", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await GET(req())
    const body = await readJson<Record<string, unknown>>(res)
    const ALLOWED = new Set(["error", "code", "correlationId", "details"])
    const unexpected = Object.keys(body).filter((k) => !ALLOWED.has(k))
    expect(unexpected).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 400 validation error — error envelope shape
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/library > 400 validation error — error shape contract", () => {
  it("returns HTTP 400 for invalid sortField value", async () => {
    const res = await GET(req("sortField=not__a__valid__sort__field"))
    expect(res.status).toBe(400)
  })

  it("400 error body has 'error' string and 'code' = 'VALIDATION_ERROR'", async () => {
    const res = await GET(req("sortField=not__a__valid__sort__field"))
    const body = await readJson<{ error: string; code: string }>(res)
    expect(typeof body.error).toBe("string")
    expect(body.code).toBe("VALIDATION_ERROR")
  })

  it("returns HTTP 400 for invalid type parameter value", async () => {
    const res = await GET(req("type=totally_invalid_type_xyz"))
    expect(res.status).toBe(400)
  })

  it("returns HTTP 400 for invalid sortOrder value", async () => {
    const res = await GET(req("sortOrder=sideways"))
    expect(res.status).toBe(400)
  })
})
