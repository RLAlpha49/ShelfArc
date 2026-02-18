import { type NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type AdminClient = ReturnType<typeof createAdminClient>

async function cleanupStorageFolder(
  admin: AdminClient,
  bucket: string,
  folder: string
) {
  const { data: files } = await admin.storage.from(bucket).list(folder)
  if (files && files.length > 0) {
    const paths = files.map((f) => `${folder}/${f.name}`)
    await admin.storage.from(bucket).remove(paths)
  }
}

async function cleanupUserStorage(
  admin: AdminClient,
  userId: string,
  log: ReturnType<typeof logger.withCorrelationId>
) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "media"
  for (const folder of [`avatars/${userId}`, `covers/${userId}`]) {
    try {
      await cleanupStorageFolder(admin, bucket, folder)
    } catch (err) {
      log.warn("Storage cleanup failed for folder", {
        folder,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
}

function validateDeleteBody(
  body: Record<string, unknown>,
  correlationId: string
) {
  const confirmText =
    typeof body.confirmText === "string" ? body.confirmText : ""
  if (confirmText !== "DELETE") {
    return apiError(400, 'You must type "DELETE" to confirm', { correlationId })
  }
  if (typeof body.password !== "string" || body.password.length === 0) {
    return apiError(400, "Password is required", { correlationId })
  }
  return null
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
      key: `account-delete:${user.id}`,
      maxHits: 3,
      windowMs: 3_600_000,
      cooldownMs: 3_600_000,
      reason: "Rate limit account deletion"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const validationError = validateDeleteBody(body, correlationId)
    if (validationError) return validationError

    const email = user.email
    if (!email) {
      return apiError(400, "Unable to verify identity", { correlationId })
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: body.password as string
    })
    if (authError) {
      return apiError(403, "Incorrect password", { correlationId })
    }

    const admin = createAdminClient({
      reason: "Account deletion",
      caller: "DELETE /api/account"
    })

    await cleanupUserStorage(admin, user.id, log)

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      log.error("Failed to delete auth user", {
        userId: user.id,
        error: deleteError.message
      })
      return apiError(500, "Failed to delete account", { correlationId })
    }

    log.info("Account deleted", { userId: user.id })
    return apiSuccess({ deleted: true }, { correlationId })
  } catch (error) {
    log.error("Account deletion failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to delete account", { correlationId })
  }
}
