import { type NextRequest } from "next/server"
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
  sanitizeVolumeUpdate,
  normalizeVolumeDates
} from "@/lib/library/sanitize-library"
import { recordActivityEvent } from "@/lib/activity/record-event"
import type { Volume } from "@/lib/types/database"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      rateLimit: RATE_LIMITS.libraryRead
    })
    if (!result.ok) return result.error
    const { user, supabase } = result
    const { id } = await params

    if (!id || typeof id !== "string") {
      return apiError(400, "Invalid volume id", { correlationId })
    }

    const { data: volume, error } = await supabase
      .from("volumes")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error || !volume) {
      return apiError(404, "Volume not found", { correlationId })
    }

    let seriesData = null
    if (volume.series_id) {
      const { data: series } = await supabase
        .from("series")
        .select("id, title, type, author, artist, publisher")
        .eq("id", volume.series_id)
        .eq("user_id", user.id)
        .single()

      seriesData = series
    }

    return apiSuccess({ ...volume, series: seriesData }, { correlationId })
  } catch (err) {
    log.error("GET /api/library/volumes/[id] failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      csrf: true,
      rateLimit: RATE_LIMITS.mutationWrite
    })
    if (!result.ok) return result.error
    const { user, supabase } = result
    const { id } = await params

    if (!id || typeof id !== "string") {
      return apiError(400, "Invalid volume id", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof Response) return body

    if (
      Object.hasOwn(body, "series_id") &&
      body.series_id !== null &&
      typeof body.series_id === "string" &&
      body.series_id.trim()
    ) {
      const { data: seriesExists } = await supabase
        .from("series")
        .select("id")
        .eq("id", body.series_id)
        .eq("user_id", user.id)
        .single()

      if (!seriesExists) {
        return apiError(404, "Target series not found", { correlationId })
      }
    }

    const sanitized = sanitizeVolumeUpdate(body as Partial<Volume>)
    const updatePayload = normalizeVolumeDates({
      ...sanitized,
      ...(Object.hasOwn(body, "series_id")
        ? {
            series_id:
              body.series_id === null
                ? null
                : typeof body.series_id === "string"
                  ? body.series_id
                  : undefined
          }
        : {})
    })

    const { data, error } = await supabase
      .from("volumes")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !data) {
      return apiError(404, "Volume not found or update failed", {
        correlationId
      })
    }

    void recordActivityEvent(supabase, {
      userId: user.id,
      eventType: "volume_updated",
      entityType: "volume",
      entityId: id,
      metadata: {
        title: data.title,
        volumeNumber: data.volume_number
      }
    })

    return apiSuccess(data, { correlationId })
  } catch (err) {
    log.error("PATCH /api/library/volumes/[id] failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      csrf: true,
      rateLimit: RATE_LIMITS.mutationWrite
    })
    if (!result.ok) return result.error
    const { user, supabase } = result
    const { id } = await params

    if (!id || typeof id !== "string") {
      return apiError(400, "Invalid volume id", { correlationId })
    }

    const { error } = await supabase
      .from("volumes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      return apiError(400, "Failed to delete volume", {
        correlationId,
        details: error.message
      })
    }

    void recordActivityEvent(supabase, {
      userId: user.id,
      eventType: "volume_deleted",
      entityType: "volume",
      entityId: id
    })

    return apiSuccess({ deleted: true }, { correlationId })
  } catch (err) {
    log.error("DELETE /api/library/volumes/[id] failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
