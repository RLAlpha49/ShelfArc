import { type NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { CORRELATION_HEADER, getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { UpdateNotificationSchema } from "@/lib/validation/schemas"

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

    if (!isValidUUID(id)) {
      return apiError(400, "Invalid notification id", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const parsed = UpdateNotificationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const { data, error } = await supabase
      .from("notifications")
      .update({ read: parsed.data.read })
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

export async function DELETE(
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
      reason: "Rate limit notification deletes"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const { id } = await params

    if (!isValidUUID(id)) {
      return apiError(400, "Invalid notification id", { correlationId })
    }

    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      log.error("Failed to delete notification", { error: error.message })
      return apiError(404, "Notification not found", { correlationId })
    }

    void data
    return new NextResponse(null, {
      status: 204,
      headers: { [CORRELATION_HEADER]: correlationId }
    })
  } catch (error) {
    log.error("Notification delete failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to delete notification", { correlationId })
  }
}
