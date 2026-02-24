import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

type UserResult = {
  data: {
    user: {
      id: string
      email: string
      identities: Array<{ provider: string }>
    } | null
  }
}

const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: {
      user: {
        id: "user-1",
        email: "test@example.com",
        identities: [{ provider: "email" }]
      }
    }
  })
)

// signInWithPassword mock for email/password re-authentication
const signInMock = mock(async () => ({ error: null }))

const createUserClient = mock(async () => ({
  auth: {
    getUser: getUserMock,
    signInWithPassword: signInMock
  }
}))

// Admin Supabase client mocks
const adminDeleteUserMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ error: null })
)
const storageBucket = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list: mock(async (): Promise<any> => ({ data: [] })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remove: mock(async (): Promise<any> => ({}))
}
const adminClientMock = {
  auth: {
    admin: { deleteUser: adminDeleteUserMock }
  },
  storage: { from: mock(() => storageBucket) }
}
const createAdminClientMock = mock(() => adminClientMock)

// Distributed rate limit
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

// CSRF
const enforceSameOriginMock = mock(() => undefined)

mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock
}))
mock.module("@/lib/rate-limit-distributed", () => distributedRateLimitMocks)
mock.module("@/lib/csrf", () => ({ enforceSameOrigin: enforceSameOriginMock }))

const loadRoute = async () => await import("../../app/api/account/route")

// Helper that builds a DELETE request with a JSON body
const makeDeleteRequest = (body: Record<string, unknown>) =>
  makeNextRequest("http://localhost/api/account", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({
    data: {
      user: {
        id: "user-1",
        email: "test@example.com",
        identities: [{ provider: "email" }]
      }
    }
  })
  signInMock.mockClear()
  signInMock.mockResolvedValue({ error: null })
  createUserClient.mockClear()
  adminDeleteUserMock.mockClear()
  adminDeleteUserMock.mockResolvedValue({ error: null })
  storageBucket.list.mockClear()
  storageBucket.list.mockResolvedValue({ data: [] })
  storageBucket.remove.mockClear()
  createAdminClientMock.mockClear()
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
  getUserMock.mockResolvedValue({
    data: {
      user: {
        id: "user-1",
        email: "test@example.com",
        identities: [{ provider: "email" }]
      }
    }
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/account
// ---------------------------------------------------------------------------

describe("DELETE /api/account — authentication", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeDeleteRequest({ confirmText: "DELETE", password: "pw" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false, retryAfterMs: 3_600_000 }
    )

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeDeleteRequest({ confirmText: "DELETE", password: "pw" })
    )

    expect(response.status).toBe(429)
  })
})

describe("DELETE /api/account — validation", () => {
  it("returns 400 when confirmText is wrong", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(makeDeleteRequest({ confirmText: "delete" }))

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 when confirmText is missing", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(makeDeleteRequest({}))

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 403 when password is incorrect for email account", async () => {
    signInMock.mockResolvedValueOnce({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: { message: "Invalid login credentials" } as any
    })

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeDeleteRequest({ confirmText: "DELETE", password: "wrong-password" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(403)
    expect(body.error).toBe("Incorrect password")
  })
})

describe("DELETE /api/account — successful deletion", () => {
  it("deletes account and returns { deleted: true } for email account", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeDeleteRequest({ confirmText: "DELETE", password: "correct-pw" })
    )

    const body = await readJson<{ deleted: boolean }>(response)
    expect(response.status).toBe(200)
    expect(body.deleted).toBe(true)
    expect(adminDeleteUserMock).toHaveBeenCalledWith("user-1")
  })

  it("deletes OAuth-only account without requiring a password", async () => {
    // OAuth-only user has no email identity
    getUserMock.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          email: "oauth@example.com",
          identities: [{ provider: "google" }]
        }
      }
    })

    const { DELETE } = await loadRoute()
    // No password in body — valid for OAuth-only accounts
    const response = await DELETE(makeDeleteRequest({ confirmText: "DELETE" }))

    const body = await readJson<{ deleted: boolean }>(response)
    expect(response.status).toBe(200)
    expect(body.deleted).toBe(true)
    // signInWithPassword should NOT have been called
    expect(signInMock).not.toHaveBeenCalled()
  })
})

describe("DELETE /api/account — error handling", () => {
  it("returns 500 when admin deleteUser fails", async () => {
    adminDeleteUserMock.mockResolvedValueOnce({
      error: { message: "Auth deletion failed" }
    })

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      makeDeleteRequest({ confirmText: "DELETE", password: "correct-pw" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to delete account")
  })
})
