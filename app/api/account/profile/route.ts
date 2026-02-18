import { type NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { sanitizePlainText } from "@/lib/sanitize-html"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"
import { isValidHttpsUrl, isValidUsername } from "@/lib/validation"

export const dynamic = "force-dynamic"

type ProfileFields = {
  username?: string | null
  publicBio?: string | null
  isPublic?: boolean
  publicStats?: boolean
  avatarUrl?: string | null
}

/** Extracts and sanitizes profile fields from a request body. @source */
function extractProfileFields(body: Record<string, unknown>): ProfileFields {
  return {
    username:
      typeof body.username === "string"
        ? sanitizePlainText(body.username, 20) || null
        : undefined,
    publicBio:
      typeof body.publicBio === "string"
        ? sanitizePlainText(body.publicBio, 500) || null
        : undefined,
    isPublic: typeof body.isPublic === "boolean" ? body.isPublic : undefined,
    publicStats:
      typeof body.publicStats === "boolean" ? body.publicStats : undefined,
    avatarUrl:
      typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : undefined
  }
}

/** Validates extracted profile fields, returning an error message or null. @source */
function validateProfileFields(
  fields: ProfileFields,
  userId: string
): string | null {
  if (
    fields.username !== undefined &&
    fields.username !== null &&
    !isValidUsername(fields.username)
  ) {
    return "Invalid username format"
  }
  if (
    fields.avatarUrl !== undefined &&
    fields.avatarUrl !== null &&
    fields.avatarUrl !== ""
  ) {
    const isStoragePath =
      fields.avatarUrl.startsWith(userId + "/") &&
      !fields.avatarUrl.includes("://")
    if (!isStoragePath && !isValidHttpsUrl(fields.avatarUrl)) {
      return "avatarUrl must be a valid HTTPS URL"
    }
  }
  return null
}

/** Builds the DB update payload from validated profile fields. @source */
function buildUpdatePayload(fields: ProfileFields): Record<string, unknown> {
  const update: Record<string, unknown> = {}
  if (fields.username !== undefined) update.username = fields.username
  if (fields.publicBio !== undefined) update.public_bio = fields.publicBio
  if (fields.isPublic !== undefined) update.is_public = fields.isPublic
  if (fields.publicStats !== undefined) update.public_stats = fields.publicStats
  if (fields.avatarUrl !== undefined) update.avatar_url = fields.avatarUrl
  return update
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
      key: `profile-write:${user.id}`,
      maxHits: 10,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit profile updates"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const fields = extractProfileFields(body)
    const validationError = validateProfileFields(fields, user.id)
    if (validationError) {
      return apiError(400, validationError, { correlationId })
    }

    const update = buildUpdatePayload(fields)
    if (Object.keys(update).length === 0) {
      return apiError(400, "No valid fields to update", { correlationId })
    }

    const admin = createAdminClient({
      reason: "Profile update via PATCH /api/account/profile",
      caller: "PATCH /api/account/profile"
    })

    const { error } = await admin
      .from("profiles")
      .update(update)
      .eq("id", user.id)

    if (error) {
      log.error("Failed to update profile", { error: error.message })
      return apiError(500, "Failed to update profile", { correlationId })
    }

    await supabase.auth.updateUser({
      data: {
        ...(fields.username !== undefined && {
          username: fields.username,
          display_name: fields.username
        }),
        ...(fields.avatarUrl !== undefined && {
          avatar_url: fields.avatarUrl
        })
      }
    })

    log.info("Profile updated", { userId: user.id })
    return apiSuccess({ updated: true }, { correlationId })
  } catch (error) {
    log.error("Profile update failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to update profile", { correlationId })
  }
}
