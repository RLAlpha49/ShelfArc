import { type NextRequest } from "next/server"

import { parsePagination } from "@/lib/api/pagination"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
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
  "scrape_completed"
])

const VALID_ENTITY_TYPES = new Set(["volume", "series", "batch"])

function isValidDateParam(value: string | null): boolean {
  return value === null || !Number.isNaN(Date.parse(value))
}

function parseActivityFilters(searchParams: URLSearchParams): {
  eventType: string | null
  entityType: string | null
  afterDate: string | null
  beforeDate: string | null
} {
  return {
    eventType: searchParams.get("eventType"),
    entityType: searchParams.get("entityType"),
    afterDate: searchParams.get("afterDate"),
    beforeDate: searchParams.get("beforeDate")
  }
}

function validateActivityFilters(
  params: ReturnType<typeof parseActivityFilters>
): string | null {
  const { eventType, entityType, afterDate, beforeDate } = params
  if (eventType && !VALID_EVENT_TYPES.has(eventType as ActivityEventType))
    return "Invalid eventType filter"
  if (entityType && !VALID_ENTITY_TYPES.has(entityType))
    return "Invalid entityType filter"
  if (!isValidDateParam(afterDate) || !isValidDateParam(beforeDate))
    return "Invalid date filter"
  return null
}

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
      key: `activity-read:${user.id}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit activity reads"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const searchParams = request.nextUrl.searchParams
    const { page, limit, from, to } = parsePagination(searchParams, {
      defaultLimit: 20,
      maxLimit: 100
    })
    const { eventType, entityType, afterDate, beforeDate } =
      parseActivityFilters(searchParams)

    const filterError = validateActivityFilters({
      eventType,
      entityType,
      afterDate,
      beforeDate
    })
    if (filterError) return apiError(400, filterError, { correlationId })

    let query = supabase
      .from("activity_events")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)

    if (eventType)
      query = query.eq("event_type", eventType as ActivityEventType)
    if (entityType) query = query.eq("entity_type", entityType)
    if (afterDate) query = query.gte("created_at", afterDate)
    if (beforeDate) query = query.lte("created_at", beforeDate)

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

export async function DELETE(request: NextRequest) {
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
      key: `activity-delete:${user.id}`,
      maxHits: 3,
      windowMs: 3_600_000,
      cooldownMs: 3_600_000,
      reason: "Rate limit activity history deletion"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const { error } = await supabase
      .from("activity_events")
      .delete()
      .eq("user_id", user.id)

    if (error) {
      return apiError(500, "Failed to clear activity history", {
        correlationId
      })
    }

    return apiSuccess({ deleted: true }, { correlationId })
  } catch (error) {
    log.error("Activity history clear failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to clear activity history", { correlationId })
  }
}
