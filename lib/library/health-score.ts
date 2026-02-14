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

export function computeHealthScore(
  series: readonly SeriesWithVolumes[]
): HealthScore {
  const allVolumes = series.flatMap((s) => s.volumes)
  const totalVolumes = allVolumes.length

  // 1. Completion Rate
  const readVolumes = allVolumes.filter(
    (v) => v.reading_status === "completed"
  ).length
  const completionScore =
    totalVolumes > 0 ? (readVolumes / totalVolumes) * 20 : 0

  // 2. Ownership
  const ownedVolumes = allVolumes.filter(
    (v) => v.ownership_status === "owned"
  ).length
  const ownershipScore =
    totalVolumes > 0 ? (ownedVolumes / totalVolumes) * 20 : 0

  // 3. Series Completeness
  const seriesWithTotal = series.filter(
    (s) => s.total_volumes != null && s.total_volumes > 0
  )
  let completenessScore: number
  if (seriesWithTotal.length > 0) {
    const ratioSum = seriesWithTotal.reduce((sum, s) => {
      const ratio = Math.min(s.volumes.length / s.total_volumes!, 1)
      return sum + ratio
    }, 0)
    completenessScore = (ratioSum / seriesWithTotal.length) * 20
  } else {
    completenessScore = 10
  }

  // 4. Price Tracking
  let pricingScore: number
  if (ownedVolumes > 0) {
    const pricedOwned = allVolumes.filter(
      (v) =>
        v.ownership_status === "owned" &&
        v.purchase_price != null &&
        v.purchase_price > 0
    ).length
    pricingScore = (pricedOwned / ownedVolumes) * 20
  } else {
    pricingScore = 10
  }

  // 5. Metadata Quality
  let metadataScore: number
  if (totalVolumes > 0) {
    const withCover = allVolumes.filter((v) => v.cover_image_url).length
    const withIsbn = allVolumes.filter((v) => v.isbn).length
    const withDesc = allVolumes.filter((v) => v.description).length
    const avgFraction =
      (withCover / totalVolumes +
        withIsbn / totalVolumes +
        withDesc / totalVolumes) /
      3
    metadataScore = avgFraction * 20
  } else {
    metadataScore = 0
  }

  const factors: HealthScoreFactor[] = [
    {
      id: "completion",
      label: "Completion Rate",
      score: Math.round(completionScore * 10) / 10,
      maxScore: 20,
      description: `${readVolumes} of ${totalVolumes} volumes read`
    },
    {
      id: "ownership",
      label: "Ownership",
      score: Math.round(ownershipScore * 10) / 10,
      maxScore: 20,
      description: `${ownedVolumes} of ${totalVolumes} volumes owned`
    },
    {
      id: "completeness",
      label: "Series Completeness",
      score: Math.round(completenessScore * 10) / 10,
      maxScore: 20,
      description:
        seriesWithTotal.length > 0
          ? `${seriesWithTotal.length} series with tracked totals`
          : "No series have total volume counts set"
    },
    {
      id: "pricing",
      label: "Price Tracking",
      score: Math.round(pricingScore * 10) / 10,
      maxScore: 20,
      description:
        ownedVolumes > 0
          ? `${allVolumes.filter((v) => v.ownership_status === "owned" && v.purchase_price != null && v.purchase_price > 0).length} of ${ownedVolumes} owned volumes priced`
          : "No owned volumes yet"
    },
    {
      id: "metadata",
      label: "Metadata Quality",
      score: Math.round(metadataScore * 10) / 10,
      maxScore: 20,
      description:
        totalVolumes > 0
          ? "Covers, ISBNs, and descriptions"
          : "No volumes to evaluate"
    }
  ]

  const overall = Math.round(factors.reduce((s, f) => s + f.score, 0))

  // Generate suggestions for lowest-scoring factors
  const sorted = [...factors].sort((a, b) => a.score - b.score)
  const suggestions: string[] = []

  for (const factor of sorted) {
    if (suggestions.length >= 3) break
    if (factor.score >= factor.maxScore * 0.8) continue

    switch (factor.id) {
      case "completion": {
        const remaining = totalVolumes - readVolumes
        if (remaining > 0) {
          suggestions.push(
            `Mark ${remaining} more volume${remaining === 1 ? "" : "s"} as read to improve your completion rate`
          )
        }
        break
      }
      case "ownership": {
        const wishlisted = allVolumes.filter(
          (v) => v.ownership_status === "wishlist"
        ).length
        if (wishlisted > 0) {
          suggestions.push(
            `You have ${wishlisted} wishlisted volume${wishlisted === 1 ? "" : "s"} — consider purchasing some`
          )
        }
        break
      }
      case "completeness": {
        const untracked = series.filter(
          (s) => s.total_volumes == null || s.total_volumes === 0
        ).length
        if (untracked > 0) {
          suggestions.push(
            `Set total volume counts on ${untracked} series to track completeness`
          )
        }
        break
      }
      case "pricing": {
        const unpricedOwned = allVolumes.filter(
          (v) =>
            v.ownership_status === "owned" &&
            (v.purchase_price == null || v.purchase_price <= 0)
        ).length
        if (unpricedOwned > 0) {
          suggestions.push(
            `Add purchase prices to ${unpricedOwned} owned volume${unpricedOwned === 1 ? "" : "s"} for better tracking`
          )
        }
        break
      }
      case "metadata": {
        const missingMeta = allVolumes.filter(
          (v) => !v.cover_image_url || !v.isbn || !v.description
        ).length
        if (missingMeta > 0) {
          suggestions.push(
            `Add cover images, ISBNs, or descriptions to ${missingMeta} volume${missingMeta === 1 ? "" : "s"}`
          )
        }
        break
      }
    }
  }

  return {
    overall,
    label: getLabel(overall),
    factors,
    suggestions
  }
}
