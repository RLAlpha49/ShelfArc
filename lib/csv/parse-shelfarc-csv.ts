/**
 * Parser and detector for ShelfArc full-metadata CSV exports.
 *
 * A ShelfArc export CSV contains 18 columns per volume row:
 * Series Title, Series Type, Author, Publisher, Volume Number, Volume Title,
 * Volume Description, ISBN, Edition, Format, Ownership Status, Reading Status,
 * Page Count, Rating, Publish Date, Purchase Date, Purchase Price, Notes
 * @source
 */
import type { OwnershipStatus, ReadingStatus } from "@/lib/types/database"

/* ─── Detection signature ───────────────────────────────── */

/** Required headers (case-insensitive) that identify a ShelfArc CSV export. @source */
const SHELFARC_REQUIRED_HEADERS = [
  "series title",
  "series type",
  "ownership status",
  "reading status",
  "volume number"
] as const

/* ─── Types ─────────────────────────────────────────────── */

/** A single parsed row from a ShelfArc export CSV. @source */
export interface ShelfArcCsvRow {
  seriesTitle: string
  seriesType: string
  author: string
  publisher: string
  volumeNumber: number
  volumeTitle: string | null
  volumeDescription: string | null
  isbn: string | null
  edition: string | null
  format: string | null
  ownershipStatus: OwnershipStatus
  readingStatus: ReadingStatus
  pageCount: number | null
  rating: number | null
  publishDate: string | null
  purchaseDate: string | null
  purchasePrice: number | null
  notes: string | null
}

/** Aggregate statistics for a ShelfArc CSV import run. @source */
export interface ShelfArcImportStats {
  created: number
  updated: number
  skipped: number
  failed: number
}

/** Conflict resolution strategy when a volume's ISBN already exists in the library. @source */
export type ShelfArcConflictStrategy = "skip" | "overwrite"

/* ─── Valid enum values ─────────────────────────────────── */

const VALID_OWNERSHIP_STATUSES = new Set<OwnershipStatus>(["owned", "wishlist"])
const VALID_READING_STATUSES = new Set<ReadingStatus>([
  "unread",
  "reading",
  "completed",
  "on_hold",
  "dropped"
])

/* ─── CSV Parser ─────────────────────────────────────────── */

/**
 * Reads a quoted CSV field starting at `start` (after the opening quote).
 * @param text - The full CSV text.
 * @param start - Character index after the opening quote.
 * @returns The parsed field value and the next read position.
 */
function readQuotedField(
  text: string,
  start: number
): { value: string; next: number } {
  let field = ""
  let i = start

  while (i < text.length) {
    if (text[i] !== '"') {
      field += text[i]
      i += 1
      continue
    }
    // Escaped quote ""
    if (i + 1 < text.length && text[i + 1] === '"') {
      field += '"'
      i += 2
      continue
    }
    // Closing quote
    return { value: field, next: i + 1 }
  }

  return { value: field, next: i }
}

/**
 * Minimal RFC 4180-compliant CSV parser handling quoted fields and CRLF.
 * @param text - The raw CSV text.
 * @returns A 2D array of row/field strings.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let i = 0

  while (i < text.length) {
    const char = text[i]

    if (char === '"') {
      const quoted = readQuotedField(text, i + 1)
      field += quoted.value
      i = quoted.next
      continue
    }

    if (char === ",") {
      row.push(field)
      field = ""
      i += 1
      continue
    }

    if (char === "\r" || char === "\n") {
      row.push(field)
      field = ""
      rows.push(row)
      row = []
      i += 1
      if (char === "\r" && i < text.length && text[i] === "\n") i += 1
      continue
    }

    field += char
    i += 1
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/* ─── Public API ─────────────────────────────────────────── */

/**
 * Returns true if the given header strings match the ShelfArc export signature.
 * Detection is case-insensitive and requires all five required columns to be present.
 * @param headers - The raw header strings from the CSV first row.
 * @source
 */
export function isShelfArcFormat(headers: string[]): boolean {
  const normalizedHeaders = new Set(headers.map((h) => h.trim().toLowerCase()))
  return SHELFARC_REQUIRED_HEADERS.every((required) =>
    normalizedHeaders.has(required)
  )
}

/* ─── Row parser helpers ─────────────────────────────────── */

function parseIntOrNull(raw: string): number | null {
  if (!raw) return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseFloatOrNull(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replaceAll(/[^0-9.+-]/g, "")
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseDateOrNull(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function makeGetter(
  colIndex: Map<string, number>,
  row: string[]
): (name: string) => string {
  return (name: string): string => {
    const idx = colIndex.get(name.toLowerCase())
    if (idx === undefined) return ""
    return row[idx]?.trim() ?? ""
  }
}

function parseShelfArcRow(
  row: string[],
  colIndex: Map<string, number>
): ShelfArcCsvRow | null {
  const get = makeGetter(colIndex, row)

  const seriesTitle = get("series title")
  if (!seriesTitle) return null

  const volNumRaw = get("volume number")
  const volumeNumber = Number.parseFloat(volNumRaw)
  const resolvedVolumeNumber =
    Number.isFinite(volumeNumber) && volumeNumber > 0 ? volumeNumber : 1

  const ownershipRaw = get("ownership status").toLowerCase()
  const ownershipStatus: OwnershipStatus = VALID_OWNERSHIP_STATUSES.has(
    ownershipRaw as OwnershipStatus
  )
    ? (ownershipRaw as OwnershipStatus)
    : "owned"

  const readingRaw = get("reading status").toLowerCase()
  const readingStatus: ReadingStatus = VALID_READING_STATUSES.has(
    readingRaw as ReadingStatus
  )
    ? (readingRaw as ReadingStatus)
    : "unread"

  const ratingParsed = parseIntOrNull(get("rating"))
  const rating =
    ratingParsed !== null && ratingParsed >= 1 && ratingParsed <= 10
      ? ratingParsed
      : null

  return {
    seriesTitle,
    seriesType: get("series type") || "other",
    author: get("author"),
    publisher: get("publisher"),
    volumeNumber: resolvedVolumeNumber,
    volumeTitle: get("volume title") || null,
    volumeDescription: get("volume description") || null,
    isbn: get("isbn") || null,
    edition: get("edition") || null,
    format: get("format") || null,
    ownershipStatus,
    readingStatus,
    pageCount: parseIntOrNull(get("page count")),
    rating,
    publishDate: parseDateOrNull(get("publish date")),
    purchaseDate: parseDateOrNull(get("purchase date")),
    purchasePrice: parseFloatOrNull(get("purchase price")),
    notes: get("notes") || null
  }
}

/**
 * Parses a ShelfArc export CSV string into typed row objects.
 * Returns an empty array if the file is not recognized as a ShelfArc export.
 * Rows with an empty Series Title are silently skipped.
 * @param csvText - The raw CSV file content.
 * @source
 */
export function parseShelfArcCsv(csvText: string): ShelfArcCsvRow[] {
  const allRows = parseCsvRows(csvText)
  if (allRows.length < 2) return []

  const headerRow = allRows[0].map((h) => h.trim())
  if (!isShelfArcFormat(headerRow)) return []

  // Build a case-insensitive column index lookup
  const colIndex = new Map<string, number>()
  for (let i = 0; i < headerRow.length; i++) {
    colIndex.set(headerRow[i].toLowerCase(), i)
  }

  const results: ShelfArcCsvRow[] = []

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i]
    if (row.every((cell) => cell.trim() === "")) continue
    const parsed = parseShelfArcRow(row, colIndex)
    if (parsed) results.push(parsed)
  }

  return results
}
