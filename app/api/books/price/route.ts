import { NextRequest, NextResponse } from "next/server"
import {
  isRateLimited,
  recordFailure,
  getCooldownRemaining
} from "@/lib/rate-limit"
import { ApiError } from "@/lib/books/price/api-error"
import {
  createAmazonSearchContext,
  fetchAmazonHtml,
  parseAmazonResult
} from "@/lib/books/price/amazon-price"

/** Forces dynamic (uncached) rendering for this route. @source */
export const dynamic = "force-dynamic"

// NOTE: detailed scoring debug is controlled in the lib module.

/** Rate-limit key identifying the Amazon scrape circuit breaker. @source */
const RATE_LIMIT_KEY = "amazon-scrape"

/** Rate-limit configuration for Amazon anti-bot cooldowns. @source */
const RATE_LIMIT_CONFIG = {
  maxFailures: 3,
  failureWindowMs: 5 * 60 * 1000, // 5 minutes
  cooldownMs: 10 * 60 * 1000 // 10-minute cooldown after 3 captcha blocks
} as const

/**
 * Serializes an `ApiError` into a JSON `NextResponse`.
 * @param error - The API error to serialize.
 * @returns A `NextResponse` with the error payload.
 * @source
 */
const jsonError = (error: ApiError) => {
  const payload = error.details
    ? { error: error.message, ...error.details }
    : { error: error.message }
  return NextResponse.json(payload, { status: error.status })
}

/**
 * Amazon price-lookup endpoint: scrapes search results, scores them, and returns the best match with price/image data.
 * @param request - Incoming request with `title`, `domain`, `volume`, `format`, `binding`, and option flags.
 * @returns JSON with the matched result, price data, and search metadata.
 * @source
 */
export async function GET(request: NextRequest) {
  try {
    // Check rate-limit cooldown before making any outbound request
    if (isRateLimited(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)) {
      const remaining = getCooldownRemaining(RATE_LIMIT_KEY)
      const minutes = Math.ceil(remaining / 60_000)
      return NextResponse.json(
        {
          error: `Amazon scraping is temporarily disabled due to anti-bot detection. Try again in ~${minutes} minute${minutes === 1 ? "" : "s"}.`,
          cooldownMs: remaining
        },
        { status: 429 }
      )
    }

    const includeImage =
      request.nextUrl.searchParams.get("includeImage") === "true"
    const includePrice =
      request.nextUrl.searchParams.get("includePrice") !== "false"

    const context = createAmazonSearchContext(request.nextUrl.searchParams)
    const html = await fetchAmazonHtml(context.searchUrl)
    const parsed = parseAmazonResult(html, context, {
      includePrice,
      includeImage
    })

    return NextResponse.json({
      searchUrl: context.searchUrl,
      domain: context.domain,
      expectedTitle: context.expectedTitle,
      matchScore: parsed.matchScore,
      binding: context.bindingLabel,
      result: {
        title: parsed.resultTitle,
        priceText: parsed.priceText,
        priceValue: parsed.priceValue,
        currency: parsed.currency,
        priceBinding: parsed.priceBinding,
        priceError: parsed.priceError,
        url: parsed.productUrl,
        imageUrl: parsed.imageUrl
      }
    })
  } catch (error) {
    if (error instanceof ApiError) {
      // Record captcha / bot-gate failures toward cooldown
      if (error.status === 429) {
        recordFailure(RATE_LIMIT_KEY, RATE_LIMIT_CONFIG)
      }
      return jsonError(error)
    }

    console.error("Amazon price lookup failed", error)
    return NextResponse.json(
      { error: "Amazon price lookup failed" },
      { status: 500 }
    )
  }
}
