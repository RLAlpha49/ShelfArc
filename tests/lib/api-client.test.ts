import { afterEach, beforeEach, describe, expect, it } from "bun:test"

import { ApiClientError, apiFetch } from "@/lib/api/client"

// ─── Helpers ───────────────────────────────────────────────────────────────

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  })
}

// ─── setTimeout shim ───────────────────────────────────────────────────────
// Replaces setTimeout with a synchronous version so retry delays don't slow
// tests. capturedDelays records delay arguments for assertion.

const capturedDelays: number[] = []
let originalSetTimeout: typeof globalThis.setTimeout

beforeEach(() => {
  capturedDelays.length = 0
  originalSetTimeout = globalThis.setTimeout
  // @ts-expect-error – intentional override for test speed
  globalThis.setTimeout = (fn: () => void, ms?: number) => {
    capturedDelays.push(typeof ms === "number" ? ms : 0)
    fn()
    return 0 as unknown as ReturnType<typeof setTimeout>
  }
})

afterEach(() => {
  globalThis.setTimeout = originalSetTimeout
})

// ─── ApiClientError ────────────────────────────────────────────────────────

describe("ApiClientError", () => {
  it("has correct name and status", () => {
    const err = new ApiClientError("bad request", 400)
    expect(err.name).toBe("ApiClientError")
    expect(err.status).toBe(400)
    expect(err.message).toBe("bad request")
    expect(err).toBeInstanceOf(Error)
  })

  it("accepts optional code and details", () => {
    const err = new ApiClientError("not found", 404, "NOT_FOUND", { id: 42 })
    expect(err.code).toBe("NOT_FOUND")
    expect(err.details).toEqual({ id: 42 })
  })

  it("retryAfterMs is undefined by default", () => {
    const err = new ApiClientError("error", 500)
    expect(err.retryAfterMs).toBeUndefined()
  })
})

// ─── apiFetch – success ────────────────────────────────────────────────────

describe("apiFetch – success", () => {
  it("returns parsed JSON from a 200 response", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({ id: 1, name: "test" })
      )) as unknown as typeof fetch

    const result = await apiFetch<{ id: number; name: string }>("/api/test")
    expect(result).toEqual({ id: 1, name: "test" })
  })

  it("serialises body as JSON and sets Content-Type header", async () => {
    let capturedInit: RequestInit | undefined
    globalThis.fetch = ((_url: string, init?: RequestInit) => {
      capturedInit = init
      return Promise.resolve(jsonResponse({ ok: true }))
    }) as unknown as typeof fetch

    await apiFetch("/api/test", { method: "POST", body: { name: "Alice" } })
    expect(capturedInit?.body).toBe(JSON.stringify({ name: "Alice" }))
    const headers = capturedInit?.headers as Record<string, string>
    expect(headers["Content-Type"]).toBe("application/json")
  })

  it("does not attach body when no body option is provided", async () => {
    let capturedInit: RequestInit | undefined
    globalThis.fetch = ((_url: string, init?: RequestInit) => {
      capturedInit = init
      return Promise.resolve(jsonResponse({ ok: true }))
    }) as unknown as typeof fetch

    await apiFetch("/api/test", { method: "GET" })
    expect(capturedInit?.body).toBeUndefined()
  })
})

// ─── apiFetch – error mapping ──────────────────────────────────────────────

describe("apiFetch – error mapping", () => {
  it("throws ApiClientError with correct status on HTTP error", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({ error: "Not found" }, 404)
      )) as unknown as typeof fetch

    expect(apiFetch("/api/test")).rejects.toBeInstanceOf(ApiClientError)

    try {
      globalThis.fetch = (() =>
        Promise.resolve(
          jsonResponse({ error: "Not found" }, 404)
        )) as unknown as typeof fetch
      await apiFetch("/api/test")
    } catch (e) {
      expect((e as ApiClientError).status).toBe(404)
    }
  })

  it("uses the error message from the response body", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({ error: "Custom message" }, 400)
      )) as unknown as typeof fetch

    try {
      await apiFetch("/api/test")
    } catch (e) {
      expect((e as ApiClientError).message).toBe("Custom message")
    }
  })

  it("falls back to a generic message when body has no error field", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({ msg: "oops" }, 500)
      )) as unknown as typeof fetch

    try {
      await apiFetch("/api/test")
    } catch (e) {
      expect((e as ApiClientError).message).toContain("500")
    }
  })

  it("sets code from response body", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({ error: "err", code: "VALIDATION_ERROR" }, 422)
      )) as unknown as typeof fetch

    try {
      await apiFetch("/api/test")
    } catch (e) {
      expect((e as ApiClientError).code).toBe("VALIDATION_ERROR")
    }
  })
})

// ─── apiFetch – non-retryable status codes ────────────────────────────────
// isNonRetryable returns true for all ApiClientErrors where status !== 429.
// This means even 5xx HTTP errors are not retried (only network errors are).

describe("apiFetch – non-retryable status codes", () => {
  for (const status of [400, 401, 403, 404, 409, 422, 500, 503]) {
    it(`does not retry on HTTP ${status}`, async () => {
      let callCount = 0
      globalThis.fetch = (() => {
        callCount++
        return Promise.resolve(jsonResponse({ error: "error" }, status))
      }) as unknown as typeof fetch

      expect(apiFetch("/api/test", { retries: 3 })).rejects.toBeInstanceOf(
        ApiClientError
      )

      expect(callCount).toBe(1)
    })
  }
})

// ─── apiFetch – 429 / rate limiting ───────────────────────────────────────

describe("apiFetch – 429 / rate limiting", () => {
  it("retries on 429 (429 is retryable unlike other HTTP errors)", async () => {
    let callCount = 0
    globalThis.fetch = (() => {
      callCount++
      return Promise.resolve(
        jsonResponse({ error: "rate limited" }, 429, { "Retry-After": "0" })
      )
    }) as unknown as typeof fetch

    expect(apiFetch("/api/test", { retries: 1 })).rejects.toBeInstanceOf(
      ApiClientError
    )

    expect(callCount).toBe(2)
  })

  it("parses numeric Retry-After header (seconds → ms)", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({ error: "rate limited" }, 429, { "Retry-After": "5" })
      )) as unknown as typeof fetch

    try {
      await apiFetch("/api/test")
    } catch (e) {
      expect(e).toBeInstanceOf(ApiClientError)
      expect((e as ApiClientError).retryAfterMs).toBe(5000)
    }
  })

  it("parses date-format Retry-After header", async () => {
    const futureDate = new Date(Date.now() + 5000).toUTCString()
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({ error: "rate limited" }, 429, {
          "Retry-After": futureDate
        })
      )) as unknown as typeof fetch

    try {
      await apiFetch("/api/test")
    } catch (e) {
      expect(e).toBeInstanceOf(ApiClientError)
      // Allow ±500 ms for processing overhead
      expect((e as ApiClientError).retryAfterMs).toBeGreaterThan(3000)
      expect((e as ApiClientError).retryAfterMs).toBeLessThanOrEqual(30_000)
    }
  })

  it("caps Retry-After at 30 000 ms", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({ error: "rate limited" }, 429, { "Retry-After": "9999" })
      )) as unknown as typeof fetch

    try {
      await apiFetch("/api/test")
    } catch (e) {
      expect((e as ApiClientError).retryAfterMs).toBe(30_000)
    }
  })

  it("leaves retryAfterMs undefined when Retry-After header is absent", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({ error: "rate limited" }, 429)
      )) as unknown as typeof fetch

    try {
      await apiFetch("/api/test")
    } catch (e) {
      expect((e as ApiClientError).retryAfterMs).toBeUndefined()
    }
  })

  it("uses retryAfterMs as the retry delay for 429 responses", async () => {
    globalThis.fetch = (() => {
      return Promise.resolve(
        jsonResponse({ error: "rate limited" }, 429, { "Retry-After": "2" })
      )
    }) as unknown as typeof fetch

    expect(apiFetch("/api/test", { retries: 1 })).rejects.toBeInstanceOf(
      ApiClientError
    )

    // retryDelay returns err.retryAfterMs (2000 ms) for 429 with Retry-After: 2
    expect(capturedDelays[0]).toBe(2000)
  })
})

// ─── apiFetch – network errors and retry ──────────────────────────────────

describe("apiFetch – network errors / retry", () => {
  it("retries a TypeError (network failure) up to retries count", async () => {
    let callCount = 0
    globalThis.fetch = (() => {
      callCount++
      return Promise.reject(new TypeError("Failed to fetch"))
    }) as unknown as typeof fetch

    expect(apiFetch("/api/test", { retries: 2 })).rejects.toBeInstanceOf(Error)

    // 1 initial + 2 retries = 3 total attempts
    expect(callCount).toBe(3)
  })

  it("succeeds on the second attempt after a network error", async () => {
    let callCount = 0
    globalThis.fetch = (() => {
      callCount++
      if (callCount === 1) return Promise.reject(new TypeError("network error"))
      return Promise.resolve(jsonResponse({ ok: true }))
    }) as unknown as typeof fetch

    const result = await apiFetch<{ ok: boolean }>("/api/test", { retries: 1 })
    expect(result).toEqual({ ok: true })
    expect(callCount).toBe(2)
  })

  it("uses exponential backoff (2^attempt * 500 ms) for generic errors", async () => {
    globalThis.fetch = (() =>
      Promise.reject(new TypeError("network error"))) as unknown as typeof fetch

    expect(apiFetch("/api/test", { retries: 2 })).rejects.toBeInstanceOf(Error)

    // attempt 0 → 2^0*500=500 ms, attempt 1 → 2^1*500=1000 ms
    expect(capturedDelays[0]).toBe(500)
    expect(capturedDelays[1]).toBe(1000)
  })

  it("does not retry on AbortError (DOMException)", async () => {
    let callCount = 0
    globalThis.fetch = (() => {
      callCount++
      return Promise.reject(
        new DOMException("The operation was aborted.", "AbortError")
      )
    }) as unknown as typeof fetch

    expect(apiFetch("/api/test", { retries: 3 })).rejects.toBeInstanceOf(
      DOMException
    )

    expect(callCount).toBe(1)
  })

  it("makes no delay after the final failed attempt", async () => {
    globalThis.fetch = (() =>
      Promise.reject(new TypeError("network error"))) as unknown as typeof fetch

    // retries: 1 → 2 total attempts, only 1 delay (between attempt 0 and 1)
    expect(apiFetch("/api/test", { retries: 1 })).rejects.toBeInstanceOf(Error)

    expect(capturedDelays).toHaveLength(1)
  })
})
