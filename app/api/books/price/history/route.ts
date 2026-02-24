import { NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
import { PriceHistorySchema } from "@/lib/validation/schemas"

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
      .select("id, volume_id, price, currency, source, product_url, scraped_at")
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

    const parsed = PriceHistorySchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }
    const validated = parsed.data

    const today = new Date().toISOString().split("T")[0]
    const { data: existing } = await supabase
      .from("price_history")
      .select("id, volume_id, price, currency, source, product_url, scraped_at")
      .eq("volume_id", validated.volumeId)
      .eq("user_id", user.id)
      .gte("scraped_at", today)
      .single()

    if (existing) {
      return apiSuccess({ data: existing }, { correlationId })
    }

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
