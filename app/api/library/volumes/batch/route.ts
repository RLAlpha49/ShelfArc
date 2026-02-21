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
import { createAdminClient } from "@/lib/supabase/admin"
import type { Volume } from "@/lib/types/database"
import { BatchUpdateVolumesSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

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

    const parsed = BatchUpdateVolumesSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const { volume_ids: volumeIds, updates: updatePayload } = parsed.data

    if (Object.keys(updatePayload).length === 0) {
      return apiError(400, "No valid update fields provided", { correlationId })
    }

    const { data, error } = await supabase
      .from("volumes")
      .update(updatePayload as Partial<Volume>)
      .in("id", volumeIds)
      .eq("user_id", user.id)
      .select("id")

    if (error) {
      return apiError(400, "Batch update failed", {
        correlationId,
        details: error.message
      })
    }

    const updated = data?.length ?? 0

    if (updated > 0) {
      void recordActivityEvent(supabase, {
        userId: user.id,
        eventType: "volume_updated",
        entityType: "batch",
        entityId: null,
        metadata: {
          count: updated,
          updates: updatePayload as Record<
            string,
            string | number | boolean | null
          >
        }
      })
    }

    // Use admin client to count how many of the requested IDs exist in the DB
    // regardless of ownership (bypasses RLS), then derive notFound and forbidden.
    const admin = createAdminClient({
      reason: "Batch volume PATCH - count existing IDs",
      caller: "PATCH /api/library/volumes/batch"
    })
    const { count: existsCount } = await admin
      .from("volumes")
      .select("id", { count: "exact", head: true })
      .in("id", volumeIds)

    const totalExists = existsCount ?? 0
    const notFound = volumeIds.length - totalExists
    const forbidden = totalExists - updated

    return apiSuccess({ updated, notFound, forbidden }, { correlationId })
  } catch (err) {
    log.error("PATCH /api/library/volumes/batch failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
