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
import { isValidUUID } from "@/lib/validation"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      rateLimit: RATE_LIMITS.mutationWrite
    })
    if (!result.ok) return result.error
    const { user, supabase } = result
    const { id } = await params

    const body = await parseJsonBody(request)
    if (body instanceof Response) return body

    const { volumeIds } = body as { volumeIds?: unknown }
    if (!Array.isArray(volumeIds) || volumeIds.length === 0) {
      return apiError(400, "volumeIds must be a non-empty array", {
        correlationId
      })
    }

    const invalidIds = (volumeIds as unknown[]).filter(
      (v) => typeof v !== "string" || !isValidUUID(v)
    )
    if (invalidIds.length > 0) {
      return apiError(400, "All volumeIds must be valid UUIDs", {
        correlationId
      })
    }

    const rows = (volumeIds as string[]).map((volumeId) => ({
      collection_id: id,
      volume_id: volumeId,
      user_id: user.id
    }))

    const { error } = await supabase
      .from("collection_volumes")
      .upsert(rows, {
        onConflict: "collection_id,volume_id",
        ignoreDuplicates: true
      })

    if (error) {
      log.error("Failed to add volumes to collection", {
        error: error.message
      })
      return apiError(500, "Failed to add volumes to collection", {
        correlationId
      })
    }

    return apiSuccess({ ok: true }, { correlationId })
  } catch (err) {
    log.error("POST /api/library/collections/[id]/volumes failed", {
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
      rateLimit: RATE_LIMITS.mutationWrite
    })
    if (!result.ok) return result.error
    const { user, supabase } = result
    const { id } = await params

    const body = await parseJsonBody(request)
    if (body instanceof Response) return body

    const { volumeIds } = body as { volumeIds?: unknown }
    if (!Array.isArray(volumeIds) || volumeIds.length === 0) {
      return apiError(400, "volumeIds must be a non-empty array", {
        correlationId
      })
    }

    const invalidIds = (volumeIds as unknown[]).filter(
      (v) => typeof v !== "string" || !isValidUUID(v)
    )
    if (invalidIds.length > 0) {
      return apiError(400, "All volumeIds must be valid UUIDs", {
        correlationId
      })
    }

    const { error } = await supabase
      .from("collection_volumes")
      .delete()
      .eq("collection_id", id)
      .eq("user_id", user.id)
      .in("volume_id", volumeIds as string[])

    if (error) {
      log.error("Failed to remove volumes from collection", {
        error: error.message
      })
      return apiError(500, "Failed to remove volumes from collection", {
        correlationId
      })
    }

    return apiSuccess({ ok: true }, { correlationId })
  } catch (err) {
    log.error("DELETE /api/library/collections/[id]/volumes failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
