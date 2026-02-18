import { createClient } from "@supabase/supabase-js"

/** Input to the distributed rate limiter. @source */
export type DistributedRateLimitInput = {
  /** Bucket key (include a prefix like `username-check:`). @source */
  key: string
  /** Maximum hits allowed per window. @source */
  maxHits: number
  /** Window size in milliseconds. @source */
  windowMs: number
  /** Cooldown duration in milliseconds when limit exceeded. @source */
  cooldownMs: number
  /** Audit reason for admin client creation. @source */
  reason: string
}

/** Result from the distributed rate limiter. @source */
export type DistributedRateLimitResult = {
  allowed: boolean
  retryAfterMs: number
}

let warnedMissingRpc = false

/**
 * Module-level singleton Supabase admin client.
 * Created once on first use and reused for all subsequent calls,
 * avoiding per-call connection overhead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: any = null

const isAdminConfigured = () => {
  const explicitlyEnabled =
    process.env.DISTRIBUTED_RATE_LIMIT_ENABLED === "true"
  const isProduction = process.env.NODE_ENV === "production"
  const enabled = explicitlyEnabled || isProduction

  return Boolean(
    enabled &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SECRET_KEY
  )
}

/**
 * Returns the module-level singleton Supabase admin client, creating it on first call.
 * @source
 */
function getAdminClient() {
  if (adminClient) return adminClient
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY!
  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
  return adminClient
}

/**
 * Attempts to consume from a distributed rate limiter.
 *
 * Returns `null` when Supabase admin creds are not configured or the RPC is unavailable,
 * allowing callers to fall back to the in-memory limiter.
 *
 * Requires the SQL function `public.rate_limit_consume` to exist.
 * @source
 */
export async function consumeDistributedRateLimit(
  input: DistributedRateLimitInput
): Promise<DistributedRateLimitResult | null> {
  if (!isAdminConfigured()) return null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  const maxHits = Math.floor(input.maxHits)
  const windowMs = Math.floor(input.windowMs)
  const cooldownMs = Math.floor(input.cooldownMs)

  if (!input.key.trim() || maxHits <= 0 || windowMs <= 0 || cooldownMs < 0) {
    return null
  }

  try {
    const supabase = getAdminClient()

    // Supabase type generation may not include custom RPCs; use a safe cast.
    // The RPC is expected to return a single row with { allowed, retry_after_ms }.
    const { data, error } = await supabase.rpc("rate_limit_consume", {
      p_key: input.key,
      p_max_hits: maxHits,
      p_window_ms: windowMs,
      p_cooldown_ms: cooldownMs
    })

    if (error) {
      if (!warnedMissingRpc) {
        warnedMissingRpc = true
        console.warn("Distributed rate limit RPC unavailable; falling back", {
          message: error.message ?? String(error)
        })
      }
      return null
    }

    const row = Array.isArray(data) ? data[0] : data
    const allowed = Boolean(row?.allowed)
    const retryAfterMs = Number(row?.retry_after_ms ?? row?.retryAfterMs ?? 0)

    if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
      return { allowed, retryAfterMs: 0 }
    }

    return { allowed, retryAfterMs }
  } catch {
    return null
  }
}
