import { type NextRequest } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

/** Session record as returned by the GoTrue admin REST API. @source */
interface GoTrueSessionRecord {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  factor_id: string | null
  aal: string
  not_after: string | null
  refreshed_at: string | null
  tag: string | null
}

/** Decodes a JWT access token and returns the session_id claim, or null. @source */
function extractSessionId(accessToken: string): string | null {
  try {
    const parts = accessToken.split(".")
    if (parts.length !== 3 || !parts[1]) return null
    // Pad base64url to base64 then decode
    const padded = parts[1].replaceAll("-", "+").replaceAll("_", "/")
    const payload = JSON.parse(
      Buffer.from(padded, "base64").toString("utf-8")
    ) as { session_id?: string }
    return payload.session_id ?? null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      rateLimit: RATE_LIMITS.sessionsRead
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    // Read the current session's access token to identify the active session
    const {
      data: { session: currentSession }
    } = await supabase.auth.getSession()
    const currentSessionId = currentSession?.access_token
      ? extractSessionId(currentSession.access_token)
      : null

    // The GoTrue /admin/users/:id/sessions endpoint is not exposed in the
    // Supabase JS SDK so a raw fetch is required. createAdminClient is called
    // here as the sole env-var extraction and validation point; it will throw
    // if NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY are missing.
    createAdminClient({
      reason: "List user sessions",
      caller: "GET /api/account/sessions"
    })
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SECRET_KEY!

    const response = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${user.id}/sessions`,
      {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey
        },
        cache: "no-store"
      }
    )

    if (!response.ok) {
      log.error("GoTrue sessions listing failed", { status: response.status })
      return apiError(500, "Failed to retrieve sessions", { correlationId })
    }

    const body = (await response.json()) as
      | { sessions: GoTrueSessionRecord[] }
      | GoTrueSessionRecord[]

    const records: GoTrueSessionRecord[] = Array.isArray(body)
      ? body
      : (body.sessions ?? [])

    const sessions = records.map((s) => ({
      id: s.id,
      created_at: s.created_at,
      last_active_at: s.refreshed_at ?? s.updated_at,
      is_current: s.id === currentSessionId
    }))

    log.info("Sessions listed", { userId: user.id, count: sessions.length })
    return apiSuccess(sessions, { correlationId })
  } catch (error) {
    log.error("Sessions listing failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to retrieve sessions", { correlationId })
  }
}
