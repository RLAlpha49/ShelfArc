import { type NextRequest } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidUsername } from "@/lib/validation"
import { isRateLimited, recordFailure } from "@/lib/rate-limit"
import { apiError, apiSuccess } from "@/lib/api-response"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { getCorrelationId } from "@/lib/correlation"

/** Rate-limit config for username availability checks. @source */
const USERNAME_CHECK_RATE_LIMIT = {
  maxFailures: 15,
  failureWindowMs: 30_000,
  cooldownMs: 60_000
}

/** Extracts the client IP for rate limiting (best-effort). @source */
const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ipFromForwarded = forwardedFor?.split(",")[0]?.trim()
  return (
    ipFromForwarded || request.headers.get("x-real-ip")?.trim() || "unknown"
  )
}

/**
 * Checks whether a username is available for the authenticated user.
 * @param request - Incoming request with a `username` query parameter.
 * @returns JSON `{ available: boolean }` or an error response.
 * @source
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)

  const username = request.nextUrl.searchParams.get("username")

  if (!isValidUsername(username)) {
    return apiError(400, "Invalid username format")
  }

  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return apiError(401, "Unauthorized")
  }

  const clientIp = getClientIp(request)
  const distributed = await consumeDistributedRateLimit({
    key: `username-check:${user.id}:${clientIp}`,
    maxHits: USERNAME_CHECK_RATE_LIMIT.maxFailures,
    windowMs: USERNAME_CHECK_RATE_LIMIT.failureWindowMs,
    cooldownMs: USERNAME_CHECK_RATE_LIMIT.cooldownMs,
    reason: "Rate limit username availability checks"
  })

  if (distributed && !distributed.allowed) {
    return apiError(429, "Too many requests", {
      extra: { retryAfterMs: distributed.retryAfterMs }
    })
  }

  const rateLimitKey = `username-check:${user.id}`
  if (!distributed) {
    if (isRateLimited(rateLimitKey, USERNAME_CHECK_RATE_LIMIT)) {
      return apiError(429, "Too many requests")
    }

    recordFailure(rateLimitKey, USERNAME_CHECK_RATE_LIMIT)
  }

  const admin = createAdminClient({
    reason: "Check username availability across all profiles"
  })

  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .neq("id", user.id)
    .limit(1)

  if (error) {
    return apiError(500, "Failed to check username")
  }

  return apiSuccess(
    { data: { available: data.length === 0 } },
    { correlationId }
  )
}
