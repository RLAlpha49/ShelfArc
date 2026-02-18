import { describe, expect, it } from "bun:test"

import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"

describe("lib/books/isbn", () => {
  it("normalizes ISBN strings", () => {
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157")
    expect(normalizeIsbn("0-8044-2957-x")).toBe("080442957X")
    expect(normalizeIsbn("  0 306 40615 2 ")).toBe("0306406152")
  })

  it("validates ISBN-10 and ISBN-13", () => {
    expect(isValidIsbn("0-306-40615-2")).toBe(true)
    expect(isValidIsbn("978-0-306-40615-7")).toBe(true)
  })

  it("rejects invalid ISBNs", () => {
    expect(isValidIsbn("123")).toBe(false)
    expect(isValidIsbn("9780306406158")).toBe(false)
    expect(isValidIsbn("0306406153")).toBe(false)
  })
})
