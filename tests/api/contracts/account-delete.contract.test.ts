/**
 * Contract tests for DELETE /api/account
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

// ─── Auth mocks ───────────────────────────────────────────────────────────────
type UserResult = {
  data: {
    user: {
      id: string
      email: string
      identities: Array<{ provider: string }>
    } | null
  }
}

// Default: OAuth-only user — no password check required
const OAUTH_USER = {
  id: "user-contract-1",
  email: "test@example.com",
  identities: [{ provider: "google" }]
}

// Email+password user — signInWithPassword will be called
const EMAIL_USER = {
  id: "user-contract-1",
  email: "test@example.com",
  identities: [{ provider: "email" }]
}

const getUserMock = mock(
  async (): Promise<UserResult> => ({ data: { user: OAUTH_USER } })
)
const signInWithPasswordMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ error: null })
)

const createUserClient = mock(async () => ({
  auth: {
    getUser: getUserMock,
    signInWithPassword: signInWithPasswordMock
  },
  // from() not used in DELETE handler path
  from: mock(() => ({}))
}))

// ─── Admin client mock ────────────────────────────────────────────────────────
const deleteUserMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ error: null })
)
const storageListMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ data: [], error: null })
)
const storageRemoveMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ data: null, error: null })
)
const createAdminClient = mock(() => ({
  auth: { admin: { deleteUser: deleteUserMock } },
  storage: {
    from: mock(() => ({
      list: storageListMock,
      remove: storageRemoveMock
    }))
  }
}))

const consumeDistributedRateLimit = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({
    allowed: true,
    remainingHits: 2,
    retryAfterMs: 0
  })
)

// mock.module must be called before any dynamic import of the route
mock.module("server-only", () => ({}))
mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/supabase/admin", () => ({ createAdminClient }))
mock.module("@/lib/rate-limit-distributed", () => ({
  consumeDistributedRateLimit
}))
mock.module("@/lib/csrf", () => ({ enforceSameOrigin: mock(() => undefined) }))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DELETE: (...args: any[]) => Promise<Response>

beforeAll(async () => {
  const route = await import("../../../app/api/account/route")
  DELETE = route.DELETE
})

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({ data: { user: OAUTH_USER } })
  signInWithPasswordMock.mockClear()
  signInWithPasswordMock.mockResolvedValue({ error: null })
  deleteUserMock.mockClear()
  deleteUserMock.mockResolvedValue({ error: null })
  storageListMock.mockClear()
  storageListMock.mockResolvedValue({ data: [], error: null })
  consumeDistributedRateLimit.mockClear()
  consumeDistributedRateLimit.mockResolvedValue({
    allowed: true,
    remainingHits: 2,
    retryAfterMs: 0
  })
})

afterAll(() => {
  mock.restore()
})

// ─── Helpers ─────────────────────────────────────────────────────────────────
const URL = "http://localhost/api/account"
const CORR_ID = "corr-account-delete-contract"

function deleteReq(body: Record<string, unknown>) {
  return makeNextRequest(URL, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      "x-correlation-id": CORR_ID
    },
    body: JSON.stringify(body)
  })
}

// OAuth user (no password needed): just requires confirmText
const VALID_BODY = { confirmText: "DELETE" }

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 200 success response shape
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/account > 200 success — response shape contract", () => {
  it("returns HTTP 200", async () => {
    const res = await DELETE(deleteReq(VALID_BODY))
    expect(res.status).toBe(200)
  })

  it("body has 'deleted' key set to true (boolean)", async () => {
    const res = await DELETE(deleteReq(VALID_BODY))
    const body = await readJson<{ deleted: unknown }>(res)
    expect(body.deleted).toBe(true)
  })

  it("success body does NOT have 'error' or 'code' keys", async () => {
    const res = await DELETE(deleteReq(VALID_BODY))
    const body = await readJson<Record<string, unknown>>(res)
    expect(body.error).toBeUndefined()
    expect(body.code).toBeUndefined()
  })

  it("response header x-correlation-id echoes the request value", async () => {
    const res = await DELETE(deleteReq(VALID_BODY))
    expect(res.headers.get("x-correlation-id")).toBe(CORR_ID)
  })

  it("success body contains only expected keys", async () => {
    const res = await DELETE(deleteReq(VALID_BODY))
    const body = await readJson<Record<string, unknown>>(res)
    const ALLOWED = new Set(["deleted"])
    const unexpected = Object.keys(body).filter((k) => !ALLOWED.has(k))
    expect(unexpected).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 401 unauthenticated — error envelope shape
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/account > 401 unauthenticated — error shape contract", () => {
  it("returns HTTP 401 when user is null", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await DELETE(deleteReq(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it("error body has 'error' string and 'code' = 'AUTHENTICATION_REQUIRED'", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await DELETE(deleteReq(VALID_BODY))
    const body = await readJson<{ error: string; code: string }>(res)
    expect(typeof body.error).toBe("string")
    expect(body.error.length).toBeGreaterThan(0)
    expect(body.code).toBe("AUTHENTICATION_REQUIRED")
  })

  it("401 response header has x-correlation-id", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await DELETE(deleteReq(VALID_BODY))
    expect(res.headers.get("x-correlation-id")).toBe(CORR_ID)
  })

  it("401 error body contains only allowed envelope keys", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    const res = await DELETE(deleteReq(VALID_BODY))
    const body = await readJson<Record<string, unknown>>(res)
    const ALLOWED = new Set(["error", "code", "correlationId", "details"])
    const unexpected = Object.keys(body).filter((k) => !ALLOWED.has(k))
    expect(unexpected).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 400 validation error — error envelope shape
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/account > 400 validation error — error shape contract", () => {
  it("returns HTTP 400 when confirmText is missing", async () => {
    const res = await DELETE(deleteReq({}))
    expect(res.status).toBe(400)
  })

  it("returns HTTP 400 when confirmText is wrong value", async () => {
    const res = await DELETE(deleteReq({ confirmText: "delete" }))
    expect(res.status).toBe(400)
  })

  it("error body has 'error' string and 'code' = 'VALIDATION_ERROR'", async () => {
    const res = await DELETE(deleteReq({ confirmText: "WRONG" }))
    const body = await readJson<{ error: string; code: string }>(res)
    expect(typeof body.error).toBe("string")
    expect(body.code).toBe("VALIDATION_ERROR")
  })

  it("400 error body has 'details' array with Zod issue objects", async () => {
    const res = await DELETE(deleteReq({ confirmText: "WRONG" }))
    const body = await readJson<{ details: unknown }>(res)
    expect(Array.isArray(body.details)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Contract: 403 wrong password — error envelope shape
// ─────────────────────────────────────────────────────────────────────────────
describe("DELETE /api/account > 403 wrong password — error shape contract", () => {
  it("returns HTTP 403 when email user provides wrong password", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: EMAIL_USER } })
    signInWithPasswordMock.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" }
    })
    const res = await DELETE(
      deleteReq({ confirmText: "DELETE", password: "wrong-pass" })
    )
    expect(res.status).toBe(403)
  })

  it("error body has 'error' = 'Incorrect password' and 'code' = 'FORBIDDEN'", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: EMAIL_USER } })
    signInWithPasswordMock.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" }
    })
    const res = await DELETE(
      deleteReq({ confirmText: "DELETE", password: "wrong-pass" })
    )
    const body = await readJson<{ error: string; code: string }>(res)
    expect(body.error).toBe("Incorrect password")
    expect(body.code).toBe("FORBIDDEN")
  })

  it("403 response header has x-correlation-id", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: EMAIL_USER } })
    signInWithPasswordMock.mockResolvedValueOnce({
      error: { message: "Invalid login credentials" }
    })
    const res = await DELETE(
      deleteReq({ confirmText: "DELETE", password: "wrong-pass" })
    )
    expect(res.headers.get("x-correlation-id")).toBe(CORR_ID)
  })
})
