/**
 * Simple in-memory sliding-window rate limiter with automatic cooldown.
 *
 * When the failure threshold is reached inside the cooldown window, all
 * subsequent requests are rejected until the cooldown period expires.
 * @source
 */

/**
 * Configuration for the sliding-window rate limiter.
 * @source
 */
interface RateLimitConfig {
  /** Maximum failures allowed before entering cooldown. @source */
  maxFailures: number
  /** Window (ms) in which failures are counted. @source */
  failureWindowMs: number
  /** Duration (ms) the feature stays disabled after hitting the threshold. @source */
  cooldownMs: number
}

/** Tracks failure timestamps and cooldown expiry for a single key. @source */
interface RateLimitState {
  failures: number[]
  cooldownUntil: number
}

/** In-memory store of rate-limit state keyed by identifier. @source */
const stores = new Map<string, RateLimitState>()

/**
 * Retrieves or initializes rate-limit state for the given key.
 * @param key - The rate-limit bucket identifier.
 * @returns The mutable state object.
 * @source
 */
function getState(key: string): RateLimitState {
  let state = stores.get(key)
  if (!state) {
    state = { failures: [], cooldownUntil: 0 }
    stores.set(key, state)
  }
  return state
}

/**
 * Checks whether the given key is currently rate-limited.
 * @param key - The rate-limit bucket identifier.
 * @param config - Rate-limit configuration.
 * @returns `true` if the key is in cooldown.
 * @source
 */
export function isRateLimited(key: string, config: RateLimitConfig): boolean {
  const state = getState(key)
  const now = Date.now()

  if (state.cooldownUntil > now) {
    return true
  }

  // Prune old failures outside the window
  state.failures = state.failures.filter(
    (ts) => now - ts < config.failureWindowMs
  )
  return false
}

/**
 * Records a failure for the given key and enters cooldown if the threshold is reached.
 * @param key - The rate-limit bucket identifier.
 * @param config - Rate-limit configuration.
 * @source
 */
export function recordFailure(key: string, config: RateLimitConfig): void {
  const state = getState(key)
  const now = Date.now()

  state.failures = state.failures.filter(
    (ts) => now - ts < config.failureWindowMs
  )
  state.failures.push(now)

  if (state.failures.length >= config.maxFailures) {
    state.cooldownUntil = now + config.cooldownMs
    state.failures = []
  }
}

/**
 * Returns the remaining cooldown time in milliseconds for the given key.
 * @param key - The rate-limit bucket identifier.
 * @returns Remaining cooldown in ms, or `0` if not rate-limited.
 * @source
 */
export function getCooldownRemaining(key: string): number {
  const state = stores.get(key)
  if (!state) return 0
  return Math.max(0, state.cooldownUntil - Date.now())
}
