import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

type UserResult = {
  data: {
    user: { id: string; email: string } | null
  }
}

const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: { user: { id: "user-1", email: "test@example.com" } }
  })
)

const signInMock = mock(async () => ({ error: null }))
const signOutMock = mock(async () => ({}))

const createUserClient = mock(async () => ({
  auth: {
    getUser: getUserMock,
    signInWithPassword: signInMock,
    signOut: signOutMock
  }
}))

// Admin client — updateUserById for the password update step
const adminUpdateUserMock = mock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (): Promise<any> => ({ error: null })
)
const adminClientMock = {
  auth: { admin: { updateUserById: adminUpdateUserMock } }
}
const createAdminClientMock = mock(() => adminClientMock)

// Distributed rate limit + CSRF
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

mock.module("server-only", () => ({}))
mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock
}))
mock.module("@/lib/rate-limit-distributed", () => distributedRateLimitMocks)
mock.module("@/lib/csrf", () => ({ enforceSameOrigin: enforceSameOriginMock }))

const loadRoute = async () =>
  await import("../../app/api/account/password/route")

// Helper — POST with JSON body
const makePostRequest = (body: Record<string, unknown>) =>
  makeNextRequest("http://localhost/api/account/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  })

beforeEach(() => {
  getUserMock.mockClear()
  getUserMock.mockResolvedValue({
    data: { user: { id: "user-1", email: "test@example.com" } }
  })
  signInMock.mockClear()
  signInMock.mockResolvedValue({ error: null })
  signOutMock.mockClear()
  createUserClient.mockClear()
  adminUpdateUserMock.mockClear()
  adminUpdateUserMock.mockResolvedValue({ error: null })
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
    data: { user: { id: "user-1", email: "test@example.com" } }
  })
})

// ---------------------------------------------------------------------------
// POST /api/account/password
// ---------------------------------------------------------------------------

describe("POST /api/account/password — authentication", () => {
  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ currentPassword: "old", newPassword: "New@Pass1!" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Not authenticated")
  })

  it("returns 429 when rate limited", async () => {
    distributedRateLimitMocks.consumeDistributedRateLimit.mockResolvedValueOnce(
      { allowed: false, retryAfterMs: 900_000 }
    )

    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ currentPassword: "old", newPassword: "New@Pass1!" })
    )

    expect(response.status).toBe(429)
  })
})

describe("POST /api/account/password — validation", () => {
  it("returns 400 when currentPassword is missing", async () => {
    const { POST } = await loadRoute()
    const response = await POST(makePostRequest({ newPassword: "New@Pass1!" }))

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 when newPassword is missing", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ currentPassword: "old-password" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Validation failed")
  })

  it("returns 400 when new password fails policy check", async () => {
    // "weak" is 4 chars — fails real validatePassword (min 8, no uppercase, no number)
    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ currentPassword: "old", newPassword: "weak" })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBeTruthy()
  })

  it("returns 400 when new password fails strength check", async () => {
    // "Password1" passes policy (8+ chars, uppercase, lowercase, number) but
    // scores 0-1 on zxcvbn due to being a top common password pattern
    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({ currentPassword: "old", newPassword: "Password1" })
    )

    expect(response.status).toBe(400)
  })
})

describe("POST /api/account/password — re-authentication", () => {
  it("returns 403 when current password is incorrect", async () => {
    signInMock.mockResolvedValueOnce({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: { message: "Invalid login credentials" } as any
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({
        currentPassword: "wrong-password",
        newPassword: "New@Pass1!"
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(403)
    expect(body.error).toBe("Current password is incorrect")
  })
})

describe("POST /api/account/password — successful change", () => {
  it("returns { updated: true } and revokes other sessions", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({
        currentPassword: "correct-old-pw",
        newPassword: "New@Pass1!"
      })
    )

    const body = await readJson<{ updated: boolean }>(response)
    expect(response.status).toBe(200)
    expect(body.updated).toBe(true)
    expect(adminUpdateUserMock).toHaveBeenCalledWith("user-1", {
      password: "New@Pass1!"
    })
    // signOut with scope=others revokes other active sessions
    expect(signOutMock).toHaveBeenCalledWith({ scope: "others" })
  })
})

describe("POST /api/account/password — error handling", () => {
  it("returns 500 when admin updateUserById fails", async () => {
    adminUpdateUserMock.mockResolvedValueOnce({
      error: { message: "Update failed" }
    })

    const { POST } = await loadRoute()
    const response = await POST(
      makePostRequest({
        currentPassword: "correct-old-pw",
        newPassword: "New@Pass1!"
      })
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("Failed to update password")
  })
})
