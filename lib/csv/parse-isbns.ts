import { isValidIsbn, normalizeIsbn } from "@/lib/books/isbn"

interface ParseIsbnsResult {
  isbns: string[]
  invalidCount: number
  duplicateCount: number
  detectedColumns: string[]
}

const ISBN_HEADER_PATTERN = /^isbn[-_ ]?(10|13)?$/i

/* ─── CSV Parsing ───────────────────────────────────────── */

/** Read a quoted field starting at position `start` (after the opening quote). */
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

/** Commit the current field to the row, and the row to results if `endRow` is true. */
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
 * Minimal RFC 4180-compliant CSV parser.
 * Handles quoted fields, escaped quotes, and CRLF/LF line endings.
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

function extractIsbn(cell: string | undefined): string | null {
  const raw = cell?.trim()
  if (!raw) return null
  const normalized = normalizeIsbn(raw)
  if (!normalized) return null
  return isValidIsbn(normalized) ? normalized : null
}

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

const EMPTY_RESULT: ParseIsbnsResult = {
  isbns: [],
  invalidCount: 0,
  duplicateCount: 0,
  detectedColumns: []
}

/**
 * Parses a CSV string, auto-detects ISBN columns by header name,
 * extracts and validates ISBNs, and returns deduplicated results.
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
