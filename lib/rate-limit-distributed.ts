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
  /**
   * True when the distributed limiter was unavailable and the in-memory
   * fallback was used. The request was allowed but throttling is best-effort.
   */
  failedOpen?: boolean
}

type InMemoryEntry = { count: number; resetAt: number }

/**
 * Best-effort in-memory rate limiter used as a fallback when the distributed
 * limiter is unavailable. Uses 50% of the configured limit to be conservative.
 */
const inMemoryFallback = new Map<string, InMemoryEntry>()

function consumeInMemoryFallback(
  key: string,
  maxHits: number,
  windowMs: number
): DistributedRateLimitResult {
  const now = Date.now()

  // Periodically evict expired entries to prevent unbounded growth.
  if (inMemoryFallback.size > 1000) {
    for (const [k, v] of inMemoryFallback) {
      if (now >= v.resetAt) inMemoryFallback.delete(k)
    }
  }

  // Use 50% of the distributed limit as a conservative fallback cap.
  const fallbackMax = Math.max(1, Math.floor(maxHits * 0.5))

  const entry = inMemoryFallback.get(key)
  if (!entry || now >= entry.resetAt) {
    inMemoryFallback.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0, failedOpen: true }
  }

  entry.count++
  if (entry.count > fallbackMax) {
    return {
      allowed: false,
      retryAfterMs: entry.resetAt - now,
      failedOpen: false
    }
  }

  return { allowed: true, retryAfterMs: 0, failedOpen: true }
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
 * When Supabase admin creds are not configured or the RPC fails, falls back
 * to an in-memory sliding-window limiter (at 50% of the configured limit)
 * rather than returning `null` and silently allowing requests through.
 *
 * Returns `null` only for invalid inputs (programming errors).
 *
 * The `failedOpen` flag on the result is `true` when the in-memory fallback
 * was used, so callers can distinguish infra failure from a normal allow.
 *
 * Requires the SQL function `public.rate_limit_consume` to exist.
 * @source
 */
export async function consumeDistributedRateLimit(
  input: DistributedRateLimitInput
): Promise<DistributedRateLimitResult | null> {
  const maxHits = Math.floor(input.maxHits)
  const windowMs = Math.floor(input.windowMs)
  const cooldownMs = Math.floor(input.cooldownMs)

  // Invalid inputs are a programming error; return null so callers can catch them.
  if (!input.key.trim() || maxHits <= 0 || windowMs <= 0 || cooldownMs < 0) {
    return null
  }

  if (!isAdminConfigured()) {
    return consumeInMemoryFallback(input.key, maxHits, windowMs)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return consumeInMemoryFallback(input.key, maxHits, windowMs)
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
        console.warn(
          "Distributed rate limit RPC unavailable; using in-memory fallback",
          {
            message: error.message ?? String(error)
          }
        )
      }
      return consumeInMemoryFallback(input.key, maxHits, windowMs)
    }

    const row = Array.isArray(data) ? data[0] : data
    const allowed = Boolean(row?.allowed)
    const retryAfterMs = Number(row?.retry_after_ms ?? row?.retryAfterMs ?? 0)

    if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
      return { allowed, retryAfterMs: 0 }
    }

    return { allowed, retryAfterMs }
  } catch {
    return consumeInMemoryFallback(input.key, maxHits, windowMs)
  }
}
