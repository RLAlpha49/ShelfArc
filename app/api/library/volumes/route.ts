import { type NextRequest } from "next/server"

import { recordActivityEvent } from "@/lib/activity/record-event"
import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import {
  apiError,
  apiSuccess,
  getErrorMessage,
  parseJsonBody
} from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import type { VolumeInsert } from "@/lib/types/database"
import { isNonNegativeFinite } from "@/lib/validation"
import { CreateVolumeSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      csrf: true,
      rateLimit: RATE_LIMITS.mutationWrite
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    const body = await parseJsonBody(request)
    if (body instanceof Response) return body

    const parsed = CreateVolumeSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const seriesId = parsed.data.series_id

    if (seriesId) {
      const { data: seriesExists } = await supabase
        .from("series")
        .select("id")
        .eq("id", seriesId)
        .eq("user_id", user.id)
        .single()

      if (!seriesExists) {
        return apiError(404, "Series not found", { correlationId })
      }
    }

    const payload = {
      ...parsed.data,
      series_id: seriesId,
      user_id: user.id
    } as VolumeInsert

    const { data, error } = await supabase
      .from("volumes")
      .insert(payload)
      .select()
      .single()

    if (error) {
      log.error("Failed to create volume", {
        error: error.message,
        code: error.code
      })
      return apiError(500, "Failed to create volume", { correlationId })
    }

    if (
      data.purchase_price != null &&
      isNonNegativeFinite(data.purchase_price) &&
      data.purchase_price > 0
    ) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", user.id)
        .single()
      const userCurrency = (
        profileData?.settings as Record<string, unknown> | null
      )?.priceDisplayCurrency
      const currency =
        typeof userCurrency === "string" && userCurrency.length === 3
          ? userCurrency.toUpperCase()
          : "USD"
      void supabase.from("price_history").insert({
        volume_id: data.id,
        user_id: user.id,
        price: data.purchase_price,
        currency,
        source: "manual",
        product_url: data.amazon_url ?? null
      })
    }

    void recordActivityEvent(supabase, {
      userId: user.id,
      eventType: "volume_added",
      entityType: "volume",
      entityId: data.id,
      metadata: {
        title: data.title,
        volumeNumber: data.volume_number
      }
    })

    return apiSuccess(data, { correlationId, status: 201 })
  } catch (err) {
    log.error("POST /api/library/volumes failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
