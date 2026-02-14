import type { SeriesWithVolumes } from "@/lib/types/database"

export interface HealthScoreFactor {
  id: string
  label: string
  score: number
  maxScore: number
  description: string
}

export interface HealthScore {
  overall: number
  label: "Excellent" | "Good" | "Fair" | "Needs Work"
  factors: HealthScoreFactor[]
  suggestions: string[]
}

function getLabel(score: number): HealthScore["label"] {
  if (score >= 80) return "Excellent"
  if (score >= 60) return "Good"
  if (score >= 40) return "Fair"
  return "Needs Work"
}

interface VolumeCounts {
  total: number
  read: number
  owned: number
  pricedOwned: number
  unpricedOwned: number
  wishlisted: number
  withCover: number
  withIsbn: number
  withDesc: number
  missingMeta: number
}

interface SeriesCounts {
  withTotal: number
  completenessRatioSum: number
  untracked: number
}

/** Single-pass tally of all volume-level and series-level counters. O(S + V) */
function tallyAll(
  series: readonly SeriesWithVolumes[]
): { vol: VolumeCounts; ser: SeriesCounts } {
  const vol: VolumeCounts = {
    total: 0,
    read: 0,
    owned: 0,
    pricedOwned: 0,
    unpricedOwned: 0,
    wishlisted: 0,
    withCover: 0,
    withIsbn: 0,
    withDesc: 0,
    missingMeta: 0
  }
  const ser: SeriesCounts = { withTotal: 0, completenessRatioSum: 0, untracked: 0 }

  for (const s of series) {
    if (s.total_volumes != null && s.total_volumes > 0) {
      ser.withTotal++
      ser.completenessRatioSum += Math.min(s.volumes.length / s.total_volumes, 1)
    } else {
      ser.untracked++
    }

    for (const v of s.volumes) {
      vol.total++
      if (v.reading_status === "completed") vol.read++
      if (v.ownership_status === "owned") {
        vol.owned++
        if (v.purchase_price != null && v.purchase_price > 0) vol.pricedOwned++
        else vol.unpricedOwned++
      }
      if (v.ownership_status === "wishlist") vol.wishlisted++
      if (v.cover_image_url) vol.withCover++
      if (v.isbn) vol.withIsbn++
      if (v.description) vol.withDesc++
      if (!v.cover_image_url || !v.isbn || !v.description) vol.missingMeta++
    }
  }

  return { vol, ser }
}

function computeFactors(vol: VolumeCounts, ser: SeriesCounts): HealthScoreFactor[] {
  const { total, read, owned, pricedOwned, withCover, withIsbn, withDesc } = vol

  const completionScore = total > 0 ? (read / total) * 20 : 0
  const ownershipScore = total > 0 ? (owned / total) * 20 : 0
  const completenessScore =
    ser.withTotal > 0
      ? (ser.completenessRatioSum / ser.withTotal) * 20
      : 10
  const pricingScore = owned > 0 ? (pricedOwned / owned) * 20 : 10
  const metadataScore =
    total > 0
      ? ((withCover / total + withIsbn / total + withDesc / total) / 3) * 20
      : 0

  const round1 = (n: number) => Math.round(n * 10) / 10
  return [
    {
      id: "completion",
      label: "Completion Rate",
      score: round1(completionScore),
      maxScore: 20,
      description: `${read} of ${total} volumes read`
    },
    {
      id: "ownership",
      label: "Ownership",
      score: round1(ownershipScore),
      maxScore: 20,
      description: `${owned} of ${total} volumes owned`
    },
    {
      id: "completeness",
      label: "Series Completeness",
      score: round1(completenessScore),
      maxScore: 20,
      description:
        ser.withTotal > 0
          ? `${ser.withTotal} series with tracked totals`
          : "No series have total volume counts set"
    },
    {
      id: "pricing",
      label: "Price Tracking",
      score: round1(pricingScore),
      maxScore: 20,
      description:
        owned > 0
          ? `${pricedOwned} of ${owned} owned volumes priced`
          : "No owned volumes yet"
    },
    {
      id: "metadata",
      label: "Metadata Quality",
      score: round1(metadataScore),
      maxScore: 20,
      description: total > 0 ? "Covers, ISBNs, and descriptions" : "No volumes to evaluate"
    }
  ]
}

const SUGGESTION_BUILDERS: Record<
  string,
  (vol: VolumeCounts, ser: SeriesCounts) => string | null
> = {
  completion: (vol) => {
    const remaining = vol.total - vol.read
    return remaining > 0
      ? `Mark ${remaining} more volume${remaining === 1 ? "" : "s"} as read to improve your completion rate`
      : null
  },
  ownership: (vol) =>
    vol.wishlisted > 0
      ? `You have ${vol.wishlisted} wishlisted volume${vol.wishlisted === 1 ? "" : "s"} — consider purchasing some`
      : null,
  completeness: (_vol, ser) =>
    ser.untracked > 0
      ? `Set total volume counts on ${ser.untracked} series to track completeness`
      : null,
  pricing: (vol) =>
    vol.unpricedOwned > 0
      ? `Add purchase prices to ${vol.unpricedOwned} owned volume${vol.unpricedOwned === 1 ? "" : "s"} for better tracking`
      : null,
  metadata: (vol) =>
    vol.missingMeta > 0
      ? `Add cover images, ISBNs, or descriptions to ${vol.missingMeta} volume${vol.missingMeta === 1 ? "" : "s"}`
      : null
}

function buildSuggestions(
  factors: HealthScoreFactor[],
  vol: VolumeCounts,
  ser: SeriesCounts
): string[] {
  const sorted = [...factors].sort((a, b) => a.score - b.score)
  const suggestions: string[] = []

  for (const factor of sorted) {
    if (suggestions.length >= 3) break
    if (factor.score >= factor.maxScore * 0.8) continue
    const builder = SUGGESTION_BUILDERS[factor.id]
    const msg = builder?.(vol, ser)
    if (msg) suggestions.push(msg)
  }

  return suggestions
}

// O(S + V) single-pass aggregation (was ~11 separate filter passes over all volumes)
export function computeHealthScore(
  series: readonly SeriesWithVolumes[]
): HealthScore {
  const { vol, ser } = tallyAll(series)
  const factors = computeFactors(vol, ser)
  const overall = Math.round(factors.reduce((s, f) => s + f.score, 0))

  return {
    overall,
    label: getLabel(overall),
    factors,
    suggestions: buildSuggestions(factors, vol, ser)
  }
}
