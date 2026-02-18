import type { SupabaseClient, User } from "@supabase/supabase-js"
import type { NextRequest } from "next/server"

import { apiError } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/types/database"

export type RateLimitPreset = {
  maxHits: number
  windowMs: number
  cooldownMs: number
}

export type ProtectedRouteOptions = {
  rateLimit?: RateLimitPreset & { prefix: string }
  csrf?: boolean
}

export type ProtectedRouteResult =
  | {
      ok: true
      user: User
      supabase: SupabaseClient<Database>
      correlationId: string
    }
  | { ok: false; error: Response }

export async function protectedRoute(
  req: NextRequest,
  options: ProtectedRouteOptions = {}
): Promise<ProtectedRouteResult> {
  const correlationId = getCorrelationId(req)
  let supabase: SupabaseClient<Database>
  let user: User | null = null

  try {
    supabase = await createUserClient()
    const {
      data: { user: authedUser }
    } = await supabase.auth.getUser()
    user = authedUser
    if (!user) {
      return {
        ok: false,
        error: apiError(401, "Not authenticated", { correlationId })
      }
    }
  } catch (err) {
    logger
      .withCorrelationId(correlationId)
      .error("Supabase auth error", { err })
    return {
      ok: false,
      error: apiError(500, "Authentication error", { correlationId })
    }
  }

  if (options.csrf) {
    const csrfResult = enforceSameOrigin(req)
    if (csrfResult) {
      return { ok: false, error: csrfResult }
    }
  }

  if (options.rateLimit) {
    const { prefix, maxHits, windowMs, cooldownMs } = options.rateLimit
    const key = `${prefix}:${user.id}`
    const rate = await consumeDistributedRateLimit({
      key,
      maxHits,
      windowMs,
      cooldownMs,
      reason: "api-protected"
    })
    if (rate && !rate.allowed) {
      return {
        ok: false,
        error: apiError(429, "Rate limit exceeded", {
          correlationId,
          extra: { retryAfterMs: rate.retryAfterMs }
        })
      }
    }
  }

  return { ok: true, user, supabase, correlationId }
}
