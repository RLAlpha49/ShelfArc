import { type NextRequest } from "next/server"

import { apiError, apiSuccess } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type RouteContext = {
  readonly params: Promise<{ username: string }>
}

/**
 * GET /api/users/[username]/follow
 * Returns whether the authenticated user follows the given public profile,
 * plus follower/following counts for display on public profile pages.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const { username } = await params
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    // Rate-limit even unauthenticated reads (follower counts are public-ish)
    const rlKey = user ? `follow-read:${user.id}` : `follow-read:anon`
    const rl = await consumeDistributedRateLimit({
      key: rlKey,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit follow status reads"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    // Resolve target profile via admin (to find any public profile regardless of RLS)
    const admin = createAdminClient({
      reason: "Resolve username for follow check"
    })
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, is_public")
      .ilike("username", username)
      .single()

    if (!targetProfile?.is_public) {
      return apiError(404, "Profile not found", { correlationId })
    }

    // Follower and following counts (available to all visitors)
    const [followerResult, followingResult] = await Promise.all([
      admin
        .from("user_follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("following_id", targetProfile.id),
      admin
        .from("user_follows")
        .select("following_id", { count: "exact", head: true })
        .eq("follower_id", targetProfile.id)
    ])
    const followerCount = followerResult.count ?? 0
    const followingCount = followingResult.count ?? 0

    // Whether the current authenticated user follows the target
    let isFollowing = false
    if (user) {
      const { data: followRow } = await supabase
        .from("user_follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", targetProfile.id)
        .maybeSingle()
      isFollowing = followRow !== null
    }

    return apiSuccess(
      {
        data: {
          isFollowing,
          followerCount: followerCount ?? 0,
          followingCount: followingCount ?? 0
        }
      },
      { correlationId }
    )
  } catch (error) {
    log.error("Follow status check failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch follow status", { correlationId })
  }
}

/**
 * POST /api/users/[username]/follow
 * Authenticated user begins following the given public profile.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const csrfResult = enforceSameOrigin(request)
  if (csrfResult) return csrfResult

  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const { username } = await params
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(401, "Authentication required", { correlationId })
    }

    const rl = await consumeDistributedRateLimit({
      key: `follow-write:${user.id}`,
      maxHits: 30,
      windowMs: 60_000,
      cooldownMs: 60_000,
      reason: "Rate limit follow mutations"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    // Resolve target profile
    const admin = createAdminClient({ reason: "Resolve username for follow" })
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, is_public")
      .ilike("username", username)
      .single()

    if (!targetProfile?.is_public) {
      return apiError(404, "Profile not found", { correlationId })
    }

    // Prevent self-follow (also enforced at DB level via CHECK constraint)
    if (targetProfile.id === user.id) {
      return apiError(400, "Cannot follow yourself", { correlationId })
    }

    // Upsert using the user-scoped client (RLS enforces follower_id = auth.uid())
    const { error } = await supabase
      .from("user_follows")
      .upsert(
        { follower_id: user.id, following_id: targetProfile.id },
        { onConflict: "follower_id,following_id" }
      )

    if (error) {
      log.error("Failed to follow user", { error: error.message })
      return apiError(500, "Failed to follow user", { correlationId })
    }

    return apiSuccess(
      { data: { following: true } },
      { correlationId, status: 201 }
    )
  } catch (error) {
    log.error("Follow mutation failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to follow user", { correlationId })
  }
}

/**
 * DELETE /api/users/[username]/follow
 * Authenticated user unfollows the given profile.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const csrfResult = enforceSameOrigin(request)
  if (csrfResult) return csrfResult

  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const { username } = await params
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      return apiError(401, "Authentication required", { correlationId })
    }

    const rl = await consumeDistributedRateLimit({
      key: `follow-write:${user.id}`,
      maxHits: 30,
      windowMs: 60_000,
      cooldownMs: 60_000,
      reason: "Rate limit follow mutations"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    // Resolve target profile
    const admin = createAdminClient({ reason: "Resolve username for unfollow" })
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, is_public")
      .ilike("username", username)
      .single()

    if (!targetProfile?.is_public) {
      return apiError(404, "Profile not found", { correlationId })
    }

    // Delete only rows where the current user is the follower (RLS also enforces this)
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetProfile.id)

    if (error) {
      log.error("Failed to unfollow user", { error: error.message })
      return apiError(500, "Failed to unfollow user", { correlationId })
    }

    return apiSuccess({ data: { following: false } }, { correlationId })
  } catch (error) {
    log.error("Unfollow mutation failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to unfollow user", { correlationId })
  }
}
