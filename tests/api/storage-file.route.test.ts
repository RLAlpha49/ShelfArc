import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

type UserResult = { data: { user: { id: string } | null } }
type DownloadResult = { data: Blob | null; error: { message: string } | null }

const getUserMock = mock(
  async (): Promise<UserResult> => ({
    data: { user: { id: "user-1" } }
  })
)

const createUserClient = mock(async () => ({
  auth: {
    getUser: getUserMock
  }
}))

const downloadMock = mock(
  async (): Promise<DownloadResult> => ({
    data: new Blob(["hello"], { type: "text/plain" }),
    error: null
  })
)

const storageFromMock = mock(() => ({
  download: downloadMock
}))

const createAdminClient = mock(() => ({
  storage: {
    from: storageFromMock
  }
}))

mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/supabase/admin", () => ({ createAdminClient }))

const loadRoute = async () => await import("../../app/api/storage/file/route")

beforeEach(() => {
  downloadMock.mockClear()
  getUserMock.mockClear()
  storageFromMock.mockClear()
  createUserClient.mockClear()
  createAdminClient.mockClear()
})

afterEach(() => {
  downloadMock.mockResolvedValue({
    data: new Blob(["hello"], { type: "text/plain" }),
    error: null
  })
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
})

describe("GET /api/storage/file", () => {
  it("returns 400 when path is missing", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/storage/file")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Missing path")
  })

  it("returns 400 when path is unsafe", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/storage/file?path=../evil")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid path")
  })

  it("returns 401 when user is not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/storage/file?path=user-1/file")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 403 when requesting another user's file", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/storage/file?path=other/file")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(403)
    expect(body.error).toBe("Forbidden")
  })

  it("returns 404 when file is missing", async () => {
    downloadMock.mockResolvedValueOnce({
      data: null,
      error: { message: "404" }
    })

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/storage/file?path=user-1/file")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(404)
    expect(body.error).toBe("Not found")
  })

  it("returns file response with headers", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/storage/file?path=user-1/file")
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/plain")
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600")
    expect(response.headers.get("Content-Length")).toBe("5")
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
  })
})
