import { type NextRequest } from "next/server"

import { checkAchievements } from "@/lib/achievements/check-achievements"
import { recordActivityEvent } from "@/lib/activity/record-event"
import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import {
  apiError,
  apiSuccess,
  getErrorMessage,
  parseJsonBody
} from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import { CreateSeriesSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

/** List the authenticated user's series, sorted by most recently updated. */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      rateLimit: RATE_LIMITS.libraryRead
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    const { searchParams } = new URL(request.url)
    const limit = Math.min(
      Math.max(Number.parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1),
      200
    )
    const offset = Math.max(
      Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0,
      0
    )

    const { data, error, count } = await supabase
      .from("series")
      .select(
        "id, user_id, title, original_title, author, artist, publisher, cover_image_url, type, total_volumes, owned_volume_count, status, tags, is_public, created_at, updated_at",
        { count: "exact" }
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      log.error("GET /api/library/series failed", { error: error.message })
      return apiError(500, "Failed to fetch series", { correlationId })
    }

    return apiSuccess(
      { data, pagination: { limit, offset, total: count ?? 0 } },
      { correlationId }
    )
  } catch (err) {
    log.error("GET /api/library/series failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      csrf: true,
      rateLimit: RATE_LIMITS.mutationWrite
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    const body = await parseJsonBody(request)
    if (body instanceof Response) return body

    const parsed = CreateSeriesSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insert: any = {
      user_id: user.id,
      ...parsed.data
    }

    const { data, error } = await supabase
      .from("series")
      .insert(insert)
      .select()
      .single()

    if (error) {
      log.error("Failed to create series", {
        error: error.message,
        code: error.code
      })
      return apiError(500, "Failed to create series", { correlationId })
    }

    void recordActivityEvent(supabase, {
      userId: user.id,
      eventType: "series_created",
      entityType: "series",
      entityId: data.id,
      metadata: { title: parsed.data.title }
    })

    void checkAchievements(supabase, user.id)

    return apiSuccess(data, { correlationId, status: 201 })
  } catch (err) {
    log.error("POST /api/library/series failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
