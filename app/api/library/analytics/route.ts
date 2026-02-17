import { type NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import {
  computeCollectionStats,
  computePriceBreakdown,
  computeWishlistStats
} from "@/lib/library/analytics"
import { computeHealthScore } from "@/lib/library/health-score"
import type { SeriesWithVolumes } from "@/lib/types/database"

export const dynamic = "force-dynamic"

/** Volume columns required by analytics functions. @source */
const VOLUME_COLUMNS = [
  "id",
  "series_id",
  "volume_number",
  "ownership_status",
  "reading_status",
  "purchase_price",
  "publish_date",
  "title",
  "created_at",
  "cover_image_url",
  "isbn",
  "description"
].join(", ")

/** Series columns required by analytics functions. @source */
const SERIES_COLUMNS = "id, type, total_volumes, title, status"

/**
 * Pre-computed dashboard analytics endpoint.
 * Uses embedded join to fetch series with volumes in a single round-trip,
 * then runs O(S+V) single-pass analytics functions.
 * @source
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      rateLimit: RATE_LIMITS.analyticsRead
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    log.info("Analytics fetch", { userId: user.id })

    // Single query with embedded join — avoids separate volumes fetch + JS grouping
    const { data: seriesData, error } = await supabase
      .from("series")
      .select(`${SERIES_COLUMNS}, volumes(${VOLUME_COLUMNS})`)
      .eq("user_id", user.id)

    if (error) {
      log.error("Analytics query failed", { error: error.message })
      return apiError(500, "Failed to fetch analytics data", { correlationId })
    }

    const seriesWithVolumes = (seriesData ??
      []) as unknown as SeriesWithVolumes[]

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
