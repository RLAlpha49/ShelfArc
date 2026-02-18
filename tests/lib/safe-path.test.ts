import { describe, expect, it } from "bun:test"

import { isSafeStoragePath } from "@/lib/storage/safe-path"

describe("isSafeStoragePath", () => {
  it("accepts normal relative storage paths", () => {
    expect(isSafeStoragePath("user-1/avatars/file.webp")).toBe(true)
    expect(isSafeStoragePath("user-1/covers/series/abc-123.webp")).toBe(true)
  })

  it("rejects traversal sequences", () => {
    expect(isSafeStoragePath("../evil")).toBe(false)
    expect(isSafeStoragePath("user-1/../evil")).toBe(false)
    expect(isSafeStoragePath(String.raw`user-1\\evil`)).toBe(false)
    expect(isSafeStoragePath("/absolute/path")).toBe(false)
  })

  it("rejects single-encoded traversal", () => {
    expect(isSafeStoragePath("user-1/%2e%2e/evil")).toBe(false)
    expect(isSafeStoragePath("user-1/%2E%2E%2Fevil")).toBe(false)
    expect(isSafeStoragePath("user-1/%2fetc/passwd")).toBe(false)
    expect(isSafeStoragePath(String.raw`user-1/%5cwindows\\system32`)).toBe(
      false
    )
    expect(isSafeStoragePath("user-1/%00null")).toBe(false)
  })

  it("rejects double-encoded traversal", () => {
    // %252e -> %2e -> .
    expect(isSafeStoragePath("user-1/%252e%252e%252fevil")).toBe(false)
  })

  it("rejects invalid percent-encoding", () => {
    expect(isSafeStoragePath("user-1/%E0%A4")).toBe(false)
  })
})
