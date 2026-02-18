import { afterEach, describe, expect, it, mock } from "bun:test"

import { makeNextRequest, readJson } from "./test-utils"

const getUserMock = mock(
  async (): Promise<{ data: { user: { id: string } | null } }> => ({
    data: { user: { id: "user-1" } }
  })
)

const createUserClient = mock(async () => ({
  auth: { getUser: getUserMock }
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const consumeDistributedRateLimit = mock(async (): Promise<any> => null)

mock.module("@/lib/supabase/server", () => ({ createUserClient }))
mock.module("@/lib/rate-limit-distributed", () => ({
  consumeDistributedRateLimit
}))

const loadRoute = async () => await import("../../app/api/books/search/route")

const originalFetch = globalThis.fetch
const originalKeys = process.env.GOOGLE_BOOKS_API_KEYS
const originalKey = process.env.GOOGLE_BOOKS_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  process.env.GOOGLE_BOOKS_API_KEYS = originalKeys
  process.env.GOOGLE_BOOKS_API_KEY = originalKey
})

describe("GET /api/books/search", () => {
  it("returns 400 when query is missing", async () => {
    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/search")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Missing query")
  })

  it("returns 400 when Google Books keys are missing", async () => {
    process.env.GOOGLE_BOOKS_API_KEYS = ""
    process.env.GOOGLE_BOOKS_API_KEY = ""

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest("http://localhost/api/books/search?q=Test")
    )

    const body = await readJson<{ error: string }>(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("Google Books API key is not configured")
  })

  it("returns Google Books results", async () => {
    process.env.GOOGLE_BOOKS_API_KEYS = "key-1"

    const payload = {
      items: [
        {
          id: "vol-1",
          volumeInfo: {
            title: "Test Book",
            authors: ["Author One"],
            industryIdentifiers: [
              { type: "ISBN_13", identifier: "9780306406157" }
            ],
            imageLinks: {
              thumbnail: "http://example.com/cover.jpg"
            }
          }
        }
      ]
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
      makeNextRequest("http://localhost/api/books/search?q=Test&limit=1&page=1")
    )

    const body = await readJson<{
      data: Array<{ id: string; title: string; coverUrl: string | null }>
      meta: { sourceUsed: string; page: number; limit: number }
    }>(response)

    expect(response.status).toBe(200)
    expect(body.meta.sourceUsed).toBe("google_books")
    expect(body.meta.page).toBe(1)
    expect(body.meta.limit).toBe(1)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe("vol-1")
    expect(body.data[0].title).toBe("Test Book")
    expect(body.data[0].coverUrl).toBe("https://example.com/cover.jpg")
  })

  it("returns Open Library results", async () => {
    const openLibraryPayload = {
      docs: [
        {
          key: "OL1",
          title: "Open Book",
          author_name: ["Open Author"],
          publisher: ["Open Publisher"],
          first_publish_year: 2001,
          cover_i: 123
        }
      ]
    }

    const fetchMock = mock(
      async () =>
        new Response(JSON.stringify(openLibraryPayload), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    )

    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { GET } = await loadRoute()

    const response = await GET(
      makeNextRequest(
        "http://localhost/api/books/search?q=9780306406157&source=open_library"
      )
    )

    const body = await readJson<{
      data: Array<{ id: string; title: string }>
      meta: { sourceUsed: string }
    }>(response)

    expect(response.status).toBe(200)
    expect(body.meta.sourceUsed).toBe("open_library")
    expect(body.data).toHaveLength(1)
    expect(body.data[0].title).toBe("Open Book")

    const calls = fetchMock.mock.calls as unknown as Array<unknown[]>
    const calledUrl = String(calls[0]?.[0] ?? "")
    expect(calledUrl).toContain("isbn=9780306406157")
  })
})
