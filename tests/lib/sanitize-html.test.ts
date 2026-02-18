import { describe, expect, it } from "bun:test"
import {
  sanitizeHtml,
  sanitizeOptionalHtml,
  sanitizePlainText,
  sanitizeOptionalPlainText
} from "@/lib/sanitize-html"

describe("sanitizeHtml", () => {
  it("preserves allowed tags", () => {
    const input = "<p>Hello <strong>world</strong></p>"
    expect(sanitizeHtml(input)).toBe("<p>Hello <strong>world</strong></p>")
  })

  it("preserves allowed attributes", () => {
    const input = '<a href="https://example.com" title="Link">click</a>'
    expect(sanitizeHtml(input)).toBe(
      '<a href="https://example.com" title="Link">click</a>'
    )
  })

  it("strips script tags", () => {
    const input = '<script>alert("xss")</script>'
    expect(sanitizeHtml(input)).not.toContain("<script")
  })

  it("strips onerror attributes", () => {
    const input = '<img onerror="alert(1)" src="x">'
    expect(sanitizeHtml(input)).not.toContain("onerror")
  })

  it("strips style attributes", () => {
    const input = '<p style="color:red">text</p>'
    expect(sanitizeHtml(input)).not.toContain("style")
  })

  it("strips disallowed tags", () => {
    const input = "<div><p>hello</p></div>"
    const result = sanitizeHtml(input)
    expect(result).not.toContain("<div")
    expect(result).toContain("<p>hello</p>")
  })

  it("handles nested XSS payloads", () => {
    const input = '<a href="javascript:alert(1)">click</a>'
    const result = sanitizeHtml(input)
    expect(result).not.toContain("javascript:")
  })
})

describe("sanitizeOptionalHtml", () => {
  it("returns null for empty string", () => {
    expect(sanitizeOptionalHtml("")).toBeNull()
  })

  it("returns null for null", () => {
    expect(sanitizeOptionalHtml(null)).toBeNull()
  })

  it("returns null for undefined", () => {
    expect(sanitizeOptionalHtml(undefined)).toBeNull() //NOSONAR
  })

  it("returns null when only tags are stripped", () => {
    expect(sanitizeOptionalHtml("<script>evil()</script>")).toBeNull()
  })

  it("returns sanitized HTML for valid input", () => {
    const result = sanitizeOptionalHtml("<p>Hello</p>")
    expect(result).toBe("<p>Hello</p>")
  })
})

describe("sanitizePlainText", () => {
  it("strips all HTML tags", () => {
    expect(sanitizePlainText("<b>bold</b> text")).toBe("bold text")
  })

  it("preserves plain text", () => {
    expect(sanitizePlainText("hello world")).toBe("hello world")
  })

  it("trims whitespace", () => {
    expect(sanitizePlainText("  hello  ")).toBe("hello")
  })

  it("handles XSS payloads", () => {
    const result = sanitizePlainText('<script>alert("xss")</script>')
    expect(result).not.toContain("<script")
  })

  it("strips img tags with onerror", () => {
    const result = sanitizePlainText('<img onerror="alert(1)" src="x">')
    expect(result).not.toContain("onerror")
    expect(result).not.toContain("<img")
  })

  it("truncates to maxLength", () => {
    expect(sanitizePlainText("hello world", 5)).toBe("hello")
  })

  it("does not truncate when under maxLength", () => {
    expect(sanitizePlainText("hi", 10)).toBe("hi")
  })
})

describe("sanitizeOptionalPlainText", () => {
  it("returns null for empty string", () => {
    expect(sanitizeOptionalPlainText("")).toBeNull()
  })

  it("returns null for null", () => {
    expect(sanitizeOptionalPlainText(null)).toBeNull()
  })

  it("returns stripped text for valid input", () => {
    expect(sanitizeOptionalPlainText("<b>text</b>")).toBe("text")
  })

  it("respects maxLength", () => {
    expect(sanitizeOptionalPlainText("hello world", 5)).toBe("hello")
  })
})
