import { NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { apiError } from "@/lib/api-response"
import { enforceSameOrigin } from "@/lib/csrf"
import { isNonNegativeFinite } from "@/lib/validation"
import { getCorrelationId, CORRELATION_HEADER } from "@/lib/correlation"
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
    if (!user) return apiError(401, "Not authenticated")

    const volumeId = request.nextUrl.searchParams.get("volumeId")

    let query = supabase.from("price_alerts").select("*").eq("user_id", user.id)

    if (volumeId) {
      query = query.eq("volume_id", volumeId)
    }

    const { data, error } = await query.order("created_at", {
      ascending: false
    })

    if (error) return apiError(500, "Failed to fetch price alerts")
    const response = NextResponse.json({ data })
    response.headers.set(CORRELATION_HEADER, correlationId)
    return response
  } catch (error) {
    log.error("Price alerts fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch price alerts")
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
    if (!user) return apiError(401, "Not authenticated")

    const body = await request.json()
    const { volumeId, targetPrice, currency } = body

    if (typeof volumeId !== "string" || !volumeId.trim()) {
      return apiError(400, "volumeId is required")
    }
    if (!isNonNegativeFinite(targetPrice) || targetPrice <= 0) {
      return apiError(400, "targetPrice must be a positive number")
    }

    const { data, error } = await supabase
      .from("price_alerts")
      .upsert(
        {
          volume_id: volumeId,
          user_id: user.id,
          target_price: targetPrice,
          currency:
            typeof currency === "string" && currency.trim()
              ? currency.trim()
              : "USD"
        },
        { onConflict: "volume_id,user_id" }
      )
      .select()
      .single()

    if (error) return apiError(500, "Failed to save price alert")
    const response = NextResponse.json({ data })
    response.headers.set(CORRELATION_HEADER, correlationId)
    return response
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
    if (!user) return apiError(401, "Not authenticated")

    const body = await request.json()
    const { id } = body

    if (typeof id !== "string" || !id.trim()) {
      return apiError(400, "id is required")
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

    if (error) return apiError(500, "Failed to trigger price alert")
    const response = NextResponse.json({ data })
    response.headers.set(CORRELATION_HEADER, correlationId)
    return response
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
    if (!user) return apiError(401, "Not authenticated")

    const id = request.nextUrl.searchParams.get("id")
    if (!id) return apiError(400, "id is required")

    const { error } = await supabase
      .from("price_alerts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) return apiError(500, "Failed to delete price alert")
    const response = NextResponse.json({ success: true })
    response.headers.set(CORRELATION_HEADER, correlationId)
    return response
  } catch (error) {
    log.error("Price alert delete failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to delete price alert")
  }
}
