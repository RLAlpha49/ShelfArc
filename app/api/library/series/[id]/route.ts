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
import { sanitizeSeriesUpdate } from "@/lib/library/sanitize-library"
import { logger } from "@/lib/logger"
import type { Series } from "@/lib/types/database"
import { isValidUUID } from "@/lib/validation"

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

    if (!isValidUUID(id)) {
      return apiError(400, "Invalid series id", { correlationId })
    }

    const { data: series, error } = await supabase
      .from("series")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (error || !series) {
      return apiError(404, "Series not found", { correlationId })
    }

    const { data: volumes } = await supabase
      .from("volumes")
      .select("*")
      .eq("series_id", id)
      .eq("user_id", user.id)
      .order("volume_number", { ascending: true })

    return apiSuccess({ ...series, volumes: volumes ?? [] }, { correlationId })
  } catch (err) {
    log.error("GET /api/library/series/[id] failed", {
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

    if (!isValidUUID(id)) {
      return apiError(400, "Invalid series id", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof Response) return body

    const update = sanitizeSeriesUpdate(body as Partial<Series>)

    const { data, error } = await supabase
      .from("series")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !data) {
      return apiError(404, "Series not found or update failed", {
        correlationId
      })
    }

    void recordActivityEvent(supabase, {
      userId: user.id,
      eventType: "series_updated",
      entityType: "series",
      entityId: id,
      metadata: { title: data.title ?? "Series" }
    })

    return apiSuccess(data, { correlationId })
  } catch (err) {
    log.error("PATCH /api/library/series/[id] failed", {
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

    if (!isValidUUID(id)) {
      return apiError(400, "Invalid series id", { correlationId })
    }

    const deleteVolumes =
      request.nextUrl.searchParams.get("deleteVolumes") === "true"

    if (deleteVolumes) {
      // Atomically delete all volumes in the series, then the series itself,
      // in a single DB transaction via the delete_series_atomic RPC.
      const { error: rpcError } = await supabase.rpc("delete_series_atomic", {
        p_series_id: id,
        p_user_id: user.id
      })

      if (rpcError) {
        if (rpcError.message.includes("series_not_found")) {
          return apiError(404, "Series not found", { correlationId })
        }
        return apiError(400, "Failed to delete series", {
          correlationId,
          details: rpcError.message
        })
      }
    } else {
      const { error: volUpdateError } = await supabase
        .from("volumes")
        .update({ series_id: null })
        .eq("series_id", id)
        .eq("user_id", user.id)

      if (volUpdateError) {
        return apiError(400, "Failed to detach volumes", {
          correlationId,
          details: volUpdateError.message
        })
      }

      const { error: seriesDelError } = await supabase
        .from("series")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id)

      if (seriesDelError) {
        return apiError(400, "Failed to delete series", {
          correlationId,
          details: seriesDelError.message
        })
      }
    }

    void recordActivityEvent(supabase, {
      userId: user.id,
      eventType: "series_deleted",
      entityType: "series",
      entityId: id
    })

    return apiSuccess({ deleted: true }, { correlationId })
  } catch (err) {
    log.error("DELETE /api/library/series/[id] failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
