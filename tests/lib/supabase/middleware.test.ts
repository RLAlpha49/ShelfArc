import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock
} from "bun:test"
import { NextRequest, NextResponse } from "next/server"

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const getUserMock = mock(async () => ({
  data: {
    user: { id: "user-1", email: "test@example.com" } as {
      id: string
      email: string
    } | null
  },
  error: null
}))

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setAllSpy = mock((_: unknown[]) => {})

const createServerClientMock = mock(
  (
    _url: string,
    _key: string,
    opts: { cookies: { setAll: typeof setAllSpy } }
  ) => {
    setAllSpy.mockImplementation((cookiesToSet: unknown[]) => {
      opts.cookies.setAll(cookiesToSet as never)
    })
    return {
      auth: { getUser: getUserMock }
    }
  }
)

mock.module("server-only", () => ({}))
mock.module("@supabase/ssr", () => ({
  createServerClient: createServerClientMock
}))

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const BASE = "http://localhost:3000"

const savedEnv = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
})

afterAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = savedEnv.url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedEnv.key
})

beforeEach(() => {
  getUserMock.mockClear()
  createServerClientMock.mockClear()
  setAllSpy.mockClear()

  getUserMock.mockResolvedValue({
    data: { user: { id: "user-1", email: "test@example.com" } },
    error: null
  })
})

/** Build a NextRequest with optional Supabase auth cookies. */
function makeRequest(path: string, opts?: { withAuthCookie?: boolean }) {
  const req = new NextRequest(`${BASE}${path}`)
  if (opts?.withAuthCookie) {
    req.cookies.set("sb-test-auth-token", "fake-jwt-token")
  }
  return req
}

function isRedirect(res: NextResponse): boolean {
  return res.status >= 300 && res.status < 400
}

function redirectLocation(res: NextResponse): string {
  return res.headers.get("location") ?? ""
}

const loadModule = async () => await import("../../../lib/supabase/middleware")

/* ================================================================== */
/*  Tests                                                              */
/* ================================================================== */

describe("lib/supabase/middleware — updateSession", () => {
  /* ---------------------------------------------------------------- */
  /*  Public routes                                                    */
  /* ---------------------------------------------------------------- */
  describe("public routes (non-protected, non-auth)", () => {
    it("passes through / without auth", async () => {
      const { updateSession } = await loadModule()
      const res = await updateSession(makeRequest("/"))

      expect(isRedirect(res)).toBe(false)
      expect(res.status).toBe(200)
    })

    it("passes through unknown paths without auth", async () => {
      const { updateSession } = await loadModule()
      const res = await updateSession(makeRequest("/about"))

      expect(isRedirect(res)).toBe(false)
    })

    it("does not call Supabase for plain public routes", async () => {
      const { updateSession } = await loadModule()
      await updateSession(makeRequest("/"))

      expect(createServerClientMock).not.toHaveBeenCalled()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Protected routes without auth cookie                             */
  /* ---------------------------------------------------------------- */
  describe("protected routes — no auth cookie", () => {
    const routes = ["/dashboard", "/library", "/settings"]

    for (const route of routes) {
      it(`redirects ${route} to /login`, async () => {
        const { updateSession } = await loadModule()
        const res = await updateSession(makeRequest(route))

        expect(isRedirect(res)).toBe(true)
        const loc = new URL(redirectLocation(res))
        expect(loc.pathname).toBe("/login")
      })

      it(`preserves redirect param for ${route}`, async () => {
        const { updateSession } = await loadModule()
        const res = await updateSession(makeRequest(route))

        const loc = new URL(redirectLocation(res))
        expect(loc.searchParams.get("redirect")).toBe(route)
      })
    }

    it("preserves sub-paths in redirect param", async () => {
      const { updateSession } = await loadModule()
      const res = await updateSession(makeRequest("/library/series/one-piece"))

      const loc = new URL(redirectLocation(res))
      expect(loc.pathname).toBe("/login")
      expect(loc.searchParams.get("redirect")).toBe("/library/series/one-piece")
    })

    it("does not call Supabase when cookie is absent", async () => {
      const { updateSession } = await loadModule()
      await updateSession(makeRequest("/dashboard"))

      expect(createServerClientMock).not.toHaveBeenCalled()
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Protected routes with cookie but expired session                 */
  /* ---------------------------------------------------------------- */
  describe("protected routes — cookie present, session expired", () => {
    it("redirects to /login when getUser returns null", async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })

      const { updateSession } = await loadModule()
      const res = await updateSession(
        makeRequest("/dashboard", { withAuthCookie: true })
      )

      expect(isRedirect(res)).toBe(true)
      const loc = new URL(redirectLocation(res))
      expect(loc.pathname).toBe("/login")
      expect(loc.searchParams.get("redirect")).toBe("/dashboard")
    })

    it("calls Supabase to validate the session", async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })

      const { updateSession } = await loadModule()
      await updateSession(makeRequest("/library", { withAuthCookie: true }))

      expect(createServerClientMock).toHaveBeenCalledTimes(1)
      expect(getUserMock).toHaveBeenCalledTimes(1)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Protected routes with valid session                              */
  /* ---------------------------------------------------------------- */
  describe("protected routes — valid session", () => {
    it("allows access to /dashboard with valid session", async () => {
      const { updateSession } = await loadModule()
      const res = await updateSession(
        makeRequest("/dashboard", { withAuthCookie: true })
      )

      expect(isRedirect(res)).toBe(false)
      expect(res.status).toBe(200)
    })

    it("allows access to /library with valid session", async () => {
      const { updateSession } = await loadModule()
      const res = await updateSession(
        makeRequest("/library", { withAuthCookie: true })
      )

      expect(isRedirect(res)).toBe(false)
      expect(res.status).toBe(200)
    })

    it("allows access to /settings with valid session", async () => {
      const { updateSession } = await loadModule()
      const res = await updateSession(
        makeRequest("/settings", { withAuthCookie: true })
      )

      expect(isRedirect(res)).toBe(false)
      expect(res.status).toBe(200)
    })

    it("refreshes session by calling getUser", async () => {
      const { updateSession } = await loadModule()
      await updateSession(makeRequest("/dashboard", { withAuthCookie: true }))

      expect(getUserMock).toHaveBeenCalledTimes(1)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Auth routes (/login, /signup)                                    */
  /* ---------------------------------------------------------------- */
  describe("auth routes", () => {
    it("allows /login without auth cookie", async () => {
      const { updateSession } = await loadModule()
      const res = await updateSession(makeRequest("/login"))

      expect(isRedirect(res)).toBe(false)
      expect(res.status).toBe(200)
    })

    it("allows /signup without auth cookie", async () => {
      const { updateSession } = await loadModule()
      const res = await updateSession(makeRequest("/signup"))

      expect(isRedirect(res)).toBe(false)
      expect(res.status).toBe(200)
    })

    it("does not call Supabase for auth routes without cookie", async () => {
      const { updateSession } = await loadModule()
      await updateSession(makeRequest("/login"))

      expect(createServerClientMock).not.toHaveBeenCalled()
    })

    it("redirects authenticated user away from /login to /library", async () => {
      const { updateSession } = await loadModule()
      const res = await updateSession(
        makeRequest("/login", { withAuthCookie: true })
      )

      expect(isRedirect(res)).toBe(true)
      const loc = new URL(redirectLocation(res))
      expect(loc.pathname).toBe("/library")
    })

    it("redirects authenticated user away from /signup to /library", async () => {
      const { updateSession } = await loadModule()
      const res = await updateSession(
        makeRequest("/signup", { withAuthCookie: true })
      )

      expect(isRedirect(res)).toBe(true)
      const loc = new URL(redirectLocation(res))
      expect(loc.pathname).toBe("/library")
    })

    it("does not redirect from auth route when session is expired", async () => {
      getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })

      const { updateSession } = await loadModule()
      const res = await updateSession(
        makeRequest("/login", { withAuthCookie: true })
      )

      expect(isRedirect(res)).toBe(false)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Session cookie refresh                                           */
  /* ---------------------------------------------------------------- */
  describe("session cookie refresh", () => {
    it("passes request cookies to the Supabase client", async () => {
      const { updateSession } = await loadModule()
      const req = makeRequest("/dashboard", { withAuthCookie: true })

      await updateSession(req)

      expect(createServerClientMock).toHaveBeenCalledTimes(1)
      const callArgs = createServerClientMock.mock.calls[0]
      expect(callArgs[0]).toBe("https://test.supabase.co")
      expect(callArgs[1]).toBe("test-anon-key")
      expect(callArgs[2]).toHaveProperty("cookies")
      expect(callArgs[2].cookies).toHaveProperty("getAll")
      expect(callArgs[2].cookies).toHaveProperty("setAll")
    })

    it("cookie getAll returns request cookies", async () => {
      const { updateSession } = await loadModule()
      const req = makeRequest("/dashboard", { withAuthCookie: true })

      await updateSession(req)

      const cookieOpts = createServerClientMock.mock.calls[0][2]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing runtime-injected getAll from mock
      const cookies = (cookieOpts.cookies as any).getAll()
      expect(
        cookies.some((c: { name: string }) => c.name === "sb-test-auth-token")
      ).toBe(true)
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Middleware config matcher                                        */
  /* ---------------------------------------------------------------- */
  describe("middleware config matcher", () => {
    it("exports a config with matcher excluding api routes", async () => {
      const mod = await import("../../../middleware")
      expect(mod.config).toBeDefined()
      expect(mod.config.matcher).toBeDefined()

      const pattern = mod.config.matcher[0]
      expect(pattern).toContain("api")
    })

    it("exports a middleware function", async () => {
      const mod = await import("../../../middleware")
      expect(typeof mod.middleware).toBe("function")
    })
  })

  /* ---------------------------------------------------------------- */
  /*  Missing env vars                                                 */
  /* ---------------------------------------------------------------- */
  describe("missing environment variables", () => {
    it("throws when Supabase URL is missing", async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      const { updateSession } = await loadModule()

      try {
        const promise = updateSession(
          makeRequest("/dashboard", { withAuthCookie: true })
        )
        expect(promise).rejects.toThrow("Missing NEXT_PUBLIC_SUPABASE_URL")
        await promise.catch(() => {})
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      }
    })

    it("throws when Supabase anon key is missing", async () => {
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      const originalPub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

      const { updateSession } = await loadModule()

      try {
        const promise = updateSession(
          makeRequest("/settings", { withAuthCookie: true })
        )
        expect(promise).rejects.toThrow()
        await promise.catch(() => {})
      } finally {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
        if (originalPub !== undefined) {
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalPub
        }
      }
    })
  })
})
