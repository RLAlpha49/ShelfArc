import { describe, expect, it } from "bun:test"

import {
  CORRELATION_HEADER,
  getCorrelationId,
  setCorrelationHeader
} from "@/lib/correlation"

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test", { headers })
}

describe("getCorrelationId", () => {
  it("returns the existing header value when it is valid (>= 8 clean chars)", () => {
    const id = "abc-1234-xyz"
    const req = makeRequest({ [CORRELATION_HEADER]: id })
    expect(getCorrelationId(req)).toBe(id)
  })

  it("strips characters outside [a-zA-Z0-9-_] from the header", () => {
    // spaces and dots are stripped; only alphanum + hyphen + underscore survive
    const req = makeRequest({ [CORRELATION_HEADER]: "ab!cd@ef#gh" })
    // stripped → "abcdefgh" (8 chars) which is valid
    expect(getCorrelationId(req)).toBe("abcdefgh")
  })

  it("trims whitespace before sanitising", () => {
    const req = makeRequest({ [CORRELATION_HEADER]: "  valid-id-1234  " })
    expect(getCorrelationId(req)).toBe("valid-id-1234")
  })

  it("falls back to a UUID when the sanitised header is shorter than 8 characters", () => {
    // "!!!" → cleaned to "" (length 0) → fallback
    const req = makeRequest({ [CORRELATION_HEADER]: "!!!" })
    const id = getCorrelationId(req)
    // UUID v4 pattern
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it("falls back to a UUID when the header is missing entirely", () => {
    const req = makeRequest()
    const id = getCorrelationId(req)
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it("generates a unique UUID on each call when no header is present", () => {
    const req = makeRequest()
    const id1 = getCorrelationId(req)
    const id2 = getCorrelationId(req)
    expect(id1).not.toBe(id2)
  })

  it("truncates an overly long header to 64 characters", () => {
    const longId = "a".repeat(100)
    const req = makeRequest({ [CORRELATION_HEADER]: longId })
    const id = getCorrelationId(req)
    expect(id.length).toBe(64)
  })

  it("accepts header values that contain hyphens and underscores", () => {
    const id = "trace-ID_abc12345"
    const req = makeRequest({ [CORRELATION_HEADER]: id })
    expect(getCorrelationId(req)).toBe(id)
  })

  it("falls back to UUID when header has exactly 7 clean characters (< 8)", () => {
    // 7 clean chars → below minimum → UUID fallback
    const req = makeRequest({ [CORRELATION_HEADER]: "abcdefg" })
    const id = getCorrelationId(req)
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
  })

  it("accepts a header with exactly 8 clean characters (boundary)", () => {
    const req = makeRequest({ [CORRELATION_HEADER]: "abcdefgh" })
    expect(getCorrelationId(req)).toBe("abcdefgh")
  })
})

describe("setCorrelationHeader", () => {
  it("sets the correlation header on the response", () => {
    const res = new Response(null)
    setCorrelationHeader(res, "my-correlation-id")
    expect(res.headers.get(CORRELATION_HEADER)).toBe("my-correlation-id")
  })

  it("overwrites an existing correlation header", () => {
    const res = new Response(null, {
      headers: { [CORRELATION_HEADER]: "old-id" }
    })
    setCorrelationHeader(res, "new-id")
    expect(res.headers.get(CORRELATION_HEADER)).toBe("new-id")
  })
})
