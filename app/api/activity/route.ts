import { type NextRequest } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import type { ActivityEventType } from "@/lib/types/database"

export const dynamic = "force-dynamic"

const VALID_EVENT_TYPES = new Set<ActivityEventType>([
  "volume_added",
  "volume_updated",
  "volume_deleted",
  "series_created",
  "series_updated",
  "series_deleted",
  "price_alert_triggered",
  "import_completed",
  "scrape_completed",
  "automation_executed",
  "api_token_created",
  "api_token_revoked"
])

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return apiError(401, "Not authenticated", { correlationId })

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, Number(searchParams.get("page")) || 1)
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit")) || 20)
    )
    const eventType = searchParams.get("eventType")
    const entityType = searchParams.get("entityType")

    if (eventType && !VALID_EVENT_TYPES.has(eventType as ActivityEventType)) {
      return apiError(400, "Invalid eventType filter", { correlationId })
    }

    let query = supabase
      .from("activity_events")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)

    if (eventType) {
      query = query.eq("event_type", eventType as ActivityEventType)
    }
    if (entityType) {
      query = query.eq("entity_type", entityType)
    }

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) {
      return apiError(500, "Failed to fetch activity events", {
        correlationId
      })
    }

    const total = count ?? 0

    return apiSuccess(
      {
        data: data ?? [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      { correlationId }
    )
  } catch (error) {
    log.error("Activity events fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch activity events", { correlationId })
  }
}
