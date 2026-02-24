import { type NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
import { AutomationSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return apiError(401, "Not authenticated", { correlationId })

    const rl = await consumeDistributedRateLimit({
      key: `automations-read:${user.id}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit automation reads"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const { data, error } = await supabase
      .from("automations")
      .select(
        "id, name, trigger_type, conditions, actions, enabled, last_triggered_at, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      log.error("Failed to fetch automations", { error: error.message })
      return apiError(500, "Failed to fetch automations", { correlationId })
    }

    return apiSuccess({ data: data ?? [] }, { correlationId })
  } catch (error) {
    log.error("Automations fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch automations", { correlationId })
  }
}

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

    const parsed = AutomationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const { name, trigger_type, conditions, actions, enabled } = parsed.data

    const { data, error } = await supabase
      .from("automations")
      .insert({
        user_id: user.id,
        name,
        trigger_type,
        conditions,
        actions,
        enabled
      })
      .select()
      .single()

    if (error) {
      log.error("Failed to create automation", { error: error.message })
      return apiError(500, "Failed to create automation", { correlationId })
    }

    return apiSuccess(data, { correlationId, status: 201 })
  } catch (error) {
    log.error("Automation creation failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to create automation", { correlationId })
  }
}
