import { type NextRequest } from "next/server"

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
import {
  sanitizeOptionalHtml,
  sanitizeOptionalPlainText,
  sanitizePlainText
} from "@/lib/sanitize-html"
import {
  isPositiveInteger,
  isValidSeriesStatus,
  isValidTitleType
} from "@/lib/validation"

export const dynamic = "force-dynamic"

const asString = (v: unknown): string => (typeof v === "string" ? v : "")

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

    const title = sanitizePlainText(asString(body.title), 500)
    if (!title) {
      return apiError(400, "Title is required", { correlationId })
    }

    const insert = {
      user_id: user.id,
      title,
      original_title: sanitizeOptionalPlainText(
        asString(body.original_title),
        500
      ),
      description: sanitizeOptionalHtml(asString(body.description)),
      author: sanitizeOptionalPlainText(asString(body.author), 1000),
      artist: sanitizeOptionalPlainText(asString(body.artist), 1000),
      publisher: sanitizeOptionalPlainText(asString(body.publisher), 1000),
      notes: sanitizeOptionalPlainText(asString(body.notes), 5000),
      type: isValidTitleType(body.type) ? body.type : ("other" as const),
      tags: Array.isArray(body.tags)
        ? body.tags
            .map((t: unknown) => sanitizePlainText(String(t), 100))
            .filter(Boolean)
        : [],
      total_volumes: isPositiveInteger(body.total_volumes)
        ? body.total_volumes
        : null,
      cover_image_url: sanitizeOptionalPlainText(
        asString(body.cover_image_url),
        2000
      ),
      status: isValidSeriesStatus(body.status) ? body.status : null
    }

    const { data, error } = await supabase
      .from("series")
      .insert(insert)
      .select()
      .single()

    if (error) {
      return apiError(400, "Failed to create series", {
        correlationId,
        details: error.message
      })
    }

    void recordActivityEvent(supabase, {
      userId: user.id,
      eventType: "series_created",
      entityType: "series",
      entityId: data.id,
      metadata: { title }
    })

    return apiSuccess(data, { correlationId, status: 201 })
  } catch (err) {
    log.error("POST /api/library/series failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
