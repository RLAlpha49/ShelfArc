import "server-only"

import type { NextRequest } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiSuccess } from "@/lib/api-response"
import { createAdminClient } from "@/lib/supabase/admin"

/** Supabase Storage bucket for user media files. @source */
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media"

/**
 * Lists all files under a path prefix and returns the total byte count.
 * Uses the admin client so pagination is not limited by RLS.
 */
async function sumBytesInPath(
  admin: ReturnType<typeof createAdminClient>,
  prefix: string
): Promise<number> {
  const { data } = await admin.storage.from(STORAGE_BUCKET).list(prefix, {
    limit: 1000
  })
  if (!data) return 0
  return data.reduce((acc, file) => {
    const size =
      typeof file.metadata?.size === "number" ? file.metadata.size : 0
    return acc + size
  }, 0)
}

/**
 * GET /api/storage/usage
 *
 * Returns the total bytes used by the authenticated user across all storage
 * paths (`{userId}/avatars/` and `{userId}/covers/`).
 *
 * Response:
 * ```json
 * { "data": { "totalBytes": 1234567 } }
 * ```
 * @source
 */
export async function GET(request: NextRequest) {
  const auth = await protectedRoute(request, {
    rateLimit: RATE_LIMITS.storageRead
  })
  if (!auth.ok) return auth.error

  const { user, correlationId } = auth

  const admin = createAdminClient({ reason: "Storage usage query" })

  const [avatarBytes, coverBytes] = await Promise.all([
    sumBytesInPath(admin, `${user.id}/avatars`),
    sumBytesInPath(admin, `${user.id}/covers`)
  ])

  const totalBytes = avatarBytes + coverBytes

  return apiSuccess({ totalBytes }, { correlationId })
}
