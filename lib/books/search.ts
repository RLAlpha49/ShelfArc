import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"

export type BookSearchSource = "google_books" | "open_library"

export interface BookSearchResult {
  id: string
  title: string
  authors: string[]
  publisher: string | null
  publishedDate: string | null
  pageCount: number | null
  description: string | null
  isbn: string | null
  coverUrl: string | null
  seriesTitle: string | null
  source: BookSearchSource
}

const normalizeBookText = (value?: string | null) => {
  return (value ?? "")
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, " ")
}

export const normalizeBookKey = (
  title?: string | null,
  author?: string | null
) => {
  const normalizedTitle = normalizeBookText(title)
  if (!normalizedTitle) return null
  const normalizedAuthor = normalizeBookText(author)
  return `${normalizedTitle}|${normalizedAuthor}`
}

const ensureHttps = (url: string) => url.replace(/^http:/, "https:")

export const isIsbnQuery = (query: string) => {
  return isValidIsbn(query)
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
    const imageLinks = volumeInfo?.imageLinks as {
      extraLarge?: string
      large?: string
      medium?: string
      small?: string
      thumbnail?: string
      smallThumbnail?: string
    }
    const rawPageCount = volumeInfo?.pageCount
    const pageCount =
      typeof rawPageCount === "number" && Number.isFinite(rawPageCount)
        ? rawPageCount
        : null
    const isbn =
      pickIsbnFromIdentifiers(
        volumeInfo?.industryIdentifiers as Array<{
          type?: string
          identifier?: string
        }>
      ) ?? null
    const normalizedIsbn =
      isbn && isValidIsbn(isbn) ? normalizeIsbn(isbn) : null
    const openLibraryCoverUrl = normalizedIsbn
      ? `https://covers.openlibrary.org/b/isbn/${normalizedIsbn}-L.jpg`
      : null
    const coverUrl =
      imageLinks?.extraLarge ||
      imageLinks?.large ||
      imageLinks?.medium ||
      imageLinks?.small ||
      imageLinks?.thumbnail ||
      imageLinks?.smallThumbnail ||
      openLibraryCoverUrl ||
      null

    return [
      {
        id: (item as { id?: string })?.id ?? `google-${index}`,
        title,
        authors,
        publisher: (volumeInfo?.publisher as string | undefined) ?? null,
        publishedDate:
          (volumeInfo?.publishedDate as string | undefined) ?? null,
        pageCount,
        description: (volumeInfo?.description as string | undefined) ?? null,
        isbn,
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
    const firstPublishYear = (doc as { first_publish_year?: number })
      ?.first_publish_year

    return [
      {
        id: (doc as { key?: string })?.key ?? isbn ?? `open-${index}`,
        title,
        authors: (doc as { author_name?: string[] })?.author_name ?? [],
        publisher: (doc as { publisher?: string[] })?.publisher?.[0] ?? null,
        publishedDate: firstPublishYear ? String(firstPublishYear) : null,
        pageCount: null,
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
