import { type NextRequest } from "next/server"

import { apiError, apiSuccess } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
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
      maxHits: 10,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit mark-all-read"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)

    if (error) {
      log.error("Failed to mark all notifications read", {
        error: error.message
      })
      return apiError(500, "Failed to mark all notifications read", {
        correlationId
      })
    }

    return apiSuccess({ updated: true }, { correlationId })
  } catch (error) {
    log.error("Mark all notifications read failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to mark all notifications read", {
      correlationId
    })
  }
}
