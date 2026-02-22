import { describe, expect, it } from "bun:test"

import {
  checkPasswordStrength,
  validatePassword
} from "@/lib/auth/validate-password"

describe("validatePassword", () => {
  it("rejects empty password", () => {
    expect(validatePassword("")).not.toBeNull()
  })

  it("rejects passwords shorter than 8 characters", () => {
    expect(validatePassword("Abc1234")).not.toBeNull()
  })

  it("rejects passwords longer than 128 characters", () => {
    const longPwd = "Aa1" + "x".repeat(126)
    expect(validatePassword(longPwd)).not.toBeNull()
  })

  it("rejects passwords without lowercase", () => {
    expect(validatePassword("ABCDEFG1")).not.toBeNull()
  })

  it("rejects passwords without uppercase", () => {
    expect(validatePassword("abcdefg1")).not.toBeNull()
  })

  it("rejects passwords without a number", () => {
    expect(validatePassword("Abcdefgh")).not.toBeNull()
  })

  it("accepts valid passwords", () => {
    expect(validatePassword("Abcdefg1")).toBeNull()
  })

  it("accepts passwords with special characters", () => {
    expect(validatePassword("P@ssw0rd!")).toBeNull()
  })

  it("accepts passwords at exactly 8 characters", () => {
    expect(validatePassword("Abcdef1x")).toBeNull()
  })

  it("accepts passwords at exactly 128 characters", () => {
    const pwd = "Aa1" + "x".repeat(125)
    expect(validatePassword(pwd)).toBeNull()
  })
})

describe("checkPasswordStrength", () => {
  it("rejects very weak passwords (score 0)", () => {
    expect(checkPasswordStrength("password")).not.toBeNull()
  })

  it("rejects common dictionary-based passwords (score 1)", () => {
    expect(checkPasswordStrength("qwerty123")).not.toBeNull()
  })

  it("accepts adequately strong passwords (score >= 2)", () => {
    // Uncommon phrase with mixed case, number, and special char
    expect(checkPasswordStrength("Tr0ub4dor&3")).toBeNull()
  })

  it("accepts high-entropy passwords", () => {
    expect(checkPasswordStrength("correct horse battery staple")).toBeNull()
  })

  it("returns a string message for weak passwords", () => {
    const result = checkPasswordStrength("123456")
    expect(typeof result).toBe("string")
    expect((result ?? "").length).toBeGreaterThan(0)
  })
})
