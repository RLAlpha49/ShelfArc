import { NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
import {
  isNonNegativeFinite,
  isValidAmazonUrl,
  isValidCurrencyCode
} from "@/lib/validation"

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
      key: `history-read:${user.id}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit price history reads"
    })
    if (rl && !rl.allowed)
      return apiError(429, "Too many requests", { correlationId })

    const volumeId = request.nextUrl.searchParams.get("volumeId")
    if (!volumeId)
      return apiError(400, "volumeId is required", { correlationId })

    const { data, error } = await supabase
      .from("price_history")
      .select("*")
      .eq("volume_id", volumeId)
      .eq("user_id", user.id)
      .order("scraped_at", { ascending: false })
      .limit(100)

    if (error)
      return apiError(500, "Failed to fetch price history", { correlationId })
    return apiSuccess({ data }, { correlationId })
  } catch (error) {
    log.error("Price history fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch price history", { correlationId })
  }
}

type ValidatedHistory = {
  volumeId: string
  price: number
  currency: string
  source: string
  productUrl: string | null
}

const resolveOptionalCurrency = (value: unknown): string | NextResponse => {
  if (value === undefined || value === null) return "USD"
  if (
    typeof value !== "string" ||
    !isValidCurrencyCode(value.trim().toUpperCase())
  ) {
    return apiError(400, "currency must be a 3-letter ISO currency code")
  }
  return value.trim().toUpperCase()
}

const VALID_SOURCES = new Set(["amazon", "manual", "imported"])

const resolveOptionalSource = (value: unknown): string | NextResponse => {
  if (value === undefined || value === null) return "amazon"
  if (typeof value !== "string" || !VALID_SOURCES.has(value.trim())) {
    return apiError(400, "source must be one of: amazon, manual, imported")
  }
  return value.trim()
}

const resolveOptionalProductUrl = (
  value: unknown
): string | null | NextResponse => {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") {
    return apiError(400, "productUrl must be a string")
  }
  if (!value.trim()) return null
  if (!isValidAmazonUrl(value.trim())) {
    return apiError(400, "productUrl must be a valid Amazon URL")
  }
  return value.trim()
}

const validateHistoryBody = (
  body: Record<string, unknown>
): ValidatedHistory | NextResponse => {
  const { volumeId, price } = body

  if (typeof volumeId !== "string" || !volumeId.trim()) {
    return apiError(400, "volumeId is required")
  }
  if (!isNonNegativeFinite(price) || price <= 0) {
    return apiError(400, "price must be a positive number")
  }

  const currency = resolveOptionalCurrency(body.currency)
  if (currency instanceof NextResponse) return currency

  const source = resolveOptionalSource(body.source)
  if (source instanceof NextResponse) return source

  const productUrl = resolveOptionalProductUrl(body.productUrl)
  if (productUrl instanceof NextResponse) return productUrl

  return { volumeId, price, currency, source, productUrl }
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
      key: `history-write:${user.id}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit price history writes"
    })
    if (rl && !rl.allowed)
      return apiError(429, "Too many requests", { correlationId })

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const validated = validateHistoryBody(body)
    if (validated instanceof NextResponse) return validated

    const { data, error } = await supabase
      .from("price_history")
      .insert({
        volume_id: validated.volumeId,
        user_id: user.id,
        price: validated.price,
        currency: validated.currency,
        source: validated.source,
        product_url: validated.productUrl
      })
      .select()
      .single()

    if (error)
      return apiError(500, "Failed to save price history", { correlationId })
    return apiSuccess({ data }, { correlationId })
  } catch (error) {
    log.error("Price history save failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to save price history")
  }
}
