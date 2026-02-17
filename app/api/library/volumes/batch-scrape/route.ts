import { type NextRequest } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import {
  apiError,
  apiSuccess,
  getErrorMessage,
  parseJsonBody
} from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import { buildFetchPriceParams } from "@/lib/books/amazon-query"
import {
  createAmazonSearchContext,
  fetchAmazonHtml,
  parseAmazonResult
} from "@/lib/books/price/amazon-price"
import { ApiError } from "@/lib/books/price/api-error"
import { recordActivityEvent } from "@/lib/activity/record-event"
import type { FetchPriceParams } from "@/lib/api/types"
import type { Database } from "@/lib/types/database"

export const dynamic = "force-dynamic"

const VALID_MODES = ["price", "image", "both"] as const
type ScrapeMode = (typeof VALID_MODES)[number]

interface JobResult {
  volumeId: string
  status: "done" | "failed" | "skipped"
  priceValue?: number | null
  imageUrl?: string | null
  errorMessage?: string
}

interface ValidatedBody {
  volumeIds: string[]
  mode: ScrapeMode
  skipExisting: boolean
  domain: string
  binding: string
  includePrice: boolean
  includeImage: boolean
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

const randomDelay = () => Math.floor(Math.random() * 1500) + 1500

function toSearchParams(p: FetchPriceParams): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set("title", p.title)
  sp.set("volume", String(p.volume))
  if (p.volumeTitle) sp.set("volumeTitle", p.volumeTitle)
  if (p.format) sp.set("format", p.format)
  sp.set("binding", p.binding)
  sp.set("domain", p.domain)
  if (p.fallbackToKindle) sp.set("fallbackToKindle", "true")
  return sp
}

function validateBody(
  body: Record<string, unknown>,
  correlationId: string
): ValidatedBody | Response {
  const volumeIds = body.volumeIds
  if (
    !Array.isArray(volumeIds) ||
    volumeIds.length === 0 ||
    !volumeIds.every((id: unknown) => typeof id === "string")
  ) {
    return apiError(400, "volumeIds must be a non-empty array of strings", {
      correlationId
    })
  }
  if (volumeIds.length > 10) {
    return apiError(400, "Maximum 10 volumes per batch", { correlationId })
  }

  const mode = body.mode
  if (!VALID_MODES.includes(mode as ScrapeMode)) {
    return apiError(400, "Mode must be one of: price, image, both", {
      correlationId
    })
  }
  const scrapeMode = mode as ScrapeMode

  return {
    volumeIds,
    mode: scrapeMode,
    skipExisting:
      typeof body.skipExisting === "boolean" ? body.skipExisting : false,
    domain:
      typeof body.domain === "string" && body.domain.trim()
        ? body.domain.trim()
        : "amazon.com",
    binding:
      typeof body.binding === "string" && body.binding.trim()
        ? body.binding.trim()
        : "Paperback",
    includePrice: scrapeMode === "price" || scrapeMode === "both",
    includeImage: scrapeMode === "image" || scrapeMode === "both"
  }
}

function shouldSkip(vol: Record<string, unknown>, mode: ScrapeMode): boolean {
  const hasPrice =
    typeof vol.purchase_price === "number" && vol.purchase_price > 0
  const hasImage =
    typeof vol.cover_image_url === "string" && vol.cover_image_url !== ""
  if (mode === "price") return hasPrice
  if (mode === "image") return hasImage
  return hasPrice && hasImage
}

async function scrapeAndUpdate(
  vol: Record<string, unknown>,
  opts: ValidatedBody,
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<JobResult> {
  const volId = vol.id as string
  const series = vol.series as Record<string, unknown> | null

  const paramResult = buildFetchPriceParams({
    seriesTitle: (series?.title as string) ?? null,
    volumeTitle: (vol.title as string) ?? null,
    volumeNumber: (vol.volume_number as number) ?? 0,
    seriesType: (series?.type as string) ?? null,
    domain: opts.domain,
    includePrice: opts.includePrice,
    includeImage: opts.includeImage,
    fallbackToKindle: false,
    preferKindle: opts.binding === "Kindle"
  })

  if ("error" in paramResult) {
    return {
      volumeId: volId,
      status: "failed",
      errorMessage: paramResult.error
    }
  }

  const searchParams = toSearchParams(paramResult.params)
  const ctx = createAmazonSearchContext(searchParams)
  const html = await fetchAmazonHtml(ctx.searchUrl)
  const parsed = parseAmazonResult(html, ctx, {
    includePrice: opts.includePrice,
    includeImage: opts.includeImage
  })

  const update: Record<string, unknown> = {}
  if (opts.includePrice && parsed.priceValue != null) {
    update.purchase_price = parsed.priceValue
  }
  if (opts.includeImage && parsed.imageUrl) {
    update.cover_image_url = parsed.imageUrl
  }
  if (parsed.productUrl) {
    update.amazon_url = parsed.productUrl
  }

  if (Object.keys(update).length > 0) {
    await supabase
      .from("volumes")
      .update(update)
      .eq("id", volId)
      .eq("user_id", userId)
  }

  return {
    volumeId: volId,
    status: "done",
    priceValue: parsed.priceValue ?? null,
    imageUrl: parsed.imageUrl ?? null
  }
}

async function processVolumes(
  volumes: Record<string, unknown>[],
  opts: ValidatedBody,
  supabase: SupabaseClient<Database>,
  userId: string,
  log: ReturnType<typeof logger.withCorrelationId>
) {
  const results: JobResult[] = []
  let done = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < volumes.length; i++) {
    const vol = volumes[i]
    const jobResult = await processSingleVolume(
      vol,
      opts,
      supabase,
      userId,
      log
    )

    results.push(jobResult)
    if (jobResult.status === "done") done++
    else if (jobResult.status === "failed") failed++
    else skipped++

    if (i < volumes.length - 1) await delay(randomDelay())
  }

  return { results, summary: { total: volumes.length, done, failed, skipped } }
}

async function processSingleVolume(
  vol: Record<string, unknown>,
  opts: ValidatedBody,
  supabase: SupabaseClient<Database>,
  userId: string,
  log: ReturnType<typeof logger.withCorrelationId>
): Promise<JobResult> {
  const volId = vol.id as string

  if (opts.skipExisting && shouldSkip(vol, opts.mode)) {
    return { volumeId: volId, status: "skipped" }
  }

  try {
    return await scrapeAndUpdate(vol, opts, supabase, userId)
  } catch (err) {
    const message =
      err instanceof ApiError
        ? err.message
        : getErrorMessage(err, "Scrape failed")
    log.warn("Batch scrape item failed", { volumeId: volId, error: message })
    return { volumeId: volId, status: "failed", errorMessage: message }
  }
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      csrf: true,
      rateLimit: RATE_LIMITS.batchScrape
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    const body = await parseJsonBody(request)
    if (body instanceof Response) return body

    const validated = validateBody(body, correlationId)
    if (validated instanceof Response) return validated

    const { data: volumes, error: fetchError } = await supabase
      .from("volumes")
      .select("*, series:series_id(id, title, type)")
      .in("id", validated.volumeIds)
      .eq("user_id", user.id)

    if (fetchError) {
      log.error("Failed to fetch volumes", { error: fetchError.message })
      return apiError(500, "Failed to fetch volumes", { correlationId })
    }

    if (!volumes || volumes.length === 0) {
      return apiError(404, "No matching volumes found", { correlationId })
    }

    if (volumes.length !== validated.volumeIds.length) {
      return apiError(
        400,
        "Some volume IDs were not found or do not belong to you",
        {
          correlationId
        }
      )
    }

    const { results, summary } = await processVolumes(
      volumes as Record<string, unknown>[],
      validated,
      supabase,
      user.id,
      log
    )

    void recordActivityEvent(supabase, {
      userId: user.id,
      eventType: "scrape_completed",
      entityType: "batch",
      entityId: null,
      metadata: summary
    })

    log.info("Batch scrape completed", summary)

    return apiSuccess({ data: { results, summary } }, { correlationId })
  } catch (err) {
    log.error("POST /api/library/volumes/batch-scrape failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
