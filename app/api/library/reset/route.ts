import { type NextRequest, NextResponse } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiError, getErrorMessage } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const CONFIRM_PHRASE = "DELETE MY COLLECTION"

export async function DELETE(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      csrf: true,
      rateLimit: RATE_LIMITS.collectionReset
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    // Validate confirmation phrase from request body
    let confirmText = ""
    try {
      const body: unknown = await request.json()
      if (body && typeof body === "object" && !Array.isArray(body)) {
        const b = body as Record<string, unknown>
        confirmText = typeof b.confirmText === "string" ? b.confirmText : ""
      }
    } catch {
      return apiError(400, "Invalid JSON in request body", { correlationId })
    }

    if (confirmText !== CONFIRM_PHRASE) {
      return apiError(400, `You must type "${CONFIRM_PHRASE}" to confirm`, {
        correlationId
      })
    }

    // Atomic reset: deletes volumes then series inside a single Postgres transaction
    // via the reset_user_library() RPC, so no partial state is possible if
    // either delete fails.
    const { error: resetError } = await supabase.rpc("reset_user_library")

    if (resetError) {
      log.error("Failed to reset user library", {
        userId: user.id,
        error: resetError.message
      })
      return apiError(500, "Failed to reset collection", { correlationId })
    }

    log.info("Collection reset", { userId: user.id })

    return new NextResponse(null, {
      status: 204,
      headers: correlationId ? { "x-correlation-id": correlationId } : {}
    })
  } catch (err) {
    log.error("DELETE /api/library/reset failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
