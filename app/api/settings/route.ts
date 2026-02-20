import { type NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const MAX_SETTINGS_SIZE = 10_240 // 10 KB

/** Server-side allowlist of permitted settings keys — mirrors the client SYNCABLE_KEYS. */
const ALLOWED_SETTINGS_KEYS = new Set([
  "showReadingProgress",
  "showSeriesProgressBar",
  "cardSize",
  "confirmBeforeDelete",
  "defaultOwnershipStatus",
  "defaultSearchSource",
  "defaultScrapeMode",
  "autoPurchaseDate",
  "sidebarCollapsed",
  "enableAnimations",
  "displayFont",
  "bodyFont",
  "dateFormat",
  "highContrastMode",
  "fontSizeScale",
  "focusIndicators",
  "automatedPriceChecks",
  "releaseReminders",
  "releaseReminderDays",
  "notifyOnImportComplete",
  "notifyOnScrapeComplete",
  "notifyOnPriceAlert",
  "emailNotifications",
  "defaultSortBy",
  "defaultSortDir",
  "hasCompletedOnboarding",
  "navigationMode",
  "dashboardLayout",
  "readingGoal",
  "lastSyncedAt"
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
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
      key: `settings-read:${user.id}`,
      maxHits: 30,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit settings reads"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single()

    if (error) {
      log.error("Failed to fetch settings", {
        error: error.message
      })
      return apiError(500, "Failed to fetch settings", { correlationId })
    }

    return apiSuccess({ settings: data?.settings ?? {} }, { correlationId })
  } catch (error) {
    log.error("Settings fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch settings", { correlationId })
  }
}

export async function PATCH(request: NextRequest) {
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
      key: `settings-write:${user.id}`,
      maxHits: 20,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit settings writes"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    if (!isPlainObject(body.settings)) {
      return apiError(400, "settings must be a plain object", {
        correlationId
      })
    }

    const incoming = body.settings

    // Reject any keys not in the server-side allowlist
    const unrecognizedKeys = Object.keys(incoming).filter(
      (k) => !ALLOWED_SETTINGS_KEYS.has(k)
    )
    if (unrecognizedKeys.length > 0) {
      return apiError(400, "Unrecognized settings keys", { correlationId })
    }

    // Fetch current settings for shallow merge
    const { data: existing, error: fetchError } = await supabase
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .single()

    if (fetchError) {
      log.error("Failed to fetch existing settings", {
        error: fetchError.message
      })
      return apiError(500, "Failed to update settings", { correlationId })
    }

    const merged = {
      ...existing?.settings,
      ...incoming
    }

    if (JSON.stringify(merged).length > MAX_SETTINGS_SIZE) {
      return apiError(400, "Settings payload exceeds 10 KB limit", {
        correlationId
      })
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ settings: merged })
      .eq("id", user.id)

    if (updateError) {
      log.error("Failed to update settings", {
        error: updateError.message
      })
      return apiError(500, "Failed to update settings", { correlationId })
    }

    return apiSuccess({ settings: merged }, { correlationId })
  } catch (error) {
    log.error("Settings update failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to update settings", { correlationId })
  }
}
