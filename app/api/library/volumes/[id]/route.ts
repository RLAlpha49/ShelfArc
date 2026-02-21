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
import { createUserClient } from "@/lib/supabase/server"
import type { Volume } from "@/lib/types/database"
import { isValidUUID } from "@/lib/validation"
import { UpdateVolumeSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

async function getPrevReadingStatus(
  supabase: Awaited<ReturnType<typeof createUserClient>>,
  id: string,
  userId: string,
  body: Record<string, unknown>
): Promise<string | null | undefined> {
  if (!Object.hasOwn(body, "reading_status")) return undefined
  const { data } = await supabase
    .from("volumes")
    .select("reading_status")
    .eq("id", id)
    .eq("user_id", userId)
    .single()
  return data?.reading_status ?? null
}

function emitReadingStatusEvent(
  supabase: Awaited<ReturnType<typeof createUserClient>>,
  opts: {
    userId: string
    entityId: string
    prevStatus: string | null | undefined
    newStatus: string | null | undefined
    title: string | null | undefined
    volumeNumber: number | null | undefined
  }
) {
  if (opts.prevStatus === undefined) return
  if (opts.newStatus === opts.prevStatus) return
  void recordActivityEvent(supabase, {
    userId: opts.userId,
    eventType: "reading_status_changed",
    entityType: "volume",
    entityId: opts.entityId,
    metadata: {
      from: opts.prevStatus ?? null,
      to: opts.newStatus ?? null,
      volumeTitle: opts.title ?? null,
      volumeNumber: opts.volumeNumber ?? null
    }
  })
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

    if (!isValidUUID(id)) {
      return apiError(400, "Invalid volume id", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof Response) return body

    const parsed = UpdateVolumeSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    if (parsed.data.series_id) {
      const { data: seriesExists } = await supabase
        .from("series")
        .select("id")
        .eq("id", parsed.data.series_id)
        .eq("user_id", user.id)
        .single()

      if (!seriesExists) {
        return apiError(404, "Target series not found", { correlationId })
      }
    }

    const prevReadingStatus = await getPrevReadingStatus(
      supabase,
      id,
      user.id,
      body
    )

    const updatePayload = parsed.data as Partial<Volume>

    const { data, error } = await supabase
      .from("volumes")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error || !data) {
      log.error("Failed to update volume", {
        error: error?.message,
        code: error?.code
      })
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

    emitReadingStatusEvent(supabase, {
      userId: user.id,
      entityId: id,
      prevStatus: prevReadingStatus,
      newStatus: data.reading_status,
      title: data.title,
      volumeNumber: data.volume_number
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

    if (!isValidUUID(id)) {
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
