import { NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { apiError } from "@/lib/api-response"
import { enforceSameOrigin } from "@/lib/csrf"
import { isNonNegativeFinite, isValidAmazonUrl } from "@/lib/validation"
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
    if (!volumeId) return apiError(400, "volumeId is required")

    const { data, error } = await supabase
      .from("price_history")
      .select("*")
      .eq("volume_id", volumeId)
      .eq("user_id", user.id)
      .order("scraped_at", { ascending: false })
      .limit(100)

    if (error) return apiError(500, "Failed to fetch price history")
    const response = NextResponse.json({ data })
    response.headers.set(CORRELATION_HEADER, correlationId)
    return response
  } catch (error) {
    log.error("Price history fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch price history")
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
    const { volumeId, price, currency, source, productUrl } = body

    if (typeof volumeId !== "string" || !volumeId.trim()) {
      return apiError(400, "volumeId is required")
    }
    if (!isNonNegativeFinite(price) || price <= 0) {
      return apiError(400, "price must be a positive number")
    }

    const { data, error } = await supabase
      .from("price_history")
      .insert({
        volume_id: volumeId,
        user_id: user.id,
        price,
        currency:
          typeof currency === "string" && currency.trim()
            ? currency.trim()
            : "USD",
        source:
          typeof source === "string" && source.trim()
            ? source.trim()
            : "amazon",
        product_url:
          typeof productUrl === "string" &&
          productUrl.trim() &&
          isValidAmazonUrl(productUrl.trim())
            ? productUrl.trim()
            : null
      })
      .select()
      .single()

    if (error) return apiError(500, "Failed to save price history")
    const response = NextResponse.json({ data })
    response.headers.set(CORRELATION_HEADER, correlationId)
    return response
  } catch (error) {
    log.error("Price history save failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to save price history")
  }
}
