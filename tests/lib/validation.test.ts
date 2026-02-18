import { describe, expect, it } from "bun:test"

import {
  isNonNegativeFinite,
  isNonNegativeInteger,
  isPositiveInteger,
  isValidCurrencyCode,
  isValidUrl,
  isValidUsername
} from "@/lib/validation"

describe("lib/validation", () => {
  it("validates usernames", () => {
    expect(isValidUsername("abc")).toBe(true)
    expect(isValidUsername("user_name123")).toBe(true)
    expect(isValidUsername("ab")).toBe(false)
    expect(isValidUsername("user-name")).toBe(false)
    expect(isValidUsername("a".repeat(21))).toBe(false)
  })

  it("validates URLs (http/https)", () => {
    expect(isValidUrl("https://example.com")).toBe(true)
    expect(isValidUrl("http://example.com")).toBe(true)
    expect(isValidUrl("javascript:alert(1)")).toBe(false)
    expect(isValidUrl("ftp://example.com")).toBe(false)
  })

  it("validates numeric guards", () => {
    expect(isPositiveInteger(1)).toBe(true)
    expect(isPositiveInteger(0)).toBe(false)
    expect(isPositiveInteger(1.2)).toBe(false)

    expect(isNonNegativeInteger(0)).toBe(true)
    expect(isNonNegativeInteger(-1)).toBe(false)

    expect(isNonNegativeFinite(0)).toBe(true)
    expect(isNonNegativeFinite(Number.NaN)).toBe(false)
    expect(isNonNegativeFinite(Number.POSITIVE_INFINITY)).toBe(false)
  })

  it("validates currency codes", () => {
    expect(isValidCurrencyCode("USD")).toBe(true)
    expect(isValidCurrencyCode("EUR")).toBe(true)
    expect(isValidCurrencyCode("JPY")).toBe(true)
    expect(isValidCurrencyCode("usd")).toBe(false)
    expect(isValidCurrencyCode("US")).toBe(false)
    expect(isValidCurrencyCode("USDD")).toBe(false)
    expect(isValidCurrencyCode("")).toBe(false)
    expect(isValidCurrencyCode("U$D")).toBe(false)
    expect(isValidCurrencyCode(123)).toBe(false)
    expect(isValidCurrencyCode(null)).toBe(false)
  })
})
