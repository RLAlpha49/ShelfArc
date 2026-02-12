import { describe, expect, it } from "bun:test"
import {
  extractVolumeNumberFromTitle,
  normalizeAuthorKey,
  normalizeSeriesTitle,
  stripVolumeFromTitle
} from "@/lib/library/volume-normalization"

describe("lib/library/volume-normalization", () => {
  it("extracts explicit volume numbers", () => {
    expect(extractVolumeNumberFromTitle("My Series Vol. 3")).toBe(3)
    expect(extractVolumeNumberFromTitle("My Series Volume 12")).toBe(12)
    expect(extractVolumeNumberFromTitle("My Series Vol three")).toBe(3)
  })

  it("does not treat ambiguous trailing numbers as volume", () => {
    // single-word prefixes are intentionally ignored for trailing suffix parsing
    expect(extractVolumeNumberFromTitle("Naruto 2")).toBeNull()
    // years are intentionally ignored
    expect(extractVolumeNumberFromTitle("My Series 1999")).toBeNull()
  })

  it("strips volume and descriptors for display", () => {
    expect(stripVolumeFromTitle("My Series Vol. 3: The Battle")).toBe(
      "My Series"
    )
    expect(stripVolumeFromTitle("My Series (Manga) Vol. 1")).toBe("My Series")
  })

  it("builds stable normalized keys", () => {
    expect(normalizeAuthorKey("Jöhn Dœ")).toBe("johndœ")
    expect(normalizeSeriesTitle("My Series Vol. 3: The Battle")).toBe(
      "my series"
    )
  })
})
