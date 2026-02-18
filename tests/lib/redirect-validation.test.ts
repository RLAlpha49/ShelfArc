import { describe, expect, it } from "bun:test"

import { ALLOWED_REDIRECT_PREFIXES } from "@/lib/auth/constants"

describe("ALLOWED_REDIRECT_PREFIXES", () => {
  it("includes required paths", () => {
    expect(ALLOWED_REDIRECT_PREFIXES).toContain("/dashboard")
    expect(ALLOWED_REDIRECT_PREFIXES).toContain("/library")
    expect(ALLOWED_REDIRECT_PREFIXES).toContain("/settings")
    expect(ALLOWED_REDIRECT_PREFIXES).toContain("/activity")
  })

  it("does not include unsafe paths", () => {
    const prefixes = [...ALLOWED_REDIRECT_PREFIXES]
    expect(prefixes).not.toContain("/")
    expect(prefixes).not.toContain("//")
    expect(prefixes).not.toContain("http")
  })

  const isValidRedirect = (path: string): boolean => {
    if (typeof path !== "string") return false
    const trimmed = path.trim()
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false
    return ALLOWED_REDIRECT_PREFIXES.some((p) => trimmed.startsWith(p))
  }

  it("validates safe redirects", () => {
    expect(isValidRedirect("/library")).toBe(true)
    expect(isValidRedirect("/dashboard")).toBe(true)
    expect(isValidRedirect("/settings/export")).toBe(true)
    expect(isValidRedirect("/activity")).toBe(true)
  })

  it("rejects unsafe redirects", () => {
    expect(isValidRedirect("//evil.com")).toBe(false)
    expect(isValidRedirect("https://evil.com")).toBe(false)
    expect(isValidRedirect("/login")).toBe(false)
    expect(isValidRedirect("")).toBe(false)
    expect(isValidRedirect("/")).toBe(false)
  })
})
