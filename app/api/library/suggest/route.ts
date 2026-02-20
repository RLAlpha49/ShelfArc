import { type NextRequest } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiError, apiSuccess, getErrorMessage } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

const ALLOWED_FIELDS = ["title", "author", "publisher"] as const
type SuggestField = (typeof ALLOWED_FIELDS)[number]

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      rateLimit: RATE_LIMITS.suggestRead
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? ""
    if (!q || q.length > 100) {
      return apiError(
        400,
        "Query parameter 'q' is required (1-100 characters)",
        {
          correlationId
        }
      )
    }

    const rawField = request.nextUrl.searchParams.get("field") ?? "title"
    if (!ALLOWED_FIELDS.includes(rawField as SuggestField)) {
      return apiError(400, "Field must be one of: title, author, publisher", {
        correlationId
      })
    }
    const field = rawField as SuggestField

    // pg_trgm GIN indexes (idx_series_title_trgm, idx_series_author_trgm, idx_series_publisher_trgm)
    // are required in the database for this ILIKE query to use index scans at scale.
    const { data, error } = await supabase
      .from("series")
      .select(field)
      .eq("user_id", user.id)
      .ilike(field, `%${q}%`)
      .limit(20)

    if (error) {
      return apiError(500, "Failed to fetch suggestions", { correlationId })
    }

    const seen = new Set<string>()
    const unique: string[] = []
    for (const row of data ?? []) {
      const value = (row as Record<string, unknown>)[field]
      if (typeof value !== "string" || !value.trim()) continue
      const lower = value.toLowerCase()
      if (seen.has(lower)) continue
      seen.add(lower)
      unique.push(value)
    }

    unique.sort((a, b) => a.localeCompare(b))
    const suggestions = unique.slice(0, 10)

    return apiSuccess({ data: suggestions }, { correlationId })
  } catch (err) {
    log.error("GET /api/library/suggest failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
