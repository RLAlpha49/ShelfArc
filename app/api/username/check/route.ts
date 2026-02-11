import { NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidUsername } from "@/lib/validation"
import { isRateLimited, recordFailure } from "@/lib/rate-limit"

/** Rate-limit config for username availability checks. @source */
const USERNAME_CHECK_RATE_LIMIT = {
  maxFailures: 15,
  failureWindowMs: 30_000,
  cooldownMs: 60_000
}

/**
 * Checks whether a username is available for the authenticated user.
 * @param request - Incoming request with a `username` query parameter.
 * @returns JSON `{ available: boolean }` or an error response.
 * @source
 */
export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")

  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Invalid username format" },
      { status: 400 }
    )
  }

  const supabase = await createUserClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rateLimitKey = `username-check:${user.id}`
  if (isRateLimited(rateLimitKey, USERNAME_CHECK_RATE_LIMIT)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 })
  }

  recordFailure(rateLimitKey, USERNAME_CHECK_RATE_LIMIT)

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
    return NextResponse.json(
      { error: "Failed to check username" },
      { status: 500 }
    )
  }

  return NextResponse.json({ available: data.length === 0 })
}
