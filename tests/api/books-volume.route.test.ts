import { afterEach, describe, expect, it, mock } from "bun:test"
import { makeNextRequest, readJson } from "./test-utils"

const loadRoute = async () =>
  await import("../../app/api/books/volume/[volumeId]/route")

const originalFetch = globalThis.fetch
const originalKeys = process.env.GOOGLE_BOOKS_API_KEYS
const originalKey = process.env.GOOGLE_BOOKS_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  process.env.GOOGLE_BOOKS_API_KEYS = originalKeys
  process.env.GOOGLE_BOOKS_API_KEY = originalKey
})

describe("GET /api/books/volume/[volumeId]", () => {
  it("returns 400 when volume id is missing", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/volume/%20"),
      { params: Promise.resolve({ volumeId: "" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Missing volume id")
  })

  it("returns 400 when Google Books keys are missing", async () => {
    process.env.GOOGLE_BOOKS_API_KEYS = ""
    process.env.GOOGLE_BOOKS_API_KEY = ""

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/volume/vol-1"),
      { params: Promise.resolve({ volumeId: "vol-1" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Google Books API key is not configured")
  })

  it("returns 404 when volume is missing", async () => {
    process.env.GOOGLE_BOOKS_API_KEYS = "key-1"

    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/volume/vol-1"),
      { params: Promise.resolve({ volumeId: "vol-1" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(404)
    expect(body.error).toBe("Google Books volume not found")
  })

  it("returns 404 for missing Google Books volume", async () => {
    process.env.GOOGLE_BOOKS_API_KEYS = "key-1"

    const fetchMock = mock(async () => new Response(null, { status: 404 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/volume/vol-404"),
      { params: Promise.resolve({ volumeId: "vol-404" }) }
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(404)
    expect(body.error).toBe("Google Books volume fetch failed")
  })

  it("returns normalized volume result", async () => {
    process.env.GOOGLE_BOOKS_API_KEYS = "key-1"

    const payload = {
      id: "vol-1",
      volumeInfo: {
        title: "Volume One",
        authors: ["Author"],
        industryIdentifiers: [{ type: "ISBN_13", identifier: "9780306406157" }],
        imageLinks: {
          thumbnail: "http://example.com/volume.jpg"
        }
      }
    }

    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/volume/vol-1"),
      { params: Promise.resolve({ volumeId: "vol-1" }) }
    )

    const body = await readJson<{ result: { id: string; title: string } }>(
      response
    )

    expect(response.status).toBe(200)
    expect(body.result.id).toBe("vol-1")
    expect(body.result.title).toBe("Volume One")
  })
})
