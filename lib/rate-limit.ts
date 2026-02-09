/**
 * Simple in-memory sliding-window rate limiter with automatic cooldown.
 *
 * When the failure threshold is reached inside the cooldown window, all
 * subsequent requests are rejected until the cooldown period expires.
 * This prevents hammering an upstream service that is actively blocking us.
 */

interface RateLimitConfig {
  /** Maximum failures allowed before entering cooldown. */
  maxFailures: number
  /** Window (ms) in which failures are counted. */
  failureWindowMs: number
  /** How long (ms) the feature stays disabled after hitting the threshold. */
  cooldownMs: number
}

interface RateLimitState {
  failures: number[]
  cooldownUntil: number
}

const stores = new Map<string, RateLimitState>()

function getState(key: string): RateLimitState {
  let state = stores.get(key)
  if (!state) {
    state = { failures: [], cooldownUntil: 0 }
    stores.set(key, state)
  }
  return state
}

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

export function getCooldownRemaining(key: string): number {
  const state = stores.get(key)
  if (!state) return 0
  return Math.max(0, state.cooldownUntil - Date.now())
}
