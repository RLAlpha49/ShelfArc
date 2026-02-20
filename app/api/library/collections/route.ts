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
      .select("id, name, color, is_system, created_at, sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })

    if (error) {
      log.error("Failed to fetch collections", { error: error.message })
      return apiError(500, "Failed to fetch collections", { correlationId })
    }

    const collections = await Promise.all(
      (cols ?? []).map(async (col) => {
        const { data: vols } = await supabase
          .from("collection_volumes")
          .select("volume_id")
          .eq("collection_id", col.id)
          .eq("user_id", user.id)

        return {
          id: col.id,
          name: col.name,
          color: col.color,
          isSystem: col.is_system,
          createdAt: col.created_at,
          sortOrder: col.sort_order,
          volumeIds: (vols ?? []).map((v) => v.volume_id)
        }
      })
    )

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
      rateLimit: RATE_LIMITS.mutationWrite
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    const body = await parseJsonBody(request)
    if (body instanceof Response) return body

    const { id, name, color, isSystem, createdAt, sortOrder } = body as {
      id?: unknown
      name?: unknown
      color?: unknown
      isSystem?: unknown
      createdAt?: unknown
      sortOrder?: unknown
    }

    if (typeof id !== "string" || !id.trim()) {
      return apiError(400, "id is required", { correlationId })
    }

    const trimmedName = typeof name === "string" ? name.trim() : ""
    if (!trimmedName || trimmedName.length > 50) {
      return apiError(400, "Name must be a non-empty string of max 50 chars", {
        correlationId
      })
    }

    const { error } = await supabase.from("collections").upsert(
      {
        id: id.trim(),
        user_id: user.id,
        name: trimmedName,
        color: typeof color === "string" ? color : "#4682b4",
        is_system: isSystem === true,
        created_at:
          typeof createdAt === "string" ? createdAt : new Date().toISOString(),
        sort_order: typeof sortOrder === "number" ? sortOrder : 0
      },
      { onConflict: "id" }
    )

    if (error) {
      log.error("Failed to upsert collection", { error: error.message })
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
