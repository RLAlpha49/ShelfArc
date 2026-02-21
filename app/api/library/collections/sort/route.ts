import { type NextRequest } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiError, apiSuccess, getErrorMessage } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

export async function PUT(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      rateLimit: RATE_LIMITS.mutationWrite
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    const contentType = request.headers.get("content-type")
    if (!contentType?.includes("application/json")) {
      return apiError(
        415,
        "Unsupported Media Type: Expected application/json",
        {
          correlationId
        }
      )
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return apiError(400, "Invalid JSON in request body", { correlationId })
    }

    if (!Array.isArray(body)) {
      return apiError(400, "Expected array of { id, sort_order }", {
        correlationId
      })
    }

    const validated: { id: string; sort_order: number }[] = []
    for (const item of body as unknown[]) {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof (item as Record<string, unknown>).id !== "string" ||
        typeof (item as Record<string, unknown>).sort_order !== "number"
      ) {
        return apiError(
          400,
          "Invalid item in array: expected { id: string, sort_order: number }",
          {
            correlationId
          }
        )
      }
      validated.push({
        id: (item as Record<string, unknown>).id as string,
        sort_order: (item as Record<string, unknown>).sort_order as number
      })
    }

    if (validated.length === 0) {
      return apiSuccess({ updated: 0 }, { correlationId })
    }

    const updates = validated.map(({ id, sort_order }) =>
      supabase
        .from("collections")
        .update({ sort_order })
        .eq("id", id)
        .eq("user_id", user.id)
    )

    const results = await Promise.all(updates)
    const failed = results.filter((r) => r.error)
    if (failed.length > 0) {
      log.error("Failed to update collection sort orders", {
        count: failed.length,
        errors: failed.map((r) => r.error?.message)
      })
      return apiError(500, "Failed to update sort orders", { correlationId })
    }

    return apiSuccess({ updated: validated.length }, { correlationId })
  } catch (err) {
    log.error("PUT /api/library/collections/sort failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
