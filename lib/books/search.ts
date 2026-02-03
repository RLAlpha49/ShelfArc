export type BookSearchSource = "google_books" | "open_library"

export interface BookSearchResult {
  id: string
  title: string
  authors: string[]
  publisher: string | null
  publishedDate: string | null
  description: string | null
  isbn: string | null
  coverUrl: string | null
  seriesTitle: string | null
  source: BookSearchSource
}

const ensureHttps = (url: string) => url.replace(/^http:/, "https:")

export const normalizeIsbn = (value: string) =>
  value.replaceAll(/[^0-9X]/gi, "")

export const isIsbnQuery = (query: string) => {
  const normalized = normalizeIsbn(query)
  return normalized.length === 10 || normalized.length === 13
}

const pickIsbnFromIdentifiers = (
  identifiers?: Array<{ type?: string; identifier?: string }>
) => {
  if (!identifiers || identifiers.length === 0) return null
  const isbn13 = identifiers.find((id) => id.type === "ISBN_13")?.identifier
  const isbn10 = identifiers.find((id) => id.type === "ISBN_10")?.identifier
  return isbn13 ?? isbn10 ?? identifiers[0]?.identifier ?? null
}

const pickIsbnFromList = (isbns?: string[]) => {
  if (!isbns || isbns.length === 0) return null
  const isbn13 = isbns.find((isbn) => normalizeIsbn(isbn).length === 13)
  const isbn10 = isbns.find((isbn) => normalizeIsbn(isbn).length === 10)
  return isbn13 ?? isbn10 ?? isbns[0] ?? null
}

export const normalizeGoogleBooksItems = (
  items: unknown[]
): BookSearchResult[] => {
  return items.flatMap((item, index) => {
    const volumeInfo = (item as { volumeInfo?: Record<string, unknown> })
      ?.volumeInfo
    const title = volumeInfo?.title as string | undefined

    if (!title) return []

    const authors = (volumeInfo?.authors as string[] | undefined) ?? []
    const coverUrl =
      (volumeInfo?.imageLinks as { thumbnail?: string; smallThumbnail?: string })
        ?.thumbnail ||
      (volumeInfo?.imageLinks as { thumbnail?: string; smallThumbnail?: string })
        ?.smallThumbnail ||
      null

    return [
      {
        id: ((item as { id?: string })?.id ?? `google-${index}`),
        title,
        authors,
        publisher: (volumeInfo?.publisher as string | undefined) ?? null,
        publishedDate: (volumeInfo?.publishedDate as string | undefined) ?? null,
        description: (volumeInfo?.description as string | undefined) ?? null,
        isbn:
          pickIsbnFromIdentifiers(
            volumeInfo?.industryIdentifiers as Array<{
              type?: string
              identifier?: string
            }>
          ) ?? null,
        coverUrl: coverUrl ? ensureHttps(coverUrl) : null,
        seriesTitle: Array.isArray(volumeInfo?.series)
          ? ((volumeInfo?.series as string[])[0] ?? null)
          : null,
        source: "google_books"
      }
    ]
  })
}

export const normalizeOpenLibraryDocs = (
  docs: unknown[]
): BookSearchResult[] => {
  return docs.flatMap((doc, index) => {
    const title = (doc as { title?: string })?.title
    if (!title) return []

    const isbn = pickIsbnFromList((doc as { isbn?: string[] })?.isbn)
    const coverId = (doc as { cover_i?: number })?.cover_i
    const coverUrl = coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : null

    return [
      {
        id: ((doc as { key?: string })?.key ?? isbn ?? `open-${index}`),
        title,
        authors: (doc as { author_name?: string[] })?.author_name ?? [],
        publisher:
          (doc as { publisher?: string[] })?.publisher?.[0] ?? null,
        publishedDate: (doc as { first_publish_year?: number })
          ?.first_publish_year
          ? String(
              (doc as { first_publish_year?: number }).first_publish_year
            )
          : null,
        description: null,
        isbn,
        coverUrl,
        seriesTitle: Array.isArray((doc as { series?: string[] })?.series)
          ? ((doc as { series?: string[] }).series?.[0] ?? null)
          : null,
        source: "open_library"
      }
    ]
  })
}
