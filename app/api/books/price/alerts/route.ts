import { NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { enforceSameOrigin } from "@/lib/csrf"
import { isNonNegativeFinite, isValidCurrencyCode } from "@/lib/validation"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"

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

type ValidatedAlert = {
  volumeId: string
  targetPrice: number
  currency: string
  enabled: boolean | undefined
}

const validateAlertBody = (
  body: Record<string, unknown>
): ValidatedAlert | NextResponse => {
  const { volumeId, targetPrice, currency, enabled } = body

  if (typeof volumeId !== "string" || !volumeId.trim()) {
    return apiError(400, "volumeId is required")
  }
  if (!isNonNegativeFinite(targetPrice) || targetPrice <= 0) {
    return apiError(400, "targetPrice must be a positive number")
  }
  if (currency !== undefined && currency !== null) {
    if (
      typeof currency !== "string" ||
      !isValidCurrencyCode(currency.trim().toUpperCase())
    ) {
      return apiError(400, "currency must be a 3-letter ISO currency code")
    }
  }
  if (enabled !== undefined && typeof enabled !== "boolean") {
    return apiError(400, "enabled must be a boolean")
  }

  return {
    volumeId,
    targetPrice,
    currency:
      typeof currency === "string" && currency.trim()
        ? currency.trim().toUpperCase()
        : "USD",
    enabled: typeof enabled === "boolean" ? enabled : undefined
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

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const validated = validateAlertBody(body)
    if (validated instanceof NextResponse) return validated

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

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const { id } = body
    if (typeof id !== "string" || !id.trim()) {
      return apiError(400, "id is required", { correlationId })
    }

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
    return apiSuccess({ data }, { correlationId })
  } catch (error) {
    log.error("Price alert trigger failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to trigger price alert")
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
