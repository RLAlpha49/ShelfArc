import { afterEach, describe, expect, it, mock } from "bun:test"
import { makeNextRequest } from "./test-utils"

const loadRoute = async () =>
  await import("../../app/api/covers/open-library/route")

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("GET /api/covers/open-library", () => {
  it("returns 400 for invalid ISBN", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/covers/open-library?isbn=bad")
    )

    expect(response.status).toBe(400)
  })

  it("returns 404 when upstream cover is missing", async () => {
    const fetchMock = mock(async () => new Response(null, { status: 404 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest(
        "http://localhost/api/covers/open-library?isbn=9780306406157"
      )
    )

    expect(response.status).toBe(404)
  })

  it("returns image response with cache headers", async () => {
    const imageBytes = new Uint8Array([1, 2, 3, 4])

    const fetchMock = mock(
      async () =>
        new Response(imageBytes, {
          status: 200,
          headers: { "Content-Type": "image/png" }
        })
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest(
        "http://localhost/api/covers/open-library?isbn=9780306406157&size=S"
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe("image/png")
    expect(response.headers.get("Cache-Control")).toContain("max-age=86400")
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
  })

  it("returns 504 on fetch timeout", async () => {
    const timeoutError = new Error("timeout") as Error & { name: string }
    timeoutError.name = "AbortError"

    const fetchMock = mock(async () => {
      throw timeoutError
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest(
        "http://localhost/api/covers/open-library?isbn=9780306406157"
      )
    )

    expect(response.status).toBe(504)
  })
})
