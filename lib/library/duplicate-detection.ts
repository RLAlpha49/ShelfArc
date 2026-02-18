import { normalizeIsbn } from "@/lib/books/isbn"
import type { BookSearchResult } from "@/lib/books/search"
import { normalizeSeriesTitle } from "@/lib/library/volume-normalization"
import type { SeriesWithVolumes, Volume } from "@/lib/types/database"

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

    // Check 3: Title similarity — normalized result title matches volume title
    if (resultNormalizedTitle && volume.title) {
      const volNormalizedTitle = normalizeSeriesTitle(volume.title)
      if (
        volNormalizedTitle &&
        volNormalizedTitle === resultNormalizedTitle &&
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
