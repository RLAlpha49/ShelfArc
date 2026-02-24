/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock
} from "bun:test"
import { NextRequest } from "next/server"

/* ------------------------------------------------------------------ */
/*  Mocks                                                               */
/* ------------------------------------------------------------------ */

// Mock at the @supabase/ssr level (NOT @/lib/supabase/middleware) so the
// real updateSession implementation runs and tests/lib/supabase/middleware.test.ts
// is not contaminated by a whole-module stub.
const getUserMock = mock(async () => ({
  data: { user: { id: "user-1", email: "test@example.com" } },
  error: null
}))

const createServerClientMock = mock(
  (
    _url: string,
    _key: string,
    _opts: {
      cookies: { getAll: () => unknown[]; setAll: (c: unknown[]) => void }
    }
  ) => ({
    auth: { getUser: getUserMock }
  })
)

mock.module("server-only", () => ({}))
mock.module("@supabase/ssr", () => ({
  createServerClient: createServerClientMock
}))

// Rate-limiter mock – controls allow/deny behaviour per test.
const consumeDistributedRateLimitMock = mock(async () => ({
  allowed: true,
  retryAfterMs: 0,
  remainingHits: 59
}))

mock.module("@/lib/rate-limit-distributed", () => ({
  consumeDistributedRateLimit: consumeDistributedRateLimitMock
}))

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const BASE = "http://localhost:3000"

function makeRequest(
  path: string,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest(`${BASE}${path}`, {
    headers: new Headers(headers)
  })
}

const loadMiddleware = async () => await import("../middleware")

/* ================================================================== */
/*  Tests                                                               */
/* ================================================================== */

const savedEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

describe("middleware", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = savedEnv.url
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedEnv.key
  })

  beforeEach(() => {
    consumeDistributedRateLimitMock.mockClear()
    consumeDistributedRateLimitMock.mockResolvedValue({
      allowed: true,
      retryAfterMs: 0,
      remainingHits: 59
    })
    getUserMock.mockClear()
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      error: null
    })
    createServerClientMock.mockClear()
  })

  /* ---------------------------------------------------------------- */
  /*  Rate limiting — /u/* paths                                       */
  /* ---------------------------------------------------------------- */
  describe("/u/* rate limiting", () => {
    it("passes through when rate limit is not exceeded", async () => {
      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/u/someuser"))

      expect(consumeDistributedRateLimitMock).toHaveBeenCalledTimes(1)
      expect(res.status).not.toBe(429)
    })

    it("returns 429 when rate limit is exceeded", async () => {
      consumeDistributedRateLimitMock.mockResolvedValue({
        allowed: false,
        retryAfterMs: 30_000,
        remainingHits: 0
      })

      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/u/someuser"))

      expect(res.status).toBe(429)
      expect(res.headers.get("Retry-After")).toBe("30")
    })

    it("rounds Retry-After up to the nearest whole second", async () => {
      consumeDistributedRateLimitMock.mockResolvedValue({
        allowed: false,
        retryAfterMs: 30_001,
        remainingHits: 0
      })

      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/u/someuser"))

      // Math.ceil(30001 / 1000) === 31
      expect(res.headers.get("Retry-After")).toBe("31")
    })

    it("returns 429 body text when rate-limited", async () => {
      consumeDistributedRateLimitMock.mockResolvedValue({
        allowed: false,
        retryAfterMs: 10_000,
        remainingHits: 0
      })

      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/u/someuser"))

      expect(res.status).toBe(429)
      expect(await res.text()).toBe("Too Many Requests")
    })

    it("passes through when rate limiter returns null (fail-open)", async () => {
      consumeDistributedRateLimitMock.mockResolvedValue(
        null as unknown as {
          allowed: boolean
          retryAfterMs: number
          remainingHits: number
        }
      )

      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/u/someuser"))

      expect(res.status).not.toBe(429)
    })

    it("uses x-forwarded-for header as the rate-limit key", async () => {
      const { middleware } = await loadMiddleware()
      await middleware(
        makeRequest("/u/someuser", { "x-forwarded-for": "1.2.3.4" })
      )

      expect(consumeDistributedRateLimitMock).toHaveBeenCalledWith(
        expect.objectContaining({ key: "public-profile:1.2.3.4" })
      )
    })

    it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
      const { middleware } = await loadMiddleware()
      await middleware(makeRequest("/u/someuser", { "x-real-ip": "5.6.7.8" }))

      expect(consumeDistributedRateLimitMock).toHaveBeenCalledWith(
        expect.objectContaining({ key: "public-profile:5.6.7.8" })
      )
    })

    it("uses 'unknown' as rate-limit key when no IP headers are present", async () => {
      const { middleware } = await loadMiddleware()
      await middleware(makeRequest("/u/someuser"))

      expect(consumeDistributedRateLimitMock).toHaveBeenCalledWith(
        expect.objectContaining({ key: "public-profile:unknown" })
      )
    })

    it("succeeds (non-429) for an allowed /u/* request", async () => {
      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/u/someuser"))

      expect(res.status).not.toBe(429)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Cache headers — /dashboard* paths                                */
  /* ---------------------------------------------------------------- */
  describe("/dashboard cache headers", () => {
    it("sets Cache-Control header for /dashboard", async () => {
      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/dashboard"))

      expect(res.headers.get("Cache-Control")).toBe(
        "private, max-age=60, stale-while-revalidate=30"
      )
    })

    it("sets Cache-Control header for /dashboard sub-paths", async () => {
      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/dashboard/activity"))

      expect(res.headers.get("Cache-Control")).toBe(
        "private, max-age=60, stale-while-revalidate=30"
      )
    })

    it("does not set Cache-Control for /library path", async () => {
      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/library"))

      expect(res.headers.get("Cache-Control")).toBeNull()
    })

    it("does not set Cache-Control for /u/* paths", async () => {
      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/u/someuser"))

      expect(res.headers.get("Cache-Control")).toBeNull()
    })

    it("does not set Cache-Control for / path", async () => {
      const { middleware } = await loadMiddleware()
      const res = await middleware(makeRequest("/"))

      expect(res.headers.get("Cache-Control")).toBeNull()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Non-/u/* paths skip rate limiter                                 */
  /* ---------------------------------------------------------------- */
  describe("non-/u/* paths skip rate limiter", () => {
    it("does not invoke rate limiter for /", async () => {
      const { middleware } = await loadMiddleware()
      await middleware(makeRequest("/"))

      expect(consumeDistributedRateLimitMock).not.toHaveBeenCalled()
    })

    it("does not invoke rate limiter for /dashboard", async () => {
      const { middleware } = await loadMiddleware()
      await middleware(makeRequest("/dashboard"))

      expect(consumeDistributedRateLimitMock).not.toHaveBeenCalled()
    })

    it("does not invoke rate limiter for /library", async () => {
      const { middleware } = await loadMiddleware()
      await middleware(makeRequest("/library"))

      expect(consumeDistributedRateLimitMock).not.toHaveBeenCalled()
    })

    it("does not invoke rate limiter for /settings", async () => {
      const { middleware } = await loadMiddleware()
      await middleware(makeRequest("/settings"))

      expect(consumeDistributedRateLimitMock).not.toHaveBeenCalled()
    })
  })
})
