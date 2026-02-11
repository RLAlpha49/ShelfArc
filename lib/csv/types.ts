import type { BookSearchResult } from "@/lib/books/search"

/** Lifecycle status of a single ISBN import item. @source */
export type IsbnImportStatus =
  | "pending"
  | "searching"
  | "fallback"
  | "found"
  | "adding"
  | "added"
  | "not-found"
  | "error"

/** A single ISBN being imported, with its search result and status. @source */
export interface IsbnImportItem {
  isbn: string
  status: IsbnImportStatus
  result?: BookSearchResult
  error?: string
  score?: number
}

/** High-level phase of the CSV import workflow. @source */
export type CsvImportPhase =
  | "idle"
  | "file-selected"
  | "parsed"
  | "importing"
  | "complete"

/** Aggregate statistics for a CSV import run. @source */
export interface CsvImportStats {
  total: number
  added: number
  notFound: number
  errors: number
  searching: number
  processed: number
}

/** Metadata extracted during CSV parsing. @source */
export interface CsvParseMeta {
  detectedColumns: string[]
  invalidCount: number
  duplicateCount: number
  existingCount: number
}
