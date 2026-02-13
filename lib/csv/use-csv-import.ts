"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { parseIsbns } from "@/lib/csv/parse-isbns"
import { pickBestResult } from "@/lib/csv/score-result"
import type {
  CsvImportPhase,
  CsvImportStats,
  CsvParseMeta,
  IsbnImportItem
} from "@/lib/csv/types"
import type { BookSearchResult, BookSearchSource } from "@/lib/books/search"
import { searchBooks } from "@/lib/api/endpoints"
import type { OwnershipStatus } from "@/lib/types/database"

/** Minimum score to accept a result from the primary source. @source */
const PRIMARY_SCORE_THRESHOLD = 20
/** Minimum score to accept a result from the fallback source. @source */
const FALLBACK_SCORE_THRESHOLD = 10
/** Max results to fetch per ISBN search. @source */
const SEARCH_LIMIT = 5
/** Delay (ms) between ISBN searches to avoid API hammering. @source */
const PROCESS_DELAY_MS = 150

/**
 * Returns the alternate search source for fallback lookups.
 * @param source - The primary search source.
 * @returns The alternate source.
 * @source
 */
function getAlternateSource(source: BookSearchSource): BookSearchSource {
  return source === "google_books" ? "open_library" : "google_books"
}

/**
 * Searches for a single ISBN via the books search API.
 * @param isbn - The ISBN to search for.
 * @param source - The search provider to query.
 * @param signal - AbortSignal for cancellation.
 * @returns An array of matching book search results.
 * @throws On non-OK HTTP responses.
 * @source
 */
async function searchIsbn(
  isbn: string,
  source: BookSearchSource,
  signal: AbortSignal
): Promise<BookSearchResult[]> {
  const data = await searchBooks(
    { q: isbn, source, limit: SEARCH_LIMIT },
    signal
  )
  return data.results ?? []
}

/**
 * React hook managing the full CSV ISBN import lifecycle.
 * @param options - Optional set of existing ISBNs to skip.
 * @returns State and actions for parsing, importing, cancelling, and resetting.
 * @source
 */
export function useCsvImport({
  existingIsbns
}: { existingIsbns?: ReadonlySet<string> } = {}) {
  const [phase, setPhase] = useState<CsvImportPhase>("idle")
  const [items, setItems] = useState<IsbnImportItem[]>([])
  const [parseMeta, setParseMeta] = useState<CsvParseMeta | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [startTime, setStartTime] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const stats = useMemo<CsvImportStats>(() => {
    let added = 0
    let notFound = 0
    let errors = 0
    let searching = 0

    for (const item of items) {
      switch (item.status) {
        case "added":
          added += 1
          break
        case "not-found":
          notFound += 1
          break
        case "error":
          errors += 1
          break
        case "searching":
        case "fallback":
        case "found":
        case "adding":
          searching += 1
          break
      }
    }

    return {
      total: items.length,
      added,
      notFound,
      errors,
      searching,
      processed: added + notFound + errors
    }
  }, [items])

  const updateItem = useCallback(
    (index: number, update: Partial<IsbnImportItem>) => {
      setItems((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], ...update }
        return next
      })
    },
    []
  )

  const parseFile = useCallback(
    async (file: File) => {
      const text = await file.text()
      const {
        isbns,
        invalidCount,
        duplicateCount,
        invalidIsbns,
        duplicateIsbns,
        detectedColumns
      } = parseIsbns(text)

      let existingCount = 0
      const existingIsbnList: string[] = []
      const filteredIsbns = existingIsbns
        ? isbns.filter((isbn) => {
            if (existingIsbns.has(isbn)) {
              existingCount += 1
              existingIsbnList.push(isbn)
              return false
            }
            return true
          })
        : isbns

      const newItems: IsbnImportItem[] = filteredIsbns.map((isbn) => ({
        isbn,
        status: "pending"
      }))

      setItems(newItems)
      setParseMeta({
        detectedColumns,
        invalidCount,
        duplicateCount,
        existingCount,
        invalidIsbns,
        duplicateIsbns,
        existingIsbns: existingIsbnList
      })
      setFileName(file.name)
      setPhase("parsed")
    },
    [existingIsbns]
  )

  const processOneIsbn = useCallback(
    async (
      isbn: string,
      index: number,
      source: BookSearchSource,
      alternate: BookSearchSource,
      ownershipStatus: OwnershipStatus,
      addBooks: (
        results: BookSearchResult[],
        opts?: { ownershipStatus?: OwnershipStatus }
      ) => Promise<{ successCount: number; failureCount: number }>,
      signal: AbortSignal
    ) => {
      updateItem(index, { status: "searching" })

      const primaryResults = await searchIsbn(isbn, source, signal)
      let best = pickBestResult(primaryResults, isbn)

      if (!best || best.score < PRIMARY_SCORE_THRESHOLD) {
        updateItem(index, { status: "fallback" })
        const fallbackResults = await searchIsbn(isbn, alternate, signal)
        const fallbackBest = pickBestResult(fallbackResults, isbn)

        if (
          fallbackBest &&
          fallbackBest.score >= FALLBACK_SCORE_THRESHOLD &&
          (!best || fallbackBest.score > best.score)
        ) {
          best = fallbackBest
        }
      }

      if (!best || best.score < FALLBACK_SCORE_THRESHOLD) {
        updateItem(index, { status: "not-found" })
        return
      }

      updateItem(index, {
        status: "adding",
        result: best.result,
        score: best.score
      })

      const { successCount } = await addBooks([best.result], {
        ownershipStatus
      })

      if (successCount > 0) {
        updateItem(index, { status: "added", result: best.result })
      } else {
        updateItem(index, {
          status: "error",
          result: best.result,
          error: "Failed to add to library"
        })
      }
    },
    [updateItem]
  )

  const markCancelledAndComplete = useCallback((wasAborted: boolean) => {
    if (wasAborted) {
      setItems((prev) =>
        prev.map((item) =>
          item.status === "pending"
            ? { ...item, status: "error", error: "Cancelled" }
            : item
        )
      )
    }
    setPhase("complete")
    abortRef.current = null
  }, [])

  const startImport = useCallback(
    async (options: {
      source: BookSearchSource
      ownershipStatus: OwnershipStatus
      addBooks: (
        results: BookSearchResult[],
        opts?: { ownershipStatus?: OwnershipStatus }
      ) => Promise<{
        successCount: number
        failureCount: number
      }>
    }) => {
      const { source, ownershipStatus, addBooks } = options
      const controller = new AbortController()
      abortRef.current = controller
      const alternate = getAlternateSource(source)

      setPhase("importing")
      setStartTime(Date.now())

      for (let i = 0; i < items.length; i++) {
        if (controller.signal.aborted) break

        try {
          await processOneIsbn(
            items[i].isbn,
            i,
            source,
            alternate,
            ownershipStatus,
            addBooks,
            controller.signal
          )
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            updateItem(i, { status: "error", error: "Cancelled" })
            break
          }
          updateItem(i, {
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error"
          })
        }

        if (i < items.length - 1 && !controller.signal.aborted) {
          await new Promise((resolve) => setTimeout(resolve, PROCESS_DELAY_MS))
        }
      }

      markCancelledAndComplete(controller.signal.aborted)
    },
    [items, updateItem, processOneIsbn, markCancelledAndComplete]
  )

  const cancelImport = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPhase("idle")
    setItems([])
    setParseMeta(null)
    setFileName(null)
    setStartTime(null)
  }, [])

  return {
    phase,
    items,
    stats,
    parseMeta,
    fileName,
    startTime,
    parseFile,
    startImport,
    cancelImport,
    reset
  }
}
