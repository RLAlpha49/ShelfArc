import { type NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { enforceSameOrigin } from "@/lib/csrf"
import { getCorrelationId } from "@/lib/correlation"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
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
      key: `activity-write:${user.id}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit activity writes"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const eventType =
      typeof body.eventType === "string" ? body.eventType.trim() : ""
    if (!eventType || !VALID_EVENT_TYPES.has(eventType as ActivityEventType)) {
      return apiError(400, "Invalid or missing eventType", { correlationId })
    }

    const entityType =
      typeof body.entityType === "string" ? body.entityType.trim() : null
    const entityId =
      typeof body.entityId === "string" ? body.entityId.trim() : null
    const metadata =
      body.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? body.metadata
        : {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("activity_events")
      .insert({
        user_id: user.id,
        event_type: eventType as ActivityEventType,
        entity_type: entityType,
        entity_id: entityId,
        metadata
      })
      .select()
      .single()

    if (error) {
      return apiError(500, "Failed to record activity event", { correlationId })
    }

    return apiSuccess(data, { correlationId, status: 201 })
  } catch (error) {
    log.error("Activity event recording failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to record activity event", { correlationId })
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
      key: `activity-write:${user.id}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit activity writes"
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
