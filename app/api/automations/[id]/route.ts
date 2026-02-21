import { type NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
import { isValidUUID } from "@/lib/validation"
import { UpdateAutomationSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const csrfResult = enforceSameOrigin(request)
  if (csrfResult) return csrfResult

  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  const { id } = await params
  if (!isValidUUID(id)) {
    return apiError(400, "Invalid automation ID", { correlationId })
  }

  try {
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return apiError(401, "Not authenticated", { correlationId })

    const rl = await consumeDistributedRateLimit({
      key: `automations-write:${user.id}`,
      maxHits: 20,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit automation writes"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const parsed = UpdateAutomationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const updates = parsed.data
    if (Object.keys(updates).length === 0) {
      return apiError(400, "No fields to update", { correlationId })
    }

    const { data, error } = await supabase
      .from("automations")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      log.error("Failed to update automation", { error: error.message, id })
      return apiError(500, "Failed to update automation", { correlationId })
    }

    if (!data) {
      return apiError(404, "Automation not found", { correlationId })
    }

    return apiSuccess(data, { correlationId })
  } catch (error) {
    log.error("Automation update failed", {
      error: error instanceof Error ? error.message : String(error),
      id
    })
    return apiError(500, "Failed to update automation", { correlationId })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const csrfResult = enforceSameOrigin(request)
  if (csrfResult) return csrfResult

  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  const { id } = await params
  if (!isValidUUID(id)) {
    return apiError(400, "Invalid automation ID", { correlationId })
  }

  try {
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return apiError(401, "Not authenticated", { correlationId })

    const rl = await consumeDistributedRateLimit({
      key: `automations-write:${user.id}`,
      maxHits: 20,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit automation writes"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const { error } = await supabase
      .from("automations")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) {
      log.error("Failed to delete automation", { error: error.message, id })
      return apiError(500, "Failed to delete automation", { correlationId })
    }

    return apiSuccess({ deleted: true }, { correlationId })
  } catch (error) {
    log.error("Automation deletion failed", {
      error: error instanceof Error ? error.message : String(error),
      id
    })
    return apiError(500, "Failed to delete automation", { correlationId })
  }
}
