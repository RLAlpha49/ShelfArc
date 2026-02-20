import { type NextRequest, NextResponse } from "next/server"

import { parsePagination } from "@/lib/api/pagination"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { sanitizePlainText } from "@/lib/sanitize-html"
import { createUserClient } from "@/lib/supabase/server"
import type { NotificationType } from "@/lib/types/notification"

export const dynamic = "force-dynamic"

const VALID_NOTIFICATION_TYPES = new Set<NotificationType>([
  "import_complete",
  "scrape_complete",
  "price_alert",
  "release_reminder",
  "info"
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
      key: `notifications-read:${user.id}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit notification reads"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const searchParams = request.nextUrl.searchParams
    const { page, limit, from, to } = parsePagination(searchParams, {
      defaultLimit: 50,
      maxLimit: 100
    })

    const { data, error, count } = await supabase
      .from("notifications")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) {
      log.error("Failed to fetch notifications", { error: error.message })
      return apiError(500, "Failed to fetch notifications", { correlationId })
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
    log.error("Notifications fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch notifications", { correlationId })
  }
}

function validateNotificationBody(body: Record<string, unknown>):
  | { error: string }
  | {
      type: NotificationType
      title: string
      message: string
      metadata: Record<string, unknown>
    } {
  const type = typeof body.type === "string" ? body.type.trim() : ""
  if (!type || !VALID_NOTIFICATION_TYPES.has(type as NotificationType)) {
    return { error: "Invalid or missing type" }
  }

  const title = sanitizePlainText(
    typeof body.title === "string" ? body.title : "",
    200
  )
  if (!title) return { error: "Title is required" }

  const message = sanitizePlainText(
    typeof body.message === "string" ? body.message : "",
    2000
  )
  if (!message) return { error: "Message is required" }

  const metadata =
    body.metadata &&
    typeof body.metadata === "object" &&
    !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {}

  return { type: type as NotificationType, title, message, metadata }
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
      key: `notifications-write:${user.id}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit notification writes"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const validated = validateNotificationBody(body)
    if ("error" in validated) {
      return apiError(400, validated.error, { correlationId })
    }

    // Check user preferences before inserting
    const PREF_KEY_MAP: Partial<Record<string, string>> = {
      import_complete: "notifyOnImportComplete",
      scrape_complete: "notifyOnScrapeComplete",
      price_alert: "notifyOnPriceAlert",
      release_reminder: "releaseReminders"
    }
    const prefKey = PREF_KEY_MAP[validated.type]
    if (prefKey !== undefined) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("settings")
        .eq("id", user.id)
        .single()
      const settings = profileData?.settings ?? {}
      if (settings[prefKey] === false) {
        return apiSuccess({ skipped: true }, { correlationId })
      }
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: user.id,
        type: validated.type,
        title: validated.title,
        message: validated.message,
        metadata: validated.metadata
      })
      .select()
      .single()

    if (error) {
      log.error("Failed to create notification", { error: error.message })
      return apiError(500, "Failed to create notification", { correlationId })
    }

    return apiSuccess(data, { correlationId, status: 201 })
  } catch (error) {
    log.error("Notification creation failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to create notification", { correlationId })
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
      key: `notifications-write:${user.id}`,
      maxHits: 10,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit notification clears"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id)

    if (error) {
      log.error("Failed to clear notifications", { error: error.message })
      return apiError(500, "Failed to clear notifications", { correlationId })
    }

    return apiSuccess({ deleted: true }, { correlationId })
  } catch (error) {
    log.error("Notification clear failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to clear notifications", { correlationId })
  }
}
