import { type NextRequest } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiError } from "@/lib/api-response"
import { CORRELATION_HEADER, getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import { isSafeStoragePath } from "@/lib/storage/safe-path"
import { createAdminClient } from "@/lib/supabase/admin"

/** Supabase Storage bucket for user media files. @source */
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media"

/**
 * Downloads a user-owned file from Supabase Storage, scoped to the authenticated user's directory.
 * @param request - Incoming request with a `path` query parameter.
 * @returns The file contents with appropriate caching headers, or an error response.
 * @source
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  const auth = await protectedRoute(request, {
    rateLimit: RATE_LIMITS.storageRead
  })
  if (!auth.ok) return auth.error
  const { user } = auth

  const path = request.nextUrl.searchParams.get("path")?.trim()

  if (!path) {
    return apiError(400, "Missing path")
  }

  if (!isSafeStoragePath(path)) {
    return apiError(400, "Invalid path")
  }

  if (!path.startsWith(`${user.id}/`)) {
    return apiError(403, "Forbidden")
  }

  const adminClient = createAdminClient({
    reason: "Download user-owned storage file"
  })
  const { data, error } = await adminClient.storage
    .from(STORAGE_BUCKET)
    .download(path)

  if (error || !data) {
    log.error("Storage download failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(404, "Not found")
  }

  let contentLength: number | null = null
  contentLength = data.size

  const headers: Record<string, string> = {
    "Content-Type": data.type || "application/octet-stream",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff"
  }

  if (typeof contentLength === "number") {
    headers["Content-Length"] = String(contentLength)
  }

  headers[CORRELATION_HEADER] = correlationId

  return new Response(data, { headers })
}
