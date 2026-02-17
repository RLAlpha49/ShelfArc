import { NextRequest } from "next/server"
import { createHash } from "node:crypto"
import {
  isRateLimited,
  recordFailure,
  getCooldownRemaining
} from "@/lib/rate-limit"
import { apiError, apiSuccess } from "@/lib/api-response"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { ApiError } from "@/lib/books/price/api-error"
import {
  createAmazonSearchContext,
  fetchAmazonHtml,
  parseAmazonResult
} from "@/lib/books/price/amazon-price"
import {
  ConcurrencyLimitError,
  ConcurrencyLimiter
} from "@/lib/concurrency/limiter"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"

/** Forces dynamic (uncached) rendering for this route. @source */
export const dynamic = "force-dynamic"

// NOTE: detailed scoring debug is controlled in the lib module.

/** Rate-limit key identifying the Amazon scrape circuit breaker. @source */
const RATE_LIMIT_KEY = "amazon-scrape"

/** Maximum total time for the fetch + parse pipeline before aborting. @source */
const PIPELINE_TIMEOUT_MS = 18_000

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

/** Limits concurrent Amazon scrapes per instance to reduce overload. @source */
const amazonLimiter = new ConcurrencyLimiter({
  concurrency: 1,
  maxQueue: 30,
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
 * Serializes an `ApiError` into a JSON `NextResponse`.
 * @param error - The API error to serialize.
 * @returns A `NextResponse` with the error payload.
 * @source
 */
const jsonError = (error: ApiError) => {
  return apiError(error.status, error.message, {
    extra: error.details
  })
}

/**
 * Checks the global anti-bot cooldown (captcha circuit breaker).
 * @returns A response when blocked, otherwise `null`.
 * @source
 */
const checkGlobalCooldown = () => {
  if (!isRateLimited(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)) {
    return null
  }

  const remaining = getCooldownRemaining(RATE_LIMIT_KEY)
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
    reason: "Rate limit Amazon price scraping"
  })

  if (distributed) {
    if (!distributed.allowed) {
      return apiError(429, "Too many requests", {
        extra: { retryAfterMs: distributed.retryAfterMs }
      })
    }
    return null
  }

  if (isRateLimited(requestLimitKey, REQUEST_LIMIT_CONFIG)) {
    const remaining = getCooldownRemaining(requestLimitKey)
    return apiError(429, "Too many requests", {
      extra: { cooldownMs: remaining }
    })
  }

  recordFailure(requestLimitKey, REQUEST_LIMIT_CONFIG)
  return null
}

/**
 * Amazon price-lookup endpoint: scrapes search results, scores them, and returns the best match with price/image data.
 * @param request - Incoming request with `title`, `domain`, `volume`, `format`, `binding`, and option flags.
 * @returns JSON with the matched result, price data, and search metadata.
 * @source
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)
  const pipelineStart = performance.now()

  try {
    const globalCooldown = checkGlobalCooldown()
    if (globalCooldown) return globalCooldown

    const includeImage =
      request.nextUrl.searchParams.get("includeImage") === "true"
    const includePrice =
      request.nextUrl.searchParams.get("includePrice") !== "false"

    const context = createAmazonSearchContext(request.nextUrl.searchParams)

    const identity = resolveClientIdentity(request)
    const requestLimitKey = `amazon-request:${identity}`

    const requestLimited = await enforceRequestRateLimit(requestLimitKey)
    if (requestLimited) return requestLimited

    return await amazonLimiter.run(async () => {
      let pipelineTimeout: ReturnType<typeof setTimeout> | undefined
      const pipelineAbort = new AbortController()

      const timeoutPromise = new Promise<never>((_, reject) => {
        pipelineTimeout = setTimeout(() => {
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

            const parsed = parseAmazonResult(html, context, {
              includePrice,
              includeImage
            })
            return parsed
          })(),
          timeoutPromise
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
        clearTimeout(pipelineTimeout)
      }
    })
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
        recordFailure(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)
      }
      log.info("Price pipeline error", {
        pipelineMs,
        status: error.status,
        error: error.message
      })
      return jsonError(error)
    }

    log.error("Amazon price lookup failed", {
      pipelineMs,
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Amazon price lookup failed")
  }
}
