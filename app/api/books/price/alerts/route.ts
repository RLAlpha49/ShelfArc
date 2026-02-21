import { NextRequest, NextResponse } from "next/server"

import { recordActivityEvent } from "@/lib/activity/record-event"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
import {
  PriceAlertSchema,
  UpdatePriceAlertSchema
} from "@/lib/validation/schemas"

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
      key: `alert-read:${user.id}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit price alert reads"
    })
    if (rl && !rl.allowed)
      return apiError(429, "Too many requests", { correlationId })

    const volumeId = request.nextUrl.searchParams.get("volumeId")

    let query = supabase.from("price_alerts").select("*").eq("user_id", user.id)

    if (volumeId) {
      query = query.eq("volume_id", volumeId)
    }

    const { data, error } = await query.order("created_at", {
      ascending: false
    })

    if (error)
      return apiError(500, "Failed to fetch price alerts", { correlationId })
    return apiSuccess({ data }, { correlationId })
  } catch (error) {
    log.error("Price alerts fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch price alerts", { correlationId })
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

    const rlPost = await consumeDistributedRateLimit({
      key: `alert-write:${user.id}`,
      maxHits: 30,
      windowMs: 60_000,
      cooldownMs: 60_000,
      reason: "Rate limit price alert writes"
    })
    if (rlPost && !rlPost.allowed)
      return apiError(429, "Too many requests", { correlationId })

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const parsed = PriceAlertSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }
    const validated = parsed.data

    // Verify the volume belongs to the authenticated user before creating/updating alert
    const { data: volume } = await supabase
      .from("volumes")
      .select("id")
      .eq("id", validated.volumeId)
      .eq("user_id", user.id)
      .single()

    if (!volume) {
      return apiError(404, "Volume not found", { correlationId })
    }

    const { data, error } = await supabase
      .from("price_alerts")
      .upsert(
        {
          volume_id: validated.volumeId,
          user_id: user.id,
          target_price: validated.targetPrice,
          currency: validated.currency,
          ...(validated.enabled !== undefined && {
            enabled: validated.enabled
          })
        },
        { onConflict: "volume_id,user_id" }
      )
      .select()
      .single()

    if (error)
      return apiError(500, "Failed to save price alert", { correlationId })
    return apiSuccess({ data }, { correlationId })
  } catch (error) {
    log.error("Price alert save failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to save price alert")
  }
}

const ALLOWED_SNOOZE_DAYS = [7, 30] as const
type AllowedSnoozeDays = (typeof ALLOWED_SNOOZE_DAYS)[number]

function computeSnoozedUntil(
  snoozeDays: unknown
): { ok: true; value: string | null } | { ok: false } {
  const isClear = snoozeDays === 0 || snoozeDays === null
  if (isClear) return { ok: true, value: null }
  if (!ALLOWED_SNOOZE_DAYS.includes(snoozeDays as AllowedSnoozeDays)) {
    return { ok: false }
  }
  const date = new Date()
  date.setDate(date.getDate() + (snoozeDays as number))
  return { ok: true, value: date.toISOString() }
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

    const rlPatch = await consumeDistributedRateLimit({
      key: `alert-write:${user.id}`,
      maxHits: 30,
      windowMs: 60_000,
      cooldownMs: 60_000,
      reason: "Rate limit price alert writes"
    })
    if (rlPatch && !rlPatch.allowed)
      return apiError(429, "Too many requests", { correlationId })

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const parsed = UpdatePriceAlertSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const { id, snooze_days } = parsed.data

    // Snooze mode: snooze_days key present in body
    if ("snooze_days" in body) {
      const result = computeSnoozedUntil(snooze_days)
      if (!result.ok) {
        return apiError(400, "snooze_days must be 7, 30, 0, or null", {
          correlationId
        })
      }

      const { data, error } = await supabase
        .from("price_alerts")
        .update({ snoozed_until: result.value })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single()

      if (error)
        return apiError(500, "Failed to snooze price alert", { correlationId })
      return apiSuccess({ data }, { correlationId })
    }

    // Trigger mode (existing behaviour)
    const { data, error } = await supabase
      .from("price_alerts")
      .update({
        triggered_at: new Date().toISOString(),
        enabled: false
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error)
      return apiError(500, "Failed to trigger price alert", { correlationId })

    void recordActivityEvent(supabase, {
      userId: user.id,
      eventType: "price_alert_triggered",
      entityType: "volume",
      entityId: data.volume_id,
      metadata: {
        alertId: id,
        targetPrice: data.target_price,
        currency: data.currency
      }
    })

    return apiSuccess({ data }, { correlationId })
  } catch (error) {
    log.error("Price alert patch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to update price alert")
  }
}

export async function DELETE(request: NextRequest) {
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

    const rlDelete = await consumeDistributedRateLimit({
      key: `alert-write:${user.id}`,
      maxHits: 30,
      windowMs: 60_000,
      cooldownMs: 60_000,
      reason: "Rate limit price alert writes"
    })
    if (rlDelete && !rlDelete.allowed)
      return apiError(429, "Too many requests", { correlationId })

    const id = request.nextUrl.searchParams.get("id")
    if (!id) return apiError(400, "id is required", { correlationId })

    const { error } = await supabase
      .from("price_alerts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error)
      return apiError(500, "Failed to delete price alert", { correlationId })
    return apiSuccess({ success: true }, { correlationId })
  } catch (error) {
    log.error("Price alert delete failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to delete price alert")
  }
}
