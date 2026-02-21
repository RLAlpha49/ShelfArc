import { type NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { validatePassword } from "@/lib/auth/validate-password"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"
import { ChangePasswordSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const csrfResult = enforceSameOrigin(request)
  if (csrfResult) return csrfResult

  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user?.email)
      return apiError(401, "Not authenticated", { correlationId })

    const rl = await consumeDistributedRateLimit({
      key: `password-change:${user.id}`,
      maxHits: 5,
      windowMs: 60_000,
      cooldownMs: 15 * 60_000,
      reason: "Rate limit password changes"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const parsed = ChangePasswordSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const { currentPassword, newPassword } = parsed.data

    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      return apiError(400, passwordError, { correlationId })
    }

    // Enforce re-authentication server-side
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    })
    if (authError) {
      return apiError(403, "Current password is incorrect", { correlationId })
    }

    const admin = createAdminClient({
      reason: "Password change after server-side re-authentication",
      caller: "POST /api/account/password"
    })
    const { error: updateError } = await admin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )
    if (updateError) {
      log.error("Failed to update password", { error: updateError.message })
      return apiError(500, "Failed to update password", { correlationId })
    }

    // Revoke all other active sessions so the compromised session becomes invalid
    await supabase.auth.signOut({ scope: "others" })

    log.info("Password changed", { userId: user.id })
    return apiSuccess({ updated: true }, { correlationId })
  } catch (error) {
    log.error("Password change failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to change password", { correlationId })
  }
}
