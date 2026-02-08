import type { BookSearchResult } from "@/lib/books/search"

export type IsbnImportStatus =
  | "pending"
  | "searching"
  | "fallback"
  | "found"
  | "adding"
  | "added"
  | "not-found"
  | "error"

export interface IsbnImportItem {
  isbn: string
  status: IsbnImportStatus
  result?: BookSearchResult
  error?: string
  score?: number
}

export type CsvImportPhase =
  | "idle"
  | "file-selected"
  | "parsed"
  | "importing"
  | "complete"

export interface CsvImportStats {
  total: number
  added: number
  notFound: number
  errors: number
  searching: number
  processed: number
}

export interface CsvParseMeta {
  detectedColumns: string[]
  invalidCount: number
  duplicateCount: number
  existingCount: number
}
