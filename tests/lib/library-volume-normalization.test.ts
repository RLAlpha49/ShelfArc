import { describe, expect, it } from "bun:test"

import {
  extractVolumeNumberFromTitle,
  normalizeAuthorKey,
  normalizeLibraryText,
  normalizeSeriesTitle,
  stripVolumeFromTitle
} from "@/lib/library/volume-normalization"

describe("lib/library/volume-normalization", () => {
  // ---------------------------------------------------------------------------
  // normalizeLibraryText
  // ---------------------------------------------------------------------------
  describe("normalizeLibraryText", () => {
    it("returns empty string for null", () => {
      expect(normalizeLibraryText(null)).toBe("")
    })

    it("returns empty string when called without arguments", () => {
      expect(normalizeLibraryText()).toBe("")
    })

    it("returns empty string for empty string", () => {
      expect(normalizeLibraryText("")).toBe("")
    })

    it("returns empty string for whitespace-only string", () => {
      expect(normalizeLibraryText("   ")).toBe("")
    })

    it("lowercases ASCII text", () => {
      expect(normalizeLibraryText("HELLO WORLD")).toBe("hello world")
    })

    it("trims leading and trailing whitespace", () => {
      expect(normalizeLibraryText("  hello  ")).toBe("hello")
    })

    it("collapses interior whitespace to a single space", () => {
      expect(normalizeLibraryText("the  quick   brown  fox")).toBe(
        "the quick brown fox"
      )
    })

    it("strips combining diacritics (acute, grave, umlaut, cedilla)", () => {
      expect(normalizeLibraryText("Café")).toBe("cafe")
      expect(normalizeLibraryText("naïve")).toBe("naive")
      expect(normalizeLibraryText("façade")).toBe("facade")
      expect(normalizeLibraryText("résumé")).toBe("resume")
      expect(normalizeLibraryText("Ångström")).toBe("angstrom")
    })

    it("preserves non-decomposable ligatures after NFKD + diacritic strip", () => {
      // 'œ' (U+0153) has no canonical decomposition — survives normalization
      expect(normalizeLibraryText("Dœ")).toBe("dœ")
    })

    it("handles already-normalized ASCII input unchanged", () => {
      expect(normalizeLibraryText("my series")).toBe("my series")
    })
  })

  // ---------------------------------------------------------------------------
  // normalizeAuthorKey
  // ---------------------------------------------------------------------------
  describe("normalizeAuthorKey", () => {
    it("returns empty string for null", () => {
      expect(normalizeAuthorKey(null)).toBe("")
    })

    it("returns empty string when called without arguments", () => {
      expect(normalizeAuthorKey()).toBe("")
    })

    it("returns empty string for empty string", () => {
      expect(normalizeAuthorKey("")).toBe("")
    })

    it("removes spaces between name parts", () => {
      expect(normalizeAuthorKey("John Doe")).toBe("johndoe")
    })

    it("strips diacritics and spaces (existing regression)", () => {
      expect(normalizeAuthorKey("Jöhn Dœ")).toBe("johndœ")
    })

    it("removes periods (initials)", () => {
      expect(normalizeAuthorKey("J.K. Rowling")).toBe("jkrowling")
    })

    it("removes apostrophes", () => {
      expect(normalizeAuthorKey("O'Brien")).toBe("obrien")
    })

    it("removes hyphens in hyphenated names", () => {
      expect(normalizeAuthorKey("Mary-Jane Watson")).toBe("maryjanewatson")
    })

    it("strips diacritics and punctuation from accented names", () => {
      expect(normalizeAuthorKey("García Márquez")).toBe("garciamarquez")
    })

    it("preserves digits in names", () => {
      expect(normalizeAuthorKey("Author2")).toBe("author2")
    })
  })

  // ---------------------------------------------------------------------------
  // extractVolumeNumberFromTitle
  // ---------------------------------------------------------------------------
  describe("extractVolumeNumberFromTitle", () => {
    describe("null / empty input", () => {
      it("returns null for null", () => {
        expect(extractVolumeNumberFromTitle(null)).toBeNull()
      })

      it("returns null when called without arguments", () => {
        expect(extractVolumeNumberFromTitle()).toBeNull()
      })

      it("returns null for empty string", () => {
        expect(extractVolumeNumberFromTitle("")).toBeNull()
      })

      it("returns null for whitespace-only string", () => {
        expect(extractVolumeNumberFromTitle("   ")).toBeNull()
      })
    })

    describe("explicit volume tokens", () => {
      it("extracts 'Vol. N'", () => {
        expect(extractVolumeNumberFromTitle("My Series Vol. 3")).toBe(3)
      })

      it("extracts 'Volume N'", () => {
        expect(extractVolumeNumberFromTitle("My Series Volume 12")).toBe(12)
      })

      it("extracts 'Book N'", () => {
        expect(extractVolumeNumberFromTitle("My Series Book 5")).toBe(5)
      })

      it("extracts 'Part N'", () => {
        expect(extractVolumeNumberFromTitle("My Series Part 2")).toBe(2)
      })

      it("extracts 'No. N'", () => {
        expect(extractVolumeNumberFromTitle("My Series No. 7")).toBe(7)
      })

      it("extracts 'No N' (without dot)", () => {
        expect(extractVolumeNumberFromTitle("My Series No 7")).toBe(7)
      })

      it("is case-insensitive for volume tokens", () => {
        expect(extractVolumeNumberFromTitle("My Series VOL. 3")).toBe(3)
        expect(extractVolumeNumberFromTitle("My Series VOLUME 12")).toBe(12)
        expect(extractVolumeNumberFromTitle("My Series BOOK 5")).toBe(5)
      })

      it("extracts decimal volume numbers", () => {
        expect(extractVolumeNumberFromTitle("My Series Vol. 2.5")).toBe(2.5)
        expect(extractVolumeNumberFromTitle("Dragon Ball Vol. 0.5")).toBe(0.5)
      })

      it("extracts volume 0", () => {
        expect(extractVolumeNumberFromTitle("My Series Vol. 0")).toBe(0)
      })

      it("extracts large volume numbers within limit", () => {
        expect(extractVolumeNumberFromTitle("My Series Vol. 200")).toBe(200)
      })
    })

    describe("English number-word tokens", () => {
      it("extracts single-digit word ('three')", () => {
        expect(extractVolumeNumberFromTitle("My Series Vol three")).toBe(3)
      })

      it("extracts teen word ('twelve')", () => {
        expect(extractVolumeNumberFromTitle("My Series Book twelve")).toBe(12)
      })

      it("extracts compound word ('twenty-one')", () => {
        expect(
          extractVolumeNumberFromTitle("My Series Volume twenty-one")
        ).toBe(21)
      })

      it("extracts tens word ('forty')", () => {
        expect(extractVolumeNumberFromTitle("My Series Part forty")).toBe(40)
      })

      it("is case-insensitive for word tokens", () => {
        expect(extractVolumeNumberFromTitle("My Series Vol THREE")).toBe(3)
      })
    })

    describe("inline suffix (number before parenthetical or colon)", () => {
      it("extracts number before parenthetical for multi-word prefix", () => {
        expect(
          extractVolumeNumberFromTitle("My Series 4 (Collector's Edition)")
        ).toBe(4)
      })

      it("extracts number before colon for multi-word prefix", () => {
        expect(
          extractVolumeNumberFromTitle("My Series 4: Adventure Awaits")
        ).toBe(4)
      })
    })

    describe("trailing suffix (final number in title)", () => {
      it("extracts trailing number for two-word prefix", () => {
        expect(extractVolumeNumberFromTitle("My Series 4")).toBe(4)
      })

      it("extracts small trailing number (≤ 3) for two-word prefix", () => {
        expect(extractVolumeNumberFromTitle("My Series 2")).toBe(2)
        expect(extractVolumeNumberFromTitle("My Series 1")).toBe(1)
      })

      it("extracts trailing number for three-or-more-word prefix", () => {
        expect(extractVolumeNumberFromTitle("My Long Series 4")).toBe(4)
      })

      it("returns null for single-word prefix with trailing number", () => {
        expect(extractVolumeNumberFromTitle("Naruto 2")).toBeNull()
        expect(extractVolumeNumberFromTitle("Dragon 4")).toBeNull()
        expect(extractVolumeNumberFromTitle("Bleach 100")).toBeNull()
      })
    })

    describe("year / range guards", () => {
      it("returns null for year-like trailing number (1900–2100)", () => {
        expect(extractVolumeNumberFromTitle("My Series 1999")).toBeNull()
        expect(extractVolumeNumberFromTitle("My Series 2024")).toBeNull()
        expect(extractVolumeNumberFromTitle("My Series 1900")).toBeNull()
        expect(extractVolumeNumberFromTitle("My Series 2100")).toBeNull()
      })

      it("returns null for trailing number above MAX_VOLUME_NUMBER (200)", () => {
        expect(extractVolumeNumberFromTitle("My Series 201")).toBeNull()
        expect(extractVolumeNumberFromTitle("My Series 500")).toBeNull()
      })
    })

    describe("no volume information", () => {
      it("returns null when title has no volume info", () => {
        expect(extractVolumeNumberFromTitle("The Great Gatsby")).toBeNull()
      })

      it("returns null for a plain series name", () => {
        expect(extractVolumeNumberFromTitle("My Favourite Series")).toBeNull()
      })
    })
  })

  // ---------------------------------------------------------------------------
  // stripVolumeFromTitle
  // ---------------------------------------------------------------------------
  describe("stripVolumeFromTitle", () => {
    describe("explicit volume tokens", () => {
      it("strips 'Vol. N'", () => {
        expect(stripVolumeFromTitle("My Series Vol. 3")).toBe("My Series")
      })

      it("strips 'Volume N'", () => {
        expect(stripVolumeFromTitle("My Series Volume 12")).toBe("My Series")
      })

      it("strips 'Book N'", () => {
        expect(stripVolumeFromTitle("My Series Book 2")).toBe("My Series")
      })

      it("strips 'Part N'", () => {
        expect(stripVolumeFromTitle("My Series Part 3")).toBe("My Series")
      })

      it("strips 'No. N'", () => {
        expect(stripVolumeFromTitle("My Series No. 4")).toBe("My Series")
      })

      it("strips decimal volume", () => {
        expect(stripVolumeFromTitle("My Series Vol. 2.5")).toBe("My Series")
      })

      it("strips English word volume token", () => {
        expect(stripVolumeFromTitle("My Series Volume three")).toBe("My Series")
      })
    })

    describe("subtitle stripping", () => {
      it("strips subtitle after volume indicator separated by colon", () => {
        expect(stripVolumeFromTitle("My Series Vol. 3: The Battle")).toBe(
          "My Series"
        )
      })

      it("strips subtitle after volume indicator separated by en-dash", () => {
        expect(stripVolumeFromTitle("My Series Vol. 3 – The Battle")).toBe(
          "My Series"
        )
      })
    })

    describe("bracket / parenthetical descriptor stripping", () => {
      it("strips trailing manga bracket descriptor", () => {
        expect(stripVolumeFromTitle("My Series (Manga) Vol. 1")).toBe(
          "My Series"
        )
      })

      it("strips trailing GN bracket descriptor", () => {
        expect(stripVolumeFromTitle("My Series Vol. 1 (GN)")).toBe("My Series")
      })

      it("strips consecutive volume and bracket descriptors", () => {
        expect(stripVolumeFromTitle("My Series Vol. 3 (Light Novel)")).toBe(
          "My Series"
        )
      })
    })

    describe("format suffix stripping", () => {
      it("strips trailing 'Manga'", () => {
        expect(stripVolumeFromTitle("My Series Manga")).toBe("My Series")
      })

      it("strips trailing 'Light Novel'", () => {
        expect(stripVolumeFromTitle("My Series Light Novel")).toBe("My Series")
      })

      it("strips trailing 'Graphic Novel'", () => {
        expect(stripVolumeFromTitle("My Series Graphic Novel")).toBe(
          "My Series"
        )
      })

      it("strips format suffix combined with volume", () => {
        expect(stripVolumeFromTitle("My Series Light Novel Vol. 3")).toBe(
          "My Series"
        )
      })
    })

    describe("extra descriptor stripping", () => {
      it("strips 'Omnibus'", () => {
        expect(stripVolumeFromTitle("My Series Omnibus")).toBe("My Series")
      })

      it("strips 'Deluxe Edition'", () => {
        expect(stripVolumeFromTitle("My Series Deluxe Edition")).toBe(
          "My Series"
        )
      })

      it("strips 'Complete'", () => {
        expect(stripVolumeFromTitle("My Series Complete")).toBe("My Series")
      })
    })

    describe("trailing number suffix", () => {
      it("strips trailing number for multi-word prefix", () => {
        expect(stripVolumeFromTitle("My Two Words 4")).toBe("My Two Words")
      })

      it("strips small trailing number (≤ 3) for multi-word prefix", () => {
        expect(stripVolumeFromTitle("My Series 2")).toBe("My Series")
      })

      it("does NOT strip trailing number for single-word prefix", () => {
        expect(stripVolumeFromTitle("Naruto 4")).toBe("Naruto 4")
      })

      it("does NOT strip year-like trailing number", () => {
        expect(stripVolumeFromTitle("Events of 2024")).toBe("Events of 2024")
        expect(stripVolumeFromTitle("My Series 1999")).toBe("My Series 1999")
      })

      it("does NOT strip trailing number above MAX_VOLUME_NUMBER (200)", () => {
        expect(stripVolumeFromTitle("My Series 201")).toBe("My Series 201")
      })
    })

    describe("edge cases", () => {
      it("returns title unchanged when no volume info is present", () => {
        expect(stripVolumeFromTitle("My Series")).toBe("My Series")
      })

      it("falls back to original title when stripping would result in empty string", () => {
        expect(stripVolumeFromTitle("Vol. 3")).toBe("Vol. 3")
      })

      it("collapses extra whitespace in the result", () => {
        // The function collapses all internal whitespace in the final pass
        expect(stripVolumeFromTitle("My  Series  Vol.  3")).toBe("My Series")
      })
    })
  })

  // ---------------------------------------------------------------------------
  // normalizeSeriesTitle
  // ---------------------------------------------------------------------------
  describe("normalizeSeriesTitle", () => {
    it("returns empty string for empty input", () => {
      expect(normalizeSeriesTitle("")).toBe("")
    })

    describe("volume token stripping and lowercasing", () => {
      it("strips 'Vol. N' and lowercases", () => {
        expect(normalizeSeriesTitle("My Series Vol. 3")).toBe("my series")
      })

      it("strips 'Volume N' and lowercases", () => {
        expect(normalizeSeriesTitle("My Series Volume 12")).toBe("my series")
      })

      it("strips English word volume token", () => {
        expect(
          normalizeSeriesTitle("My Amazing Series Volume twenty-one")
        ).toBe("my amazing series")
      })

      it("strips subtitle following volume indicator", () => {
        expect(normalizeSeriesTitle("My Series Vol. 3: The Battle")).toBe(
          "my series"
        )
      })
    })

    describe("bracket and format stripping", () => {
      it("strips manga bracket descriptor", () => {
        expect(normalizeSeriesTitle("My Series (Manga) Vol. 1")).toBe(
          "my series"
        )
      })

      it("strips trailing format suffix — manga", () => {
        expect(normalizeSeriesTitle("My Series Manga")).toBe("my series")
      })

      it("strips trailing format suffix — light novel", () => {
        expect(normalizeSeriesTitle("My Series Light Novel")).toBe("my series")
      })

      it("strips parenthetical content from key", () => {
        expect(normalizeSeriesTitle("My Series (Special Edition)")).toBe(
          "my series"
        )
      })
    })

    describe("diacritic and special character handling", () => {
      it("strips diacritics", () => {
        expect(normalizeSeriesTitle("Café Vol. 1")).toBe("cafe")
        expect(normalizeSeriesTitle("Naïve Heroes Vol. 2")).toBe("naive heroes")
      })

      it("removes non-letter/non-digit characters from key", () => {
        expect(normalizeSeriesTitle("My Series!!! Vol. 3")).toBe("my series")
      })

      it("collapses interior whitespace", () => {
        expect(normalizeSeriesTitle("  My   Series  Vol. 3  ")).toBe(
          "my series"
        )
      })
    })

    describe("trailing number stripping for key derivation", () => {
      it("strips trailing volume number from multi-word series key", () => {
        expect(normalizeSeriesTitle("My Series 2")).toBe("my series")
      })

      it("preserves trailing number on single-word series (cannot disambiguate)", () => {
        expect(normalizeSeriesTitle("Naruto 2")).toBe("naruto 2")
      })

      it("preserves year-like trailing number", () => {
        expect(normalizeSeriesTitle("My Series 1999")).toBe("my series 1999")
      })
    })

    describe("stable key across volumes", () => {
      it("produces the same key for different volumes of the same series", () => {
        expect(normalizeSeriesTitle("My Series Vol. 1")).toBe(
          normalizeSeriesTitle("My Series Vol. 2")
        )
      })

      it("produces the same key regardless of format suffix presence", () => {
        expect(normalizeSeriesTitle("My Series Manga Vol. 1")).toBe(
          normalizeSeriesTitle("My Series Vol. 2")
        )
      })

      it("produces the same key regardless of subtitle", () => {
        expect(normalizeSeriesTitle("My Series Vol. 1: Origin Story")).toBe(
          normalizeSeriesTitle("My Series Vol. 2: Turning Point")
        )
      })
    })
  })
})
