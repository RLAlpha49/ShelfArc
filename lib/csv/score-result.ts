import { normalizeIsbn } from "@/lib/books/isbn"
import type { BookSearchResult } from "@/lib/books/search"

/**
 * Scores a search result based on metadata richness.
 * Higher score = more complete data. Max possible: 100.
 *
 * An exact ISBN match is heavily weighted (+50) so that
 * results matching the queried ISBN almost always win.
 */
export function scoreSearchResult(
  result: BookSearchResult,
  queryIsbn: string
): number {
  let score = 0

  const normalizedResultIsbn = result.isbn ? normalizeIsbn(result.isbn) : ""
  const normalizedQuery = normalizeIsbn(queryIsbn)

  if (normalizedResultIsbn && normalizedResultIsbn === normalizedQuery) {
    score += 50
  }

  if (result.title?.trim()) score += 10
  if (result.coverUrl?.trim()) score += 10
  if (result.authors.length > 0) score += 8
  if (result.description?.trim()) score += 7
  if (result.pageCount && result.pageCount > 0) score += 5
  if (result.publisher?.trim()) score += 5
  if (result.publishedDate?.trim()) score += 3
  if (result.seriesTitle?.trim()) score += 2

  return score
}

/**
 * Picks the best result from a list by metadata score.
 * Returns `null` if the list is empty.
 */
export function pickBestResult(
  results: BookSearchResult[],
  queryIsbn: string
): { result: BookSearchResult; score: number } | null {
  if (results.length === 0) return null

  let best = results[0]
  let bestScore = scoreSearchResult(best, queryIsbn)

  for (let i = 1; i < results.length; i++) {
    const candidate = results[i]
    const candidateScore = scoreSearchResult(candidate, queryIsbn)
    if (candidateScore > bestScore) {
      best = candidate
      bestScore = candidateScore
    }
  }

  return { result: best, score: bestScore }
}
