import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

// server-only guard must be mocked before the route module is imported
mock.module("server-only", () => ({}))

// BookWalker and Amazon price modules (used dynamically inside evaluate)
mock.module("@/lib/books/price/bookwalker-price", () => ({
  createBookWalkerSearchContext: mock(() => {
    throw new Error("not under test")
  }),
  fetchBookWalkerHtml: mock(async () => ""),
  parseBookWalkerResult: mock(() => {
    throw new Error("not under test")
  })
}))
mock.module("@/lib/books/price/amazon-price", () => ({
  createAmazonSearchContext: mock(() => {
    throw new Error("not under test")
  }),
  fetchAmazonHtml: mock(async () => ""),
  parseAmazonResult: mock(() => {
    throw new Error("not under test")
  })
}))

// --- Supabase user client (used in user-mode auth path) ---

type UserResult = {
  data: { user: { id: string } | null }
}

const getUserMock = mock(
  async (): Promise<UserResult> => ({ data: { user: { id: "user-1" } } })
)

const createUserClient = mock(async () => ({
  auth: { getUser: getUserMock }
}))

// --- Admin client (used for fetching alerts, inserting price history, etc.) ---

// Fluent QB for admin — terminal .limit() returns an empty alert list by default
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminQb: Record<string, any> = {}
adminQb.select = mock(() => adminQb)
adminQb.eq = mock(() => adminQb)
adminQb.or = mock(() => adminQb)
adminQb.order = mock(() => adminQb)
adminQb.in = mock(() => adminQb)
adminQb.gte = mock(() => adminQb)
adminQb.single = mock(async () => ({ data: null, error: null }))
adminQb.limit = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ data: [], error: null })
)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
adminQb.insert = mock(async (): Promise<any> => ({ error: null }))
adminQb.update = mock(() => adminQb)

const adminFromMock = mock(() => adminQb)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adminClientMock: Record<string, any> = {
  from: adminFromMock,
  auth: { admin: { deleteUser: mock(async () => ({ error: null })) } },
  storage: {
    from: mock(() => ({
      list: mock(async () => ({ data: [] })),
      remove: mock(async () => ({}))
    }))
  },
  functions: { invoke: mock(async () => ({ error: null })) }
}
const createAdminClientMock = mock(() => adminClientMock)

// --- Distributed rate limit + CSRF ---
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
mock.module("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock
}))
mock.module("@/lib/rate-limit-distributed", () => distributedRateLimitMocks)
mock.module("@/lib/csrf", () => ({ enforceSameOrigin: enforceSameOriginMock }))

// Set a known evaluation secret so the secret-auth path is exercisable
const TEST_SECRET = "test-evaluation-secret-abc"
process.env.EVALUATION_SECRET = TEST_SECRET

const loadRoute = async () =>
  await import("../../app/api/automations/evaluate/route")

// Helper — POST with optional secret header
const makePostRequest = (headers?: Record<string, string>) =>
  makeNextRequest("http://localhost/api/automations/evaluate", {
    method: "POST",
    headers
  })

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  createUserClient.mockClear()
  createAdminClientMock.mockClear()
  adminFromMock.mockClear()
  adminQb.select.mockClear()
  adminQb.eq.mockClear()
  adminQb.or.mockClear()
  adminQb.order.mockClear()
  adminQb.limit.mockClear()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminQb.limit.mockResolvedValue({ data: [], error: null } as any)
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
// POST /api/automations/evaluate
// ---------------------------------------------------------------------------

describe("POST /api/automations/evaluate — secret authentication", () => {
  it("returns 401 when no secret and no authenticated user", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    // Wrong secret falls through to user-auth; user is null → 401
    const response = await POST(
      makePostRequest({ "x-evaluation-secret": "wrong-secret" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toContain("Authentication")
  })

  it("returns 429 when secret-auth path is rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false, retryAfterMs: 60_000 }
    )

    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ "x-evaluation-secret": TEST_SECRET })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toContain("evaluation requests")
  })

  it("returns 200 with zero stats when there are no active alerts", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ "x-evaluation-secret": TEST_SECRET })
    )

    const body = await readJson<{
      evaluated: number
      triggered: number
      skipped: number
      errors: number
      total: number
      eligible: number
      recommendedCronSchedule: string
    }>(response)

    expect(response.status).toBe(200)
    expect(body.evaluated).toBe(0)
    expect(body.triggered).toBe(0)
    expect(body.skipped).toBe(0)
    expect(body.errors).toBe(0)
    expect(body.total).toBe(0)
    expect(body.eligible).toBe(0)
    expect(body.recommendedCronSchedule).toBe("0 8 * * *")
  })

  it("returns 500 when admin client cannot be created", async () => {
    createAdminClientMock.mockImplementationOnce(() => {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ "x-evaluation-secret": TEST_SECRET })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Service configuration error")
  })
})

describe("POST /api/automations/evaluate — user-mode authentication", () => {
  it("returns 401 when user is not authenticated (no secret, no session)", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    // Deliberately omit the secret header — falls through to user auth
    const response = await POST(makePostRequest())

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toContain("Authentication")
  })

  it("returns 429 when user-mode rate limit is exceeded", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit
      // First call: secret not configured path won't fire; falls through to user auth
      // The user-mode rate limit key is "evaluate:user-1"
      .mockResolvedValueOnce({ allowed: false, retryAfterMs: 1_800_000 })

    const { POST } = await loadRoute()
    const response = await POST(makePostRequest())

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(429)
    expect(body.error).toContain("30 minutes")
  })
})
