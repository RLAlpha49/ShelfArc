import { type NextRequest, NextResponse } from "next/server"

import { parsePagination } from "@/lib/api/pagination"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
import { NotificationSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

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
    if (!rl?.allowed) {
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
    if (!rl?.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const parsed = NotificationSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }
    const validated = parsed.data

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
