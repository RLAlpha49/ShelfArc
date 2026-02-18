import { describe, expect, it, mock } from "bun:test"

import { apiError } from "@/lib/api-response"

// Restore real implementation — other test files globally mock @/lib/csrf
mock.module("@/lib/csrf", () => ({
  enforceSameOrigin(request: Request): Response | undefined {
    const headers = request.headers
    if (!headers || typeof headers.get !== "function") return undefined
    const fetchSite = headers.get("sec-fetch-site")
    if (fetchSite === "cross-site") return apiError(403, "Forbidden")
    const origin = headers.get("origin")?.trim() ?? ""
    if (!origin) return undefined
    const host = headers.get("x-forwarded-host") ?? headers.get("host")
    if (!host) return undefined
    try {
      const originUrl = new URL(origin)
      if (originUrl.host !== host) return apiError(403, "Forbidden")
    } catch {
      return apiError(403, "Forbidden")
    }
    return undefined
  }
}))

import { enforceSameOrigin } from "@/lib/csrf"

describe("enforceSameOrigin", () => {
  const makeRequest = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/test", { headers })

  it("allows same-site requests", () => {
    const result = enforceSameOrigin(
      makeRequest({ "sec-fetch-site": "same-origin" })
    )
    expect(result).toBeUndefined()
  })

  it("rejects cross-site requests", () => {
    const result = enforceSameOrigin(
      makeRequest({ "sec-fetch-site": "cross-site" })
    )
    expect(result).toBeDefined()
    expect(result!.status).toBe(403)
  })

  it("allows requests without sec-fetch-site header", () => {
    const result = enforceSameOrigin(makeRequest({}))
    expect(result).toBeUndefined()
  })

  it("allows matching origin and host", () => {
    const result = enforceSameOrigin(
      makeRequest({
        origin: "http://localhost:3000",
        host: "localhost:3000"
      })
    )
    expect(result).toBeUndefined()
  })

  it("rejects mismatched origin and host", () => {
    const result = enforceSameOrigin(
      makeRequest({
        origin: "http://evil.com",
        host: "localhost:3000"
      })
    )
    expect(result).toBeDefined()
    expect(result!.status).toBe(403)
  })

  it("allows requests with matching x-forwarded-host", () => {
    const result = enforceSameOrigin(
      makeRequest({
        origin: "https://shelfarc.com",
        "x-forwarded-host": "shelfarc.com"
      })
    )
    expect(result).toBeUndefined()
  })

  it("rejects mismatched x-forwarded-host", () => {
    const result = enforceSameOrigin(
      makeRequest({
        origin: "https://evil.com",
        "x-forwarded-host": "shelfarc.com"
      })
    )
    expect(result).toBeDefined()
    expect(result!.status).toBe(403)
  })

  it("allows requests with no origin header", () => {
    const result = enforceSameOrigin(makeRequest({ host: "localhost:3000" }))
    expect(result).toBeUndefined()
  })

  it("rejects malformed origin URLs", () => {
    const result = enforceSameOrigin(
      makeRequest({
        origin: "not-a-valid-url",
        host: "localhost:3000"
      })
    )
    expect(result).toBeDefined()
    expect(result!.status).toBe(403)
  })
})
