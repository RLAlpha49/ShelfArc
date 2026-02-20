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

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

    const update: Record<string, string> = {}
    if (typeof body.name === "string" && body.name.trim()) {
      update.name = body.name.trim().slice(0, 50)
    }
    if (typeof body.color === "string") {
      update.color = body.color
    }

    if (Object.keys(update).length === 0) {
      return apiError(400, "No valid fields to update", { correlationId })
    }

    const { error } = await supabase
      .from("collections")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      log.error("Failed to update collection", { error: error.message })
      return apiError(500, "Failed to update collection", { correlationId })
    }

    return apiSuccess({ ok: true }, { correlationId })
  } catch (err) {
    log.error("PATCH /api/library/collections/[id] failed", {
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

    const { data: collection, error: fetchError } = await supabase
      .from("collections")
      .select("id, is_system")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (fetchError || !collection) {
      return apiError(404, "Collection not found", { correlationId })
    }

    if (collection.is_system) {
      return apiError(403, "Cannot delete system collections", {
        correlationId
      })
    }

    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      log.error("Failed to delete collection", { error: error.message })
      return apiError(500, "Failed to delete collection", { correlationId })
    }

    return apiSuccess({ ok: true }, { correlationId })
  } catch (err) {
    log.error("DELETE /api/library/collections/[id] failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
