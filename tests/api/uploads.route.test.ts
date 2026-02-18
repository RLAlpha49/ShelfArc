import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

import { makeFormDataRequest, readJson } from "./test-utils"

const toBufferMock = mock(async () => Buffer.from("image"))

const transformerMock = {
  rotate: () => transformerMock,
  resize: () => transformerMock,
  webp: () => transformerMock,
  toBuffer: toBufferMock
}

mock.module("sharp", () => ({
  default: () => transformerMock
}))

mock.module("node:stream", () => ({
  Readable: {
    fromWeb: () => ({
      pipe: () => transformerMock
    })
  },
  // Provide a minimal Writable export so other modules importing
  // { Writable } from "node:stream" don't fail during import-time.
  Writable: class {
    write(_chunk: unknown, _encoding?: string, callback?: () => void) {
      if (callback) callback()
      return true
    }
    end() {
      // noop
      return undefined
    }
  },
  // Provide a minimal Transform export so imports of { Transform } from
  // "node:stream" succeed during tests (some dependencies import it).
  Transform: class {
    _transform(_chunk: unknown, _encoding?: string, callback?: () => void) {
      if (callback) callback()
    }
    write(_chunk: unknown, _encoding?: string, callback?: () => void) {
      if (callback) callback()
      return true
    }
    end() {
      // noop
      return undefined
    }
  }
}))

type UserResult = { data: { user: { id: string } | null } }
type StorageResult = { error: { message: string } | null }

const uploadMock = mock(async (): Promise<StorageResult> => ({ error: null }))
const removeMock = mock(async (): Promise<StorageResult> => ({ error: null }))

const storageFromMock = mock(() => ({
  upload: uploadMock,
  remove: removeMock
}))

const createAdminClient = mock(() => ({
  storage: {
    from: storageFromMock
  }
}))

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

mock.module("@/lib/supabase/admin", () => ({ createAdminClient }))
mock.module("@/lib/supabase/server", () => ({ createUserClient }))

const loadRoute = async () => await import("../../app/api/uploads/route")

const buildFormData = (options?: {
  file?: File
  kind?: string
  replacePath?: string
}) => {
  const formData = new FormData()
  formData.set(
    "file",
    options?.file ??
      new File([new Uint8Array([1, 2, 3])], "avatar.png", {
        type: "image/png"
      })
  )
  formData.set("kind", options?.kind ?? "avatar")
  if (options?.replacePath) {
    formData.set("replacePath", options.replacePath)
  }
  return formData
}

beforeEach(() => {
  uploadMock.mockClear()
  removeMock.mockClear()
  storageFromMock.mockClear()
  createAdminClient.mockClear()
  createUserClient.mockClear()
  getUserMock.mockClear()
  toBufferMock.mockClear()
  toBufferMock.mockResolvedValue(Buffer.from("image"))
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } })
  uploadMock.mockResolvedValue({ error: null })
  removeMock.mockResolvedValue({ error: null })
})

afterEach(() => {
  toBufferMock.mockResolvedValue(Buffer.from("image"))
})

describe("POST /api/uploads", () => {
  it("returns 401 when user is not authenticated", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    const { POST } = await loadRoute()

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      buildFormData()
    )

    const response = await POST(request)

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("Unauthorized")
  })

  it("returns 400 for invalid form data", async () => {
    const { POST } = await loadRoute()

    const badRequest = {
      formData: () => {
        throw new Error("bad form")
      }
    } as unknown as Request

    const response = await POST(badRequest)

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid form data")
  })

  it("returns 400 when file is missing", async () => {
    const { POST } = await loadRoute()

    const formData = new FormData()
    formData.set("kind", "avatar")

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      formData
    )
    const response = await POST(request)

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Missing file")
  })

  it("returns 400 for invalid upload kind", async () => {
    const { POST } = await loadRoute()

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      buildFormData({ kind: "invalid" })
    )

    const response = await POST(request)

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid upload kind")
  })

  it("returns 415 for unsupported file type", async () => {
    const { POST } = await loadRoute()

    const badFile = new File([new Uint8Array([1])], "bad.gif", {
      type: "image/gif"
    })

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      buildFormData({ file: badFile })
    )

    const response = await POST(request)

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(415)
    expect(body.error).toBe("Unsupported file type")
  })

  it("returns 400 for empty file", async () => {
    const { POST } = await loadRoute()

    const emptyFile = new File([], "empty.png", { type: "image/png" })

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      buildFormData({ file: emptyFile })
    )

    const response = await POST(request)

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Empty file")
  })

  it("returns 413 when file exceeds size limit", async () => {
    const { POST } = await loadRoute()

    const largeFile = new File(
      [new Uint8Array(2 * 1024 * 1024 + 1)],
      "large.png",
      { type: "image/png" }
    )

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      buildFormData({ file: largeFile })
    )

    const response = await POST(request)

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(413)
    expect(body.error).toBe("File size exceeds limit")
  })

  it("returns 400 for invalid replace path", async () => {
    const { POST } = await loadRoute()

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      buildFormData({ replacePath: "../evil" })
    )

    const response = await POST(request)

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid replace path")
  })

  it("returns 400 when image processing fails", async () => {
    toBufferMock.mockRejectedValueOnce(new Error("process failed"))

    const { POST } = await loadRoute()

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      buildFormData()
    )

    const response = await POST(request)

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("process failed")
  })

  it("returns 500 when storage upload fails", async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: "nope" } })

    const { POST } = await loadRoute()

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      buildFormData()
    )

    const response = await POST(request)

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(500)
    expect(body.error).toBe("nope")
  })

  it("uploads and returns file path", async () => {
    const { POST } = await loadRoute()

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      buildFormData()
    )

    const response = await POST(request)

    const body = await readJson<{ path: string }>(response)
    expect(response.status).toBe(200)
    expect(body.path).toMatch(/^user-1\/avatars\/.+\.webp$/)
  })

  it("enqueues cleanup when replace removal fails", async () => {
    removeMock.mockResolvedValueOnce({ error: { message: "remove failed" } })

    const { POST } = await loadRoute()

    const request = makeFormDataRequest(
      "http://localhost/api/uploads",
      buildFormData({ replacePath: "user-1/avatars/old.webp" })
    )

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(uploadMock.mock.calls.length).toBe(2)

    const calls = uploadMock.mock.calls as unknown as Array<unknown[]>
    const cleanupPath = String(calls[1]?.[0] ?? "")
    expect(cleanupPath).toContain("user-1/cleanup/failed-deletion-")
  })
})
