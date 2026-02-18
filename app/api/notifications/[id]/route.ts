import { type NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfResult = enforceSameOrigin(request)
  if (csrfResult) return csrfResult

  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return apiError(401, "Not authenticated", { correlationId })

    const rl = await consumeDistributedRateLimit({
      key: `notifications-write:${user.id}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit notification updates"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const { id } = await params

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    if (typeof body.read !== "boolean") {
      return apiError(400, "Field 'read' must be a boolean", { correlationId })
    }

    const { data, error } = await supabase
      .from("notifications")
      .update({ read: body.read })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      log.error("Failed to update notification", { error: error.message })
      return apiError(404, "Notification not found", { correlationId })
    }

    return apiSuccess(data, { correlationId })
  } catch (error) {
    log.error("Notification update failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to update notification", { correlationId })
  }
}
