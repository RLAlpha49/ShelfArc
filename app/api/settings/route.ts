import { type NextRequest, NextResponse } from "next/server"

import { recordActivityEvent } from "@/lib/activity/record-event"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
import { SettingsSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

const MAX_SETTINGS_SIZE = 10_240 // 10 KB

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
      key: `settings-read:${user.id}`,
      maxHits: 30,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit settings reads"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single()

    if (error) {
      log.error("Failed to fetch settings", {
        error: error.message
      })
      return apiError(500, "Failed to fetch settings", { correlationId })
    }

    return apiSuccess({ settings: data?.settings ?? {} }, { correlationId })
  } catch (error) {
    log.error("Settings fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch settings", { correlationId })
  }
}

export async function PATCH(request: NextRequest) {
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
      key: `settings-write:${user.id}`,
      maxHits: 20,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit settings writes"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const parsed = SettingsSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const incoming = parsed.data.settings

    // Fetch current settings for shallow merge
    const { data: existing, error: fetchError } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single()

    if (fetchError) {
      log.error("Failed to fetch existing settings", {
        error: fetchError.message
      })
      return apiError(500, "Failed to update settings", { correlationId })
    }

    const merged = {
      ...(existing?.settings && typeof existing.settings === "object"
        ? existing.settings
        : {}),
      ...incoming
    }

    if (JSON.stringify(merged).length > MAX_SETTINGS_SIZE) {
      return apiError(400, "Settings payload exceeds 10 KB limit", {
        correlationId
      })
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ settings: merged })
      .eq("id", user.id)

    if (updateError) {
      log.error("Failed to update settings", {
        error: updateError.message
      })
      return apiError(500, "Failed to update settings", { correlationId })
    }

    void recordActivityEvent(supabase, {
      userId: user.id,
      eventType: "settings_updated",
      entityType: "profile",
      entityId: user.id,
      metadata: { changedKeys: Object.keys(incoming) }
    })

    return apiSuccess({ settings: merged }, { correlationId })
  } catch (error) {
    log.error("Settings update failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to update settings", { correlationId })
  }
}
