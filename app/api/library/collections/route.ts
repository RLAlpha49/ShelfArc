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
import { CreateCollectionSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      rateLimit: RATE_LIMITS.libraryRead
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    const { data: cols, error } = await supabase
      .from("collections")
      .select(
        `
        id, name, color, is_system, sort_order, created_at,
        collection_volumes(volume_id)
      `
      )
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })

    if (error) {
      log.error("Failed to fetch collections", { error: error.message })
      return apiError(500, "Failed to fetch collections", { correlationId })
    }

    const collections = (cols ?? []).map((col) => {
      return {
        id: col.id,
        name: col.name,
        color: col.color,
        isSystem: col.is_system,
        createdAt: col.created_at,
        sortOrder: col.sort_order,
        volumeIds: (col.collection_volumes ?? []).map(
          (v: { volume_id: string }) => v.volume_id
        )
      }
    })

    return apiSuccess({ collections }, { correlationId })
  } catch (err) {
    log.error("GET /api/library/collections failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}

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

    const parsed = CreateCollectionSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const { id, name, color, isSystem, createdAt, sortOrder } = parsed.data

    const { error } = await supabase.from("collections").upsert(
      {
        id,
        user_id: user.id,
        name,
        color: color ?? "#4682b4",
        is_system: isSystem,
        created_at: createdAt ?? new Date().toISOString(),
        sort_order: sortOrder
      },
      { onConflict: "id" }
    )

    if (error) {
      log.error("Failed to upsert collection", {
        error: error.message,
        code: error.code
      })
      return apiError(500, "Failed to create collection", { correlationId })
    }

    return apiSuccess({ id }, { correlationId })
  } catch (err) {
    log.error("POST /api/library/collections failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
