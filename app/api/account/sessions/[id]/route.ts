import { type NextRequest } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { isValidUUID } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfResult = enforceSameOrigin(request)
  if (csrfResult) return csrfResult

  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const { id: sessionId } = await params

    if (!isValidUUID(sessionId)) {
      return apiError(400, "Invalid session id", { correlationId })
    }

    const routeResult = await protectedRoute(request, {
      rateLimit: RATE_LIMITS.sessionsRevoke
    })
    if (!routeResult.ok) return routeResult.error
    const { user } = routeResult

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SECRET_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      log.error("Missing Supabase env vars for session revocation")
      return apiError(500, "Server configuration error", { correlationId })
    }

    // The URL scopes the delete to the authenticated user's sessions only,
    // ensuring a user can never revoke another user's session.
    const response = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${user.id}/sessions/${sessionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey
        }
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return apiError(404, "Session not found", { correlationId })
      }
      log.error("GoTrue session revocation failed", {
        status: response.status,
        sessionId
      })
      return apiError(500, "Failed to revoke session", { correlationId })
    }

    log.info("Session revoked", { userId: user.id, sessionId })
    return apiSuccess({ revoked: true }, { correlationId })
  } catch (error) {
    log.error("Session revocation failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to revoke session", { correlationId })
  }
}
