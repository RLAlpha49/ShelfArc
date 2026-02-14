import "server-only"

import { type NextRequest } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import {
  computeCollectionStats,
  computePriceBreakdown,
  computeWishlistStats
} from "@/lib/library/analytics"
import { computeHealthScore } from "@/lib/library/health-score"
import type { SeriesWithVolumes } from "@/lib/types/database"

export const dynamic = "force-dynamic"

/**
 * Pre-computed dashboard analytics endpoint.
 * Fetches all series + volumes for the authenticated user,
 * reconstructs SeriesWithVolumes[], and returns aggregated stats.
 * @source
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(401, "Not authenticated", { correlationId })
    }

    log.info("Analytics fetch", { userId: user.id })

    const [seriesResult, volumesResult] = await Promise.all([
      supabase
        .from("series")
        .select("id, type, total_volumes, title, status")
        .eq("user_id", user.id),
      supabase
        .from("volumes")
        .select(
          "id, series_id, volume_number, ownership_status, reading_status, purchase_price, publish_date, title, created_at"
        )
        .eq("user_id", user.id)
    ])

    if (seriesResult.error) {
      log.error("Series query failed", {
        error: seriesResult.error.message
      })
      return apiError(500, "Failed to fetch series data", { correlationId })
    }

    if (volumesResult.error) {
      log.error("Volumes query failed", {
        error: volumesResult.error.message
      })
      return apiError(500, "Failed to fetch volume data", { correlationId })
    }

    const seriesRows = seriesResult.data ?? []
    const volumeRows = volumesResult.data ?? []

    // Group volumes by series_id
    const volumesBySeries = new Map<string, typeof volumeRows>()
    for (const v of volumeRows) {
      if (!v.series_id) continue
      const existing = volumesBySeries.get(v.series_id)
      if (existing) {
        existing.push(v)
      } else {
        volumesBySeries.set(v.series_id, [v])
      }
    }

    // Reconstruct SeriesWithVolumes[] shape for analytics functions
    const seriesWithVolumes = seriesRows.map((s) => ({
      ...s,
      volumes: volumesBySeries.get(s.id) ?? []
    })) as unknown as SeriesWithVolumes[]

    const collectionStats = computeCollectionStats(seriesWithVolumes)
    const priceBreakdown = computePriceBreakdown(seriesWithVolumes)
    const wishlistStats = computeWishlistStats(seriesWithVolumes)
    const healthScore = computeHealthScore(seriesWithVolumes)

    const response = apiSuccess(
      { collectionStats, priceBreakdown, wishlistStats, healthScore },
      { correlationId }
    )

    response.headers.set("Cache-Control", "private, max-age=300")

    return response
  } catch (error) {
    log.error("Analytics fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to compute analytics", { correlationId })
  }
}
