import { describe, expect, it } from "bun:test"

import {
  isIsbnQuery,
  normalizeBookKey,
  normalizeGoogleBooksItems,
  normalizeOpenLibraryDocs
} from "@/lib/books/search"

describe("lib/books/search normalizers", () => {
  it("builds stable dedupe keys", () => {
    expect(normalizeBookKey("Café: The Book!", "Jöhn Dœ")).toBe(
      "cafe the book|john dœ"
    )
    expect(normalizeBookKey("   ", "Someone")).toBeNull()
  })

  it("detects ISBN queries", () => {
    expect(isIsbnQuery("978-0-306-40615-7")).toBe(true)
    expect(isIsbnQuery("not-an-isbn")).toBe(false)
  })

  it("normalizes Google Books results", () => {
    const results = normalizeGoogleBooksItems([
      {
        id: "abc",
        volumeInfo: {
          title: "My Book",
          authors: ["Author"],
          publisher: "Pub",
          publishedDate: "2020",
          pageCount: 123,
          description: "Desc",
          industryIdentifiers: [
            { type: "ISBN_13", identifier: "9780306406157" }
          ],
          imageLinks: {
            thumbnail: "http://example.com/img.jpg"
          }
        }
      }
    ])

    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe("abc")
    expect(results[0]?.title).toBe("My Book")
    expect(results[0]?.isbn).toBe("9780306406157")
    expect(results[0]?.coverUrl).toBe("https://example.com/img.jpg")
    expect(results[0]?.source).toBe("google_books")
  })

  it("falls back to Open Library cover when Google image is missing", () => {
    const results = normalizeGoogleBooksItems([
      {
        id: "abc",
        volumeInfo: {
          title: "My Book",
          industryIdentifiers: [
            { type: "ISBN_13", identifier: "9780306406157" }
          ]
        }
      }
    ])

    expect(results).toHaveLength(1)
    expect(results[0]?.coverUrl).toBe(
      "https://covers.openlibrary.org/b/isbn/9780306406157-L.jpg"
    )
  })

  it("normalizes Open Library docs", () => {
    const results = normalizeOpenLibraryDocs([
      {
        key: "/works/OL123",
        title: "My OL Book",
        author_name: ["A"],
        publisher: ["Pub"],
        first_publish_year: 1999,
        isbn: ["0-306-40615-2", "978-0-306-40615-7"],
        cover_i: 42,
        series: ["Series"]
      }
    ])

    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe("/works/OL123")
    expect(results[0]?.isbn).toBe("978-0-306-40615-7")
    expect(results[0]?.coverUrl).toBe(
      "https://covers.openlibrary.org/b/id/42-L.jpg"
    )
    expect(results[0]?.publishedDate).toBe("1999")
    expect(results[0]?.seriesTitle).toBe("Series")
    expect(results[0]?.source).toBe("open_library")
  })
})
