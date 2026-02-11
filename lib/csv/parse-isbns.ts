import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"

/** Result of parsing ISBNs from a CSV file. @source */
interface ParseIsbnsResult {
  isbns: string[]
  invalidCount: number
  duplicateCount: number
  detectedColumns: string[]
}

/** Regex for recognizing ISBN-related CSV column headers. @source */
const ISBN_HEADER_PATTERN = /^isbn[-_ ]?(10|13)?$/i

/* ─── CSV Parsing ───────────────────────────────────────── */

/**
 * Reads a quoted CSV field starting at `start` (after the opening quote).
 * @param text - The full CSV text.
 * @param start - Character index after the opening quote.
 * @returns The parsed field value and the next read position.
 * @source
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
 * Commits the current field to a row, optionally ending the row.
 * @param rows - Accumulator of completed rows.
 * @param row - The current row being built.
 * @param field - The current field value to commit.
 * @param endRow - Whether to finalize the current row.
 * @returns The next row and field state.
 * @source
 */
function commitField(
  rows: string[][],
  row: string[],
  field: string,
  endRow: boolean
): { row: string[]; field: string } {
  row.push(field)
  if (endRow) {
    rows.push(row)
    return { row: [], field: "" }
  }
  return { row, field: "" }
}

/**
 * Minimal RFC 4180-compliant CSV parser handling quoted fields and CRLF.
 * @param text - The raw CSV text.
 * @returns A 2D array of row/field strings.
 * @source
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
      ;({ row, field } = commitField(rows, row, field, false))
      i += 1
      continue
    }

    if (char === "\r" || char === "\n") {
      ;({ row, field } = commitField(rows, row, field, true))
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

/* ─── ISBN column detection ─────────────────────────────── */

/**
 * Detects ISBN column indices and names from the CSV header row.
 * @param headerRow - The first row of the CSV.
 * @returns Column indices and their header names.
 * @source
 */
function detectIsbnColumns(headerRow: string[]): {
  indices: number[]
  names: string[]
} {
  const indices: number[] = []
  const names: string[] = []

  for (let col = 0; col < headerRow.length; col++) {
    const header = headerRow[col].trim()
    if (ISBN_HEADER_PATTERN.test(header)) {
      indices.push(col)
      names.push(header)
    }
  }

  return { indices, names }
}

/* ─── ISBN extraction ───────────────────────────────────── */

/**
 * Normalizes and validates a single CSV cell as an ISBN.
 * @param cell - The raw cell value.
 * @returns The normalized ISBN, or `null` if invalid.
 * @source
 */
function extractIsbn(cell: string | undefined): string | null {
  const raw = cell?.trim()
  if (!raw) return null
  const normalized = normalizeIsbn(raw)
  if (!normalized) return null
  return isValidIsbn(normalized) ? normalized : null
}

/**
 * Collects valid, deduplicated ISBNs from CSV data rows at the given column indices.
 * @param dataRows - CSV rows excluding the header.
 * @param columnIndices - Indices of detected ISBN columns.
 * @returns Deduplicated ISBNs with invalid and duplicate counts.
 * @source
 */
function collectIsbns(
  dataRows: string[][],
  columnIndices: number[]
): { isbns: string[]; invalidCount: number; duplicateCount: number } {
  const seen = new Set<string>()
  const isbns: string[] = []
  let invalidCount = 0
  let duplicateCount = 0

  for (const row of dataRows) {
    for (const colIndex of columnIndices) {
      const raw = row[colIndex]?.trim()
      if (!raw) continue

      const isbn = extractIsbn(raw)
      if (!isbn) {
        invalidCount += 1
        continue
      }

      if (seen.has(isbn)) {
        duplicateCount += 1
        continue
      }

      seen.add(isbn)
      isbns.push(isbn)
    }
  }

  return { isbns, invalidCount, duplicateCount }
}

/* ─── Public API ────────────────────────────────────────── */

/** Empty parse result returned when the CSV has no usable data. @source */
const EMPTY_RESULT: ParseIsbnsResult = {
  isbns: [],
  invalidCount: 0,
  duplicateCount: 0,
  detectedColumns: []
}

/**
 * Parses a CSV string, auto-detects ISBN columns, and returns validated, deduplicated ISBNs.
 * @param csvText - The raw CSV file content.
 * @returns Parsed ISBNs with metadata about detected columns and skipped entries.
 * @source
 */
export function parseIsbns(csvText: string): ParseIsbnsResult {
  const rows = parseCsvRows(csvText)
  if (rows.length < 2) return EMPTY_RESULT

  const { indices, names } = detectIsbnColumns(rows[0])
  if (indices.length === 0) return EMPTY_RESULT

  const { isbns, invalidCount, duplicateCount } = collectIsbns(
    rows.slice(1),
    indices
  )

  return {
    isbns,
    invalidCount,
    duplicateCount,
    detectedColumns: names
  }
}
