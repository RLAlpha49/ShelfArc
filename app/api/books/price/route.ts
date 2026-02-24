import { createHash } from "node:crypto"

import { NextRequest } from "next/server"

import { apiError, apiSuccess } from "@/lib/api-response"
import { ApiError } from "@/lib/books/price/api-error"
import {
  ConcurrencyLimiter,
  ConcurrencyLimitError
} from "@/lib/concurrency/limiter"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"

/** Forces dynamic (uncached) rendering for this route. @source */
export const dynamic = "force-dynamic"

export const maxDuration = 10

// NOTE: detailed scoring debug is controlled in the lib module.

/** Rate-limit key identifying the Amazon scrape circuit breaker. @source */
const RATE_LIMIT_KEY = "amazon-scrape"

/** Maximum total time for the fetch + parse pipeline before aborting. @source */
const PIPELINE_TIMEOUT_MS = 8_000

/** Rate-limit configuration for Amazon anti-bot cooldowns. @source */
const RATE_LIMIT_CONFIG = {
  maxFailures: 3,
  failureWindowMs: 5 * 60 * 1000, // 5 minutes
  cooldownMs: 10 * 60 * 1000 // 10-minute cooldown after 3 captcha blocks
} as const

/** Best-effort per-client request limit for outbound scraping. @source */
const REQUEST_LIMIT_CONFIG = {
  maxFailures: 30,
  failureWindowMs: 60_000,
  cooldownMs: 60_000
} as const

// ---------------------------------------------------------------------------
// Instance-local circuit breaker for Amazon anti-bot detection.
// Per-instance state is intentional: each serverless instance independently
// protects itself from triggering captcha loops in the same invocation window.
// ---------------------------------------------------------------------------

interface CircuitBreakerState {
  failures: number[]
  cooldownUntil: number
}
const circuitBreakerStore = new Map<string, CircuitBreakerState>()

function cbIsTripped(
  key: string,
  config: { maxFailures: number; failureWindowMs: number; cooldownMs: number }
): boolean {
  const now = Date.now()
  const state = circuitBreakerStore.get(key)
  if (!state) return false
  if (state.cooldownUntil > now) return true
  state.failures = state.failures.filter(
    (ts) => now - ts < config.failureWindowMs
  )
  return false
}

function cbGetRemainingMs(key: string): number {
  const state = circuitBreakerStore.get(key)
  if (!state) return 0
  return Math.max(0, state.cooldownUntil - Date.now())
}

function cbRecordFailure(
  key: string,
  config: { maxFailures: number; failureWindowMs: number; cooldownMs: number }
): void {
  const now = Date.now()
  let state = circuitBreakerStore.get(key)
  if (!state) {
    state = { failures: [], cooldownUntil: 0 }
    circuitBreakerStore.set(key, state)
  }
  state.failures = state.failures.filter(
    (ts) => now - ts < config.failureWindowMs
  )
  state.failures.push(now)
  if (state.failures.length >= config.maxFailures) {
    state.cooldownUntil = now + config.cooldownMs
    state.failures = []
  }
}

/** Limits concurrent Amazon scrapes per instance to reduce overload. @source */
const amazonLimiter = new ConcurrencyLimiter({
  concurrency: 1,
  maxQueue: 30,
  retryAfterMs: 1200
})

/** Limits concurrent BookWalker scrapes per instance. @source */
const bookwalkerLimiter = new ConcurrencyLimiter({
  concurrency: 2,
  maxQueue: 20,
  retryAfterMs: 1200
})

/** Extracts the client IP for rate limiting (best-effort). @source */
const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ipFromForwarded = forwardedFor?.split(",")[0]?.trim()
  return (
    ipFromForwarded || request.headers.get("x-real-ip")?.trim() || "unknown"
  )
}

/**
 * Builds a stable per-client identifier without persisting raw auth tokens.
 * Prefers a hash of Supabase auth cookies when present; falls back to IP.
 * @source
 */
const resolveClientIdentity = (request: NextRequest) => {
  const authCookie = request.cookies
    .getAll()
    .find(
      ({ name }) => name.startsWith("sb-") && name.includes("-auth-token")
    )?.value

  if (authCookie) {
    const digest = createHash("sha256").update(authCookie).digest("hex")
    return `session:${digest.slice(0, 16)}`
  }

  return `ip:${getClientIp(request)}`
}

/**
 * Checks the global anti-bot cooldown (captcha circuit breaker).
 * @returns A response when blocked, otherwise `null`.
 * @source
 */
const checkGlobalCooldown = () => {
  if (!cbIsTripped(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)) {
    return null
  }

  const remaining = cbGetRemainingMs(RATE_LIMIT_KEY)
  const minutes = Math.ceil(remaining / 60_000)
  return apiError(
    429,
    `Amazon scraping is temporarily disabled due to anti-bot detection. Try again in ~${minutes} minute${minutes === 1 ? "" : "s"}.`,
    { extra: { cooldownMs: remaining } }
  )
}

/**
 * Applies per-client rate limiting for outbound scraping.
 * @returns A response when limited, otherwise `null`.
 * @source
 */
const enforceRequestRateLimit = async (requestLimitKey: string) => {
  const distributed = await consumeDistributedRateLimit({
    key: requestLimitKey,
    maxHits: REQUEST_LIMIT_CONFIG.maxFailures,
    windowMs: REQUEST_LIMIT_CONFIG.failureWindowMs,
    cooldownMs: REQUEST_LIMIT_CONFIG.cooldownMs,
    reason: "Rate limit price scraping"
  })

  if (distributed && !distributed.allowed) {
    return apiError(429, "Too many requests", {
      extra: { retryAfterMs: distributed.retryAfterMs }
    })
  }

  return null
}

/**
 * Checks `price_history` for a recent (< 1 h) cached price for the given volume.
 * Returns `{ price, currency, product_url, scraped_at }` or `null` when no fresh
 * cache entry exists.
 * @source
 */
async function fetchCachedPrice(
  supabase: Awaited<ReturnType<typeof createUserClient>>,
  volumeId: string
) {
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
  const { data } = await supabase
    .from("price_history")
    .select("price, currency, product_url, scraped_at")
    .eq("volume_id", volumeId)
    .gt("scraped_at", oneHourAgo)
    .order("scraped_at", { ascending: false })
    .limit(1)
  return data && data.length > 0 ? data[0] : null
}

type PipelineLog = ReturnType<typeof logger.withCorrelationId>
type SupabaseClient = Awaited<ReturnType<typeof createUserClient>>

/**
 * Executes the BookWalker scrape-and-parse pipeline.
 * @source
 */
async function handleBookWalkerRequest(
  supabase: SupabaseClient,
  request: NextRequest,
  log: PipelineLog,
  correlationId: string,
  pipelineStart: number,
  includePrice: boolean
) {
  const {
    createBookWalkerSearchContext,
    fetchBookWalkerHtml,
    parseBookWalkerResult
  } = await import("@/lib/books/price/bookwalker-price")
  const searchParams = request.nextUrl.searchParams
  const bwContext = createBookWalkerSearchContext(searchParams)

  const volumeId = searchParams.get("volumeId")
  if (volumeId && includePrice) {
    const cached = await fetchCachedPrice(supabase, volumeId)
    if (cached) {
      log.info("Returning cached price from price_history (BookWalker)", {
        volumeId,
        scraped_at: cached.scraped_at
      })
      return apiSuccess(
        {
          data: {
            source: "bookwalker",
            searchUrl: bwContext.searchUrl,
            expectedTitle: bwContext.title,
            matchScore: 0,
            result: {
              title: null,
              priceText: null,
              priceValue: Number(cached.price),
              currency: cached.currency,
              priceError: null,
              url: cached.product_url ?? null,
              imageUrl: null
            }
          }
        },
        { correlationId }
      )
    }
  }

  const identity = resolveClientIdentity(request)
  const rateLimited = await enforceRequestRateLimit(
    `bookwalker-request:${identity}`
  )
  if (rateLimited) return rateLimited

  return bookwalkerLimiter.run(async () => {
    let pipelineTimer: ReturnType<typeof setTimeout> | undefined
    const pipelineAbort = new AbortController()
    const timeout = new Promise<never>((_, reject) => {
      pipelineTimer = setTimeout(() => {
        pipelineAbort.abort()
        reject(new Error("Price pipeline timed out"))
      }, PIPELINE_TIMEOUT_MS)
    })

    try {
      const result = await Promise.race([
        (async () => {
          const html = await fetchBookWalkerHtml(bwContext.searchUrl)
          if (pipelineAbort.signal.aborted) {
            throw new Error("Price pipeline timed out")
          }
          return parseBookWalkerResult(html, bwContext)
        })(),
        timeout
      ])

      const pipelineMs = Math.round(performance.now() - pipelineStart)
      log.info("BookWalker price pipeline completed", {
        pipelineMs,
        matchScore: result.matchScore
      })

      return apiSuccess(
        {
          data: {
            source: "bookwalker",
            searchUrl: bwContext.searchUrl,
            expectedTitle: bwContext.title,
            matchScore: result.matchScore,
            result: {
              title: result.resultTitle,
              priceText: result.priceText,
              priceValue: result.priceValue,
              currency: result.currency,
              priceError: result.priceText ? null : "Price not found",
              url: result.productUrl,
              imageUrl: null
            }
          }
        },
        { correlationId }
      )
    } finally {
      clearTimeout(pipelineTimer)
    }
  })
}

/**
 * Executes the Amazon scrape-and-parse pipeline.
 * @source
 */
async function handleAmazonRequest(
  supabase: SupabaseClient,
  request: NextRequest,
  log: PipelineLog,
  correlationId: string,
  pipelineStart: number,
  includePrice: boolean,
  includeImage: boolean
) {
  const { createAmazonSearchContext, fetchAmazonHtml, parseAmazonResult } =
    await import("@/lib/books/price/amazon-price")
  const cooldown = checkGlobalCooldown()
  if (cooldown) return cooldown

  const context = createAmazonSearchContext(request.nextUrl.searchParams)

  // Return cached price from price_history when available (within the last hour)
  // to avoid repeat Amazon scrapes for the same volume.
  // Image URLs are not cached, so bypass cache when the caller needs an image.
  const volumeId = request.nextUrl.searchParams.get("volumeId")
  if (volumeId && includePrice && !includeImage) {
    const cached = await fetchCachedPrice(supabase, volumeId)
    if (cached) {
      log.info("Returning cached price from price_history", {
        volumeId,
        scraped_at: cached.scraped_at
      })
      return apiSuccess(
        {
          data: {
            searchUrl: context.searchUrl,
            domain: context.domain,
            expectedTitle: context.expectedTitle,
            matchScore: 0,
            binding: context.bindingLabel,
            result: {
              priceValue: Number(cached.price),
              currency: cached.currency,
              priceText: null,
              url: cached.product_url ?? null,
              imageUrl: null
            }
          }
        },
        { correlationId }
      )
    }
  }

  const identity = resolveClientIdentity(request)
  const rateLimited = await enforceRequestRateLimit(
    `amazon-request:${identity}`
  )
  if (rateLimited) return rateLimited

  return amazonLimiter.run(async () => {
    let pipelineTimer: ReturnType<typeof setTimeout> | undefined
    const pipelineAbort = new AbortController()
    const timeout = new Promise<never>((_, reject) => {
      pipelineTimer = setTimeout(() => {
        pipelineAbort.abort()
        reject(new Error("Price pipeline timed out"))
      }, PIPELINE_TIMEOUT_MS)
    })

    try {
      const result = await Promise.race([
        (async () => {
          const html = await fetchAmazonHtml(context.searchUrl)
          if (pipelineAbort.signal.aborted) {
            throw new Error("Price pipeline timed out")
          }
          return parseAmazonResult(html, context, {
            includePrice,
            includeImage
          })
        })(),
        timeout
      ])

      const pipelineMs = Math.round(performance.now() - pipelineStart)
      log.info("Price pipeline completed", {
        pipelineMs,
        domain: context.domain,
        matchScore: result.matchScore
      })

      return apiSuccess(
        {
          data: {
            searchUrl: context.searchUrl,
            domain: context.domain,
            expectedTitle: context.expectedTitle,
            matchScore: result.matchScore,
            binding: context.bindingLabel,
            result: {
              title: result.resultTitle,
              priceText: result.priceText,
              priceValue: result.priceValue,
              currency: result.currency,
              priceBinding: result.priceBinding,
              priceError: result.priceError,
              url: result.productUrl,
              imageUrl: result.imageUrl
            }
          }
        },
        { correlationId }
      )
    } finally {
      clearTimeout(pipelineTimer)
    }
  })
}

/**
 * Price-lookup endpoint: scrapes search results and returns the best match.
 * Supports `source=amazon` (default) and `source=bookwalker`.
 * @param request - Incoming request with `title`, `volume`, `source`, and option flags.
 * @returns JSON with the matched result, price data, and search metadata.
 * @source
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)
  const pipelineStart = performance.now()

  try {
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) {
      return apiError(401, "Authentication required", { correlationId })
    }

    const source = request.nextUrl.searchParams.get("source") ?? "amazon"
    const includeImage =
      request.nextUrl.searchParams.get("includeImage") === "true"
    const includePrice =
      request.nextUrl.searchParams.get("includePrice") !== "false"

    if (source === "bookwalker") {
      return await handleBookWalkerRequest(
        supabase,
        request,
        log,
        correlationId,
        pipelineStart,
        includePrice
      )
    }

    return await handleAmazonRequest(
      supabase,
      request,
      log,
      correlationId,
      pipelineStart,
      includePrice,
      includeImage
    )
  } catch (error) {
    const pipelineMs = Math.round(performance.now() - pipelineStart)

    if (error instanceof ConcurrencyLimitError) {
      return apiError(503, error.message, {
        extra: { retryAfterMs: error.retryAfterMs }
      })
    }

    if (
      error instanceof Error &&
      error.message === "Price pipeline timed out"
    ) {
      log.warn("Price pipeline timed out", { pipelineMs })
      return apiError(504, "Price lookup timed out, please try again")
    }

    if (error instanceof ApiError) {
      // Record captcha / bot-gate failures toward cooldown
      if (error.status === 429) {
        cbRecordFailure(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)
      }
      log.info("Price pipeline error", {
        pipelineMs,
        status: error.status,
        error: error.message
      })
      return apiError(error.status, error.message, {
        correlationId,
        extra: error.details
      })
    }

    log.error("Price lookup failed", {
      pipelineMs,
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Price lookup failed")
  }
}
