import { describe, expect, it } from "bun:test"

import { validatePassword } from "@/lib/auth/validate-password"

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
