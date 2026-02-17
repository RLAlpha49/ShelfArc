import { type NextRequest } from "next/server"
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
import {
  isValidOwnershipStatus,
  isValidReadingStatus,
  isNonNegativeFinite
} from "@/lib/validation"

export const dynamic = "force-dynamic"

const MAX_BATCH_SIZE = 200

const isValidRating = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 10

type BatchValidation =
  | { ok: true; volumeIds: string[]; updatePayload: Record<string, unknown> }
  | { ok: false; message: string }

function validateBatchInput(body: Record<string, unknown>): BatchValidation {
  const { volumeIds, updates } = body

  if (!Array.isArray(volumeIds) || volumeIds.length === 0) {
    return { ok: false, message: "volumeIds must be a non-empty array" }
  }
  if (volumeIds.length > MAX_BATCH_SIZE) {
    return { ok: false, message: `Maximum batch size is ${MAX_BATCH_SIZE}` }
  }
  if (
    !volumeIds.every(
      (id: unknown) => typeof id === "string" && id.trim().length > 0
    )
  ) {
    return { ok: false, message: "All volumeIds must be non-empty strings" }
  }
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    return { ok: false, message: "updates must be a JSON object" }
  }

  const updatePayload = buildUpdatePayload(updates as Record<string, unknown>)
  if (typeof updatePayload === "string") {
    return { ok: false, message: updatePayload }
  }

  return { ok: true, volumeIds: volumeIds as string[], updatePayload }
}

function buildUpdatePayload(
  raw: Record<string, unknown>
): Record<string, unknown> | string {
  const payload: Record<string, unknown> = {}

  if (Object.hasOwn(raw, "ownership_status")) {
    if (!isValidOwnershipStatus(raw.ownership_status)) {
      return "Invalid ownership_status"
    }
    payload.ownership_status = raw.ownership_status
  }
  if (Object.hasOwn(raw, "reading_status")) {
    if (!isValidReadingStatus(raw.reading_status)) {
      return "Invalid reading_status"
    }
    payload.reading_status = raw.reading_status
  }
  if (Object.hasOwn(raw, "rating")) {
    if (raw.rating !== null && !isValidRating(raw.rating)) {
      return "Invalid rating (must be 0-10 or null)"
    }
    payload.rating = raw.rating
  }
  if (Object.hasOwn(raw, "purchase_price")) {
    if (
      raw.purchase_price !== null &&
      !isNonNegativeFinite(raw.purchase_price)
    ) {
      return "Invalid purchase_price"
    }
    payload.purchase_price = raw.purchase_price
  }

  if (Object.keys(payload).length === 0) {
    return "No valid update fields provided"
  }
  return payload
}

export async function PATCH(request: NextRequest) {
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

    const validation = validateBatchInput(body)
    if (!validation.ok) {
      return apiError(400, validation.message, { correlationId })
    }

    const { data, error } = await supabase
      .from("volumes")
      .update(validation.updatePayload)
      .in("id", validation.volumeIds)
      .eq("user_id", user.id)
      .select("id")

    if (error) {
      return apiError(400, "Batch update failed", {
        correlationId,
        details: error.message
      })
    }

    return apiSuccess(
      {
        updated: data?.length ?? 0,
        requested: validation.volumeIds.length
      },
      { correlationId }
    )
  } catch (err) {
    log.error("PATCH /api/library/volumes/batch failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
