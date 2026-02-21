import { type NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"
import { DeleteAccountSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

type AdminClient = ReturnType<typeof createAdminClient>

// Explicit subfolders that can contain user files (covers/* are subdirectories
// of the covers/ prefix — listing covers/ directly returns folder entries, not
// files, so we enumerate each leaf subfolder individually to satisfy GDPR Art. 17).
const USER_STORAGE_SUBFOLDERS = [
  "avatars",
  "covers/series",
  "covers/volumes",
  "cleanup"
] as const

async function cleanupStorageFolder(
  admin: AdminClient,
  bucket: string,
  folder: string
) {
  const { data: files } = await admin.storage
    .from(bucket)
    .list(folder, { limit: 1000 })
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
  for (const sub of USER_STORAGE_SUBFOLDERS) {
    const folder = `${userId}/${sub}`
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

/**
 * Verifies password for email/password accounts. OAuth-only accounts have no
 * email identity entry, so no password check is performed for them — the
 * active JWT session validated by createUserClient is sufficient.
 * Returns a NextResponse error on failure, or null on success.
 */
async function verifyPasswordIfRequired(
  supabase: Awaited<ReturnType<typeof createUserClient>>,
  identities: Array<{ provider: string }> | undefined,
  email: string,
  password: string | undefined,
  correlationId: string
): Promise<NextResponse | null> {
  const hasEmailIdentity =
    identities?.some((id) => id.provider === "email") ?? false
  if (!hasEmailIdentity) return null

  if (!password) {
    return apiError(400, "Password is required", { correlationId })
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return apiError(403, "Incorrect password", { correlationId })
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

    const parsed = DeleteAccountSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const email = user.email
    if (!email) {
      return apiError(400, "Unable to verify identity", { correlationId })
    }

    const authCheck = await verifyPasswordIfRequired(
      supabase,
      user.identities,
      email,
      parsed.data.password,
      correlationId
    )
    if (authCheck) return authCheck

    const admin = createAdminClient({
      reason: "Account deletion",
      caller: "DELETE /api/account"
    })

    // Delete auth user first — cascade deletes profile row via DB trigger.
    // Storage cleanup runs after to avoid orphaned files if deletion fails.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      log.error("Failed to delete auth user", {
        userId: user.id,
        error: deleteError.message
      })
      return apiError(500, "Failed to delete account", { correlationId })
    }

    // Best-effort storage cleanup — errors are logged but do not affect the response.
    await cleanupUserStorage(admin, user.id, log)

    log.info("Account deleted", { userId: user.id })
    return apiSuccess({ deleted: true }, { correlationId })
  } catch (error) {
    log.error("Account deletion failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to delete account", { correlationId })
  }
}
