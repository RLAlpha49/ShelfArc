import { describe, expect, it } from "bun:test"

import {
  isNonNegativeFinite,
  isNonNegativeInteger,
  isPositiveInteger,
  isValidAmazonUrl,
  isValidCurrencyCode,
  isValidHttpsUrl,
  isValidOwnershipStatus,
  isValidReadingStatus,
  isValidSeriesStatus,
  isValidTitleType,
  isValidUrl,
  isValidUsername,
  isValidUUID,
  isValidVolumeEdition,
  isValidVolumeFormat,
  OWNERSHIP_STATUSES,
  READING_STATUSES,
  SERIES_STATUSES,
  TITLE_TYPES,
  validateProfileFields,
  VOLUME_EDITIONS,
  VOLUME_FORMATS
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

  it("isValidTitleType accepts TITLE_TYPES values and rejects others", () => {
    for (const v of TITLE_TYPES) {
      expect(isValidTitleType(v)).toBe(true)
    }
    expect(isValidTitleType("comic")).toBe(false)
    expect(isValidTitleType(42)).toBe(false)
    expect(isValidTitleType(null)).toBe(false)
  })

  it("isValidOwnershipStatus accepts OWNERSHIP_STATUSES values and rejects others", () => {
    for (const v of OWNERSHIP_STATUSES) {
      expect(isValidOwnershipStatus(v)).toBe(true)
    }
    expect(isValidOwnershipStatus("borrowed")).toBe(false)
    expect(isValidOwnershipStatus(null)).toBe(false)
  })

  it("isValidReadingStatus accepts READING_STATUSES values and rejects others", () => {
    for (const v of READING_STATUSES) {
      expect(isValidReadingStatus(v)).toBe(true)
    }
    expect(isValidReadingStatus("paused")).toBe(false)
    expect(isValidReadingStatus(undefined)).toBe(false)
  })

  it("isValidSeriesStatus accepts SERIES_STATUSES values and rejects others", () => {
    for (const v of SERIES_STATUSES) {
      expect(isValidSeriesStatus(v)).toBe(true)
    }
    expect(isValidSeriesStatus("abandoned")).toBe(false)
    expect(isValidSeriesStatus(0)).toBe(false)
  })

  it("isValidVolumeEdition accepts VOLUME_EDITIONS values and rejects others", () => {
    for (const v of VOLUME_EDITIONS) {
      expect(isValidVolumeEdition(v)).toBe(true)
    }
    expect(isValidVolumeEdition("special")).toBe(false)
    expect(isValidVolumeEdition(null)).toBe(false)
  })

  it("isValidVolumeFormat accepts VOLUME_FORMATS values and rejects others", () => {
    for (const v of VOLUME_FORMATS) {
      expect(isValidVolumeFormat(v)).toBe(true)
    }
    expect(isValidVolumeFormat("ebook")).toBe(false)
    expect(isValidVolumeFormat(undefined)).toBe(false)
  })

  it("isValidHttpsUrl accepts well-formed https URLs", () => {
    expect(isValidHttpsUrl("https://example.com")).toBe(true)
    expect(isValidHttpsUrl("https://sub.example.co.uk/path?q=1")).toBe(true)
  })

  it("isValidHttpsUrl rejects non-https or malformed URLs", () => {
    expect(isValidHttpsUrl("http://example.com")).toBe(false)
    expect(isValidHttpsUrl("ftp://example.com")).toBe(false)
    expect(isValidHttpsUrl("not-a-url")).toBe(false)
    expect(isValidHttpsUrl(42)).toBe(false)
    expect(isValidHttpsUrl(null)).toBe(false)
  })

  it("isValidAmazonUrl accepts known Amazon domains over https", () => {
    expect(isValidAmazonUrl("https://www.amazon.com/dp/B001")).toBe(true)
    expect(isValidAmazonUrl("https://amazon.co.jp/dp/123")).toBe(true)
    expect(isValidAmazonUrl("https://www.amazon.co.uk/gp/product/B002")).toBe(
      true
    )
  })

  it("isValidAmazonUrl rejects non-Amazon or non-https URLs", () => {
    expect(isValidAmazonUrl("https://www.ebay.com/itm/123")).toBe(false)
    expect(isValidAmazonUrl("http://amazon.com/dp/B001")).toBe(false) // http
    expect(isValidAmazonUrl("not-a-url")).toBe(false)
    expect(isValidAmazonUrl(null)).toBe(false)
  })

  it("isValidUUID accepts valid UUIDs", () => {
    expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true)
    expect(isValidUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true)
    // accepts uppercase too
    expect(isValidUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true)
  })

  it("isValidUUID rejects invalid UUIDs", () => {
    expect(isValidUUID("not-a-uuid")).toBe(false)
    expect(isValidUUID("550e8400e29b41d4a716446655440000")).toBe(false) // no dashes
    expect(isValidUUID("")).toBe(false)
    expect(isValidUUID(null)).toBe(false)
  })

  describe("validateProfileFields", () => {
    const userId = "user-abc-123"

    it("returns null when both fields are undefined (no-op update)", () => {
      expect(validateProfileFields({}, userId)).toBeNull()
    })

    it("returns null when fields are null", () => {
      expect(
        validateProfileFields({ username: null, avatarUrl: null }, userId)
      ).toBeNull()
    })

    it("returns null for a valid username", () => {
      expect(
        validateProfileFields({ username: "valid_user" }, userId)
      ).toBeNull()
    })

    it("returns error message for an invalid username", () => {
      expect(validateProfileFields({ username: "ab" }, userId)).toBe(
        "Invalid username format"
      )
      expect(validateProfileFields({ username: "has-dashes" }, userId)).toBe(
        "Invalid username format"
      )
    })

    it("returns null for empty avatarUrl string (treated as no update)", () => {
      expect(validateProfileFields({ avatarUrl: "" }, userId)).toBeNull()
    })

    it("accepts a valid https avatarUrl", () => {
      expect(
        validateProfileFields(
          { avatarUrl: "https://example.com/avatar.jpg" },
          userId
        )
      ).toBeNull()
    })

    it("accepts a plain storage path starting with userId", () => {
      expect(
        validateProfileFields({ avatarUrl: `${userId}/avatar.jpg` }, userId)
      ).toBeNull()
    })

    it("accepts a storage:-prefixed path belonging to userId", () => {
      expect(
        validateProfileFields(
          { avatarUrl: `storage:${userId}/avatar.jpg` },
          userId
        )
      ).toBeNull()
    })

    it("rejects an https URL from a different user's storage bucket path", () => {
      // Plain path that doesn't start with userId
      const result = validateProfileFields(
        { avatarUrl: "other-user/avatar.jpg" },
        userId
      )
      expect(result).toBe("avatarUrl must be a valid HTTPS URL")
    })

    it("rejects an http (non-https) avatarUrl", () => {
      const result = validateProfileFields(
        { avatarUrl: "http://example.com/avatar.jpg" },
        userId
      )
      expect(result).toBe("avatarUrl must be a valid HTTPS URL")
    })
  })
})
