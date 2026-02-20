import { normalizeIsbn } from "@/lib/books/isbn"
import type { BookSearchResult } from "@/lib/books/search"
import { normalizeSeriesTitle } from "@/lib/library/volume-normalization"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

/** Minimum Levenshtein similarity ratio (0–1) to consider two titles similar duplicates. */
const LEVENSHTEIN_THRESHOLD = 0.85

/**
 * Computes the Levenshtein edit distance between two strings using Dynamic Programming.
 * O(a.length × b.length) time; O(min(a.length, b.length)) space (rolling row).
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Keep the shorter string in the inner loop for space savings
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  let prev = Array.from({ length: short.length + 1 }, (_, i) => i)

  for (let j = 1; j <= long.length; j++) {
    const curr = [j]
    for (let i = 1; i <= short.length; i++) {
      const cost = short[i - 1] === long[j - 1] ? 0 : 1
      curr[i] = Math.min(
        (prev[i] ?? 0) + 1, // deletion
        (curr[i - 1] ?? 0) + 1, // insertion
        (prev[i - 1] ?? 0) + cost // substitution
      )
    }
    prev = curr
  }

  return prev[short.length] ?? 0
}

/**
 * Computes a normalized similarity score [0, 1] for two strings using Levenshtein distance.
 * 1.0 means identical; 0.0 means completely different.
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0
  const maxLen = Math.max(a.length, b.length)
  return 1 - levenshteinDistance(a, b) / maxLen
}

/** Describes why a search result may be a duplicate of an existing volume. */
export interface DuplicateCandidate {
  reason: "isbn" | "series_title" | "title_similarity"
  existingSeriesTitle: string
  existingVolumeTitle: string
  existingVolumeNumber: number | null
  existingIsbn: string | null
}

/**
 * Checks whether a book search result might duplicate an existing library entry
 * by ISBN, series title, or normalized title similarity.
 *
 * @param result - The incoming search result to check.
 * @param series - All series (with volumes) currently in the library.
 * @param unassignedVolumes - Volumes not assigned to any series.
 * @returns An array of duplicate candidates (empty if none found).
 */
export function findDuplicateCandidates(
  result: BookSearchResult,
  series: SeriesWithVolumes[],
  unassignedVolumes?: Volume[]
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = []
  const seen = new Set<string>()

  const resultIsbn = result.isbn ? normalizeIsbn(result.isbn) : ""
  const resultNormalizedTitle = normalizeSeriesTitle(result.title)
  const resultNormalizedSeries = result.seriesTitle
    ? normalizeSeriesTitle(result.seriesTitle)
    : ""

  const checkVolume = (
    volume: Volume,
    seriesTitle: string,
    normalizedSeriesTitle: string
  ) => {
    const volKey = volume.id

    // Check 1: Exact ISBN match
    if (resultIsbn && volume.isbn) {
      const volIsbn = normalizeIsbn(volume.isbn)
      if (volIsbn && volIsbn === resultIsbn && !seen.has(`isbn:${volKey}`)) {
        seen.add(`isbn:${volKey}`)
        candidates.push({
          reason: "isbn",
          existingSeriesTitle: seriesTitle,
          existingVolumeTitle: volume.title ?? "",
          existingVolumeNumber: volume.volume_number,
          existingIsbn: volume.isbn
        })
        return
      }
    }

    // Check 2: Same series title match (normalized)
    if (
      resultNormalizedSeries &&
      normalizedSeriesTitle &&
      resultNormalizedSeries === normalizedSeriesTitle &&
      !seen.has(`series:${volKey}`)
    ) {
      seen.add(`series:${volKey}`)
      candidates.push({
        reason: "series_title",
        existingSeriesTitle: seriesTitle,
        existingVolumeTitle: volume.title ?? "",
        existingVolumeNumber: volume.volume_number,
        existingIsbn: volume.isbn
      })
      return
    }

    // Check 3: Title similarity — Levenshtein ratio ≥ 0.85 between normalized titles
    if (resultNormalizedTitle && volume.title) {
      const volNormalizedTitle = normalizeSeriesTitle(volume.title)
      if (
        volNormalizedTitle &&
        levenshteinSimilarity(resultNormalizedTitle, volNormalizedTitle) >=
          LEVENSHTEIN_THRESHOLD &&
        !seen.has(`title:${volKey}`)
      ) {
        seen.add(`title:${volKey}`)
        candidates.push({
          reason: "title_similarity",
          existingSeriesTitle: seriesTitle,
          existingVolumeTitle: volume.title,
          existingVolumeNumber: volume.volume_number,
          existingIsbn: volume.isbn
        })
      }
    }
  }

  for (const s of series) {
    const normalizedSTitle = normalizeSeriesTitle(s.title)
    for (const v of s.volumes) {
      checkVolume(v, s.title, normalizedSTitle)
    }
  }

  if (unassignedVolumes) {
    for (const v of unassignedVolumes) {
      checkVolume(v, "Unassigned", "")
    }
  }

  return candidates
}

/** Human-readable label for each duplicate reason. */
export const DUPLICATE_REASON_LABELS: Record<
  DuplicateCandidate["reason"],
  string
> = {
  isbn: "Same ISBN",
  series_title: "Same series",
  title_similarity: "Similar title"
}
