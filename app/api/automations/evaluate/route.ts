import "server-only"

import { timingSafeEqual } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess } from "@/lib/api-response"
import {
  createAmazonSearchContext,
  fetchAmazonHtml,
  parseAmazonResult
} from "@/lib/books/price/amazon-price"
import { ApiError } from "@/lib/books/price/api-error"
import {
  createBookWalkerSearchContext,
  fetchBookWalkerHtml,
  parseBookWalkerResult
} from "@/lib/books/price/bookwalker-price"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createAdminClient } from "@/lib/supabase/admin"
import { createUserClient } from "@/lib/supabase/server"

/** Forces dynamic (uncached) rendering for this route. @source */
export const dynamic = "force-dynamic"

// Vercel Hobby plan caps serverless function duration at 10s.
export const maxDuration = 10

/**
 * Maximum alerts fetched per evaluation call. All volume IDs are cache-checked
 * in a single batch query; only the first uncached volume is scraped per call.
 * @source
 */
const FETCH_ALERT_LIMIT = 500

/**
 * Cache validity window: each volume is scraped at most once per 24 hours.
 * Alerts whose volume already has a recent price_history entry are skipped.
 * @source
 */
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/** Standard cron intervals in minutes used to pick the nearest valid schedule. @source */
const CRON_INTERVALS = [
  5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 480, 720, 1440
] as const

/**
 * Converts an interval in minutes to a standard cron expression.
 * @param intervalMinutes - One of the standardised CRON_INTERVALS values.
 * @source
 */
function intervalToCron(intervalMinutes: number): string {
  if (intervalMinutes >= 1440) return "0 8 * * *"
  if (intervalMinutes === 60) return "0 * * * *"
  if (intervalMinutes > 60) return `0 */${intervalMinutes / 60} * * *`
  return `*/${intervalMinutes} * * * *`
}

/**
 * Returns the recommended Supabase cron schedule so that all active alerts are
 * evaluated approximately once per 24 hours, given one live scrape per call.
 *
 * Example: 100 alerts → every 15 min (`*\/15 * * * *`).
 *          1 alert    → once daily (`0 8 * * *`).
 * @param totalAlerts - Number of currently active price alerts.
 * @source
 */
function calculateRecommendedCron(totalAlerts: number): {
  schedule: string
  intervalMinutes: number
} {
  if (totalAlerts <= 1) {
    return { schedule: "0 8 * * *", intervalMinutes: 1440 }
  }
  const neededMinutes = Math.ceil((24 * 60) / totalAlerts)
  const intervalMinutes = CRON_INTERVALS.find((i) => i >= neededMinutes) ?? 5
  return { schedule: intervalToCron(intervalMinutes), intervalMinutes }
}

// --- Types ---

/** Series data embedded via PostgREST join inside a volume row. @source */
type AlertVolumeSeries = {
  title: string
  type: string
}

/** Volume data embedded via PostgREST join inside a price_alert row. @source */
type AlertVolume = {
  id: string
  series_id: string | null
  volume_number: number
  title: string | null
  format: string | null
  series: AlertVolumeSeries | null
}

/** Price alert row with embedded volume and series data from a PostgREST join. @source */
type AlertWithVolume = {
  id: string
  volume_id: string
  user_id: string
  target_price: number
  currency: string
  enabled: boolean
  triggered_at: string | null
  volumes: AlertVolume
}

/** User settings relevant to automated price checking. @source */
type UserPriceSettings = {
  amazonDomain?: string
  amazonPreferKindle?: boolean
  amazonFallbackToKindle?: boolean
  automatedPriceChecks?: boolean
  /** Price source preference; defaults to "amazon" when absent. @source */
  priceSource?: string
}

/** Resolved price data from either cache or a live Amazon scrape. @source */
type PriceData = {
  price: number
  currency: string
  productUrl: string | null
}

/** Statistics accumulated while processing a set of volume groups. @source */
type EvalStats = {
  evaluated: number
  triggered: number
  skipped: number
  errors: number
}

/** Successful authentication result from the evaluate route. @source */
type AuthSuccess = { ok: true; targetUserId: string | null }

/** Authentication failure carrying an HTTP response ready to return. @source */
type AuthError = { ok: false; response: NextResponse }

/** Combined authentication outcome discriminated union. @source */
type AuthOutcome = AuthSuccess | AuthError

/** Per-group processing outcome from `processVolumeGroup`. @source */
type GroupOutcome = {
  priceData: PriceData | null
  evaluated: boolean
  error: boolean
}

// --- Auth ---

/**
 * Determines authentication mode and validates the request.
 *
 * Returns `{ ok: true, targetUserId }` on success, where `targetUserId` is
 * `null` in service mode (all alerts) or a user-id string in user mode.
 * Returns `{ ok: false, response }` when the request should be rejected.
 * @source
 */
async function authenticate(
  request: NextRequest,
  correlationId: string
): Promise<AuthOutcome> {
  const secret = process.env.EVALUATION_SECRET
  const provided = request.headers.get("x-evaluation-secret")?.trim() ?? ""

  if (secret) {
    const secretBuf = Buffer.from(secret, "utf8")
    const providedBuf = Buffer.from(
      provided.padEnd(secret.length, "\0").slice(0, secret.length),
      "utf8"
    )
    if (
      secretBuf.length === providedBuf.length &&
      timingSafeEqual(secretBuf, providedBuf)
    ) {
      return { ok: true, targetUserId: null }
    }
  }

  const csrf = enforceSameOrigin(request)
  if (csrf) return { ok: false, response: csrf as NextResponse }

  let userClient: Awaited<ReturnType<typeof createUserClient>>
  try {
    userClient = await createUserClient()
  } catch {
    return {
      ok: false,
      response: apiError(500, "Failed to initialise auth client", {
        correlationId
      })
    }
  }

  const {
    data: { user }
  } = await userClient.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: apiError(401, "Authentication required", { correlationId })
    }
  }

  const rl = await consumeDistributedRateLimit({
    key: `evaluate:${user.id}`,
    maxHits: 2,
    windowMs: 30 * 60 * 1000,
    cooldownMs: 30 * 60 * 1000,
    reason: "Rate limit price alert evaluation"
  })

  if (rl && !rl.allowed) {
    return {
      ok: false,
      response: apiError(429, "Too many requests. Please wait 30 minutes.", {
        correlationId
      })
    }
  }

  return { ok: true, targetUserId: user.id }
}

// --- Data helpers ---

/**
 * Fetches active price alerts with embedded volume and series data.
 * Optionally filters to a specific user when `targetUserId` is provided.
 * @param adminSupabase - Admin Supabase client.
 * @param targetUserId - When set, restricts results to this user's alerts.
 * @returns Alert rows with join data, or an error message.
 * @source
 */
async function fetchActiveAlerts(
  adminSupabase: ReturnType<typeof createAdminClient>,
  targetUserId: string | null
): Promise<{ data: AlertWithVolume[] | null; error: string | null }> {
  const now = new Date().toISOString()
  const base = adminSupabase
    .from("price_alerts")
    .select(
      "id, volume_id, user_id, target_price, currency, enabled, triggered_at, volumes!inner(id, series_id, volume_number, title, format, series:series(title, type))"
    )
    .eq("enabled", true)
    .or(`snoozed_until.is.null,snoozed_until.lt.${now}`)
    .order("created_at", { ascending: true })

  const query = targetUserId
    ? base.eq("user_id", targetUserId).limit(FETCH_ALERT_LIMIT)
    : base.limit(FETCH_ALERT_LIMIT)

  const { data, error } = await query
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []) as unknown as AlertWithVolume[], error: null }
}

/**
 * Fetches price-relevant settings for a set of user IDs from the profiles table.
 * @param adminSupabase - Admin Supabase client.
 * @param userIds - Array of user IDs to look up.
 * @returns Map of userId → settings record.
 * @source
 */
async function fetchUserPriceSettings(
  adminSupabase: ReturnType<typeof createAdminClient>,
  userIds: string[]
): Promise<Map<string, UserPriceSettings>> {
  const settingsMap = new Map<string, UserPriceSettings>()
  if (userIds.length === 0) return settingsMap

  const { data } = await adminSupabase
    .from("profiles")
    .select("id, settings")
    .in("id", userIds)

  const rows = data as Array<{
    id: string
    settings: Record<string, unknown>
  }> | null
  for (const row of rows ?? []) {
    settingsMap.set(row.id, (row.settings ?? {}) as UserPriceSettings)
  }
  return settingsMap
}

/**
 * Returns the set of volume IDs that already have a price_history entry within
 * the 24-hour cache window. A single query covers all volumes at once, avoiding
 * per-alert round-trips.
 * @param adminSupabase - Admin Supabase client.
 * @param volumeIds - Volume IDs to check.
 * @param cutoff - ISO timestamp: entries older than this are excluded.
 * @returns Set of volume IDs whose prices are already cached.
 * @source
 */
async function batchFetchCachedVolumeIds(
  adminSupabase: ReturnType<typeof createAdminClient>,
  volumeIds: string[],
  cutoff: string
): Promise<Set<string>> {
  if (volumeIds.length === 0) return new Set()
  const { data } = await adminSupabase
    .from("price_history")
    .select("volume_id")
    .in("volume_id", volumeIds)
    .gte("scraped_at", cutoff)
  return new Set((data ?? []).map((r: { volume_id: string }) => r.volume_id))
}

/**
 * Groups an array of alerts by their `volume_id`.
 * @param alerts - Flat list of active alerts.
 * @returns Map of volumeId → alerts for that volume.
 * @source
 */
function groupAlertsByVolumeId(
  alerts: AlertWithVolume[]
): Map<string, AlertWithVolume[]> {
  const grouped = new Map<string, AlertWithVolume[]>()
  for (const alert of alerts) {
    const group = grouped.get(alert.volume_id) ?? []
    group.push(alert)
    grouped.set(alert.volume_id, group)
  }
  return grouped
}

/**
 * Builds URLSearchParams for `createAmazonSearchContext` from volume data and user settings.
 * @param vol - Volume data from the alert join.
 * @param settings - The user's Amazon preferences.
 * @returns Populated URLSearchParams.
 * @source
 */
function buildAmazonParams(
  vol: AlertVolume,
  settings: UserPriceSettings
): URLSearchParams {
  const params = new URLSearchParams()
  const seriesTitle = vol.series?.title ?? vol.title ?? "Unknown"
  params.set("title", seriesTitle)
  params.set("volume", String(vol.volume_number))
  params.set("domain", settings.amazonDomain ?? "amazon.com")
  if (vol.format) params.set("format", vol.format)
  if (vol.title) params.set("volumeTitle", vol.title)
  params.set("binding", settings.amazonPreferKindle ? "Kindle" : "Paperback")
  if (!settings.amazonPreferKindle && settings.amazonFallbackToKindle) {
    params.set("fallbackToKindle", "true")
  }
  return params
}

/**
 * Scrapes BookWalker for a volume's current price.
 * Returns `null` on failure (API error, no match, or unexpected error).
 * @param vol - Volume data used to build the search context.
 * @param volumeId - Volume ID for logging.
 * @param log - Correlated logger.
 * @returns Resolved price data, or `null` on failure.
 * @source
 */
async function scrapeVolumeBookWalker(
  vol: AlertVolume,
  volumeId: string,
  log: ReturnType<typeof logger.withCorrelationId>
): Promise<PriceData | null> {
  try {
    const params = new URLSearchParams()
    const seriesTitle = vol.series?.title ?? vol.title ?? "Unknown"
    params.set("title", seriesTitle)
    params.set("volume", String(vol.volume_number))

    const context = createBookWalkerSearchContext(params)
    const html = await fetchBookWalkerHtml(context.searchUrl)
    const result = parseBookWalkerResult(html, context)

    if (result.priceValue === null || result.currency === null) {
      log.warn("BookWalker scrape returned no price", { volumeId })
      return null
    }

    return {
      price: result.priceValue,
      currency: result.currency,
      productUrl: result.productUrl ?? null
    }
  } catch (err) {
    if (err instanceof ApiError) {
      log.warn("BookWalker API error for volume", {
        volumeId,
        status: err.status,
        error: err.message
      })
    } else {
      log.error("BookWalker scrape failed for volume", {
        volumeId,
        error: err instanceof Error ? err.message : String(err)
      })
    }
    return null
  }
}

/**
 * Scrapes Amazon for a volume's current price.
 * Returns `null` on failure (API error, no price found, or unexpected error).
 * @param vol - Volume data used to build the search context.
 * @param settings - User's Amazon preferences.
 * @param volumeId - Volume ID for logging.
 * @param log - Correlated logger.
 * @returns Resolved price data, or `null` on failure.
 * @source
 */
async function scrapeVolume(
  vol: AlertVolume,
  settings: UserPriceSettings,
  volumeId: string,
  log: ReturnType<typeof logger.withCorrelationId>
): Promise<PriceData | null> {
  try {
    const params = buildAmazonParams(vol, settings)
    const context = createAmazonSearchContext(params)
    const html = await fetchAmazonHtml(context.searchUrl)
    const result = parseAmazonResult(html, context, {
      includePrice: true,
      includeImage: false
    })

    if (result.priceValue === null || result.currency === null) {
      log.warn("Amazon scrape returned no price", { volumeId })
      return null
    }

    return {
      price: result.priceValue,
      currency: result.currency,
      productUrl: result.productUrl ?? null
    }
  } catch (err) {
    if (err instanceof ApiError) {
      log.warn("Amazon API error for volume", {
        volumeId,
        status: err.status,
        error: err.message
      })
    } else {
      log.error("Amazon scrape failed for volume", {
        volumeId,
        error: err instanceof Error ? err.message : String(err)
      })
    }
    return null
  }
}

/**
 * Inserts one price_history row per unique user in a volume group.
 * @param adminSupabase - Admin Supabase client.
 * @param volumeId - The scraped volume.
 * @param group - Alerts belonging to this volume group.
 * @param priceData - Resolved price to record.
 * @param source - Price source that produced the data ("amazon" or "bookwalker").
 * @source
 */
async function insertPriceHistory(
  adminSupabase: ReturnType<typeof createAdminClient>,
  volumeId: string,
  group: AlertWithVolume[],
  priceData: PriceData,
  source: "amazon" | "bookwalker" = "amazon"
): Promise<void> {
  const uniqueUserIds = [...new Set(group.map((a) => a.user_id))]
  await adminSupabase.from("price_history").insert(
    uniqueUserIds.map((userId) => ({
      volume_id: volumeId,
      user_id: userId,
      price: priceData.price,
      currency: priceData.currency,
      source,
      product_url: priceData.productUrl
    }))
  )
}

/**
 * Inserts a price_alert notification and disables the alert for a single triggered alert.
 * @param adminSupabase - Admin Supabase client.
 * @param alert - The alert that was triggered.
 * @param vol - Embedded volume data from the alert join.
 * @param priceData - Current price that triggered the alert.
 * @source
 */
async function triggerPriceAlert(
  adminSupabase: ReturnType<typeof createAdminClient>,
  alert: AlertWithVolume,
  vol: AlertVolume,
  priceData: PriceData
): Promise<void> {
  const seriesTitle = vol.series?.title ?? vol.title ?? "Unknown"
  const volLabel = `Volume ${vol.volume_number}`
  const message =
    `${seriesTitle} ${volLabel} dropped to ${priceData.currency} ${priceData.price.toFixed(2)}` +
    ` — below your target of ${alert.currency} ${alert.target_price.toFixed(2)}.`

  await adminSupabase.from("notifications").insert({
    user_id: alert.user_id,
    type: "price_alert",
    title: "Price Alert Triggered",
    message,
    metadata: {
      alertId: alert.id,
      volumeId: alert.volume_id,
      seriesTitle,
      currentPrice: priceData.price,
      targetPrice: alert.target_price,
      currency: priceData.currency
    }
  })

  await adminSupabase
    .from("price_alerts")
    .update({ triggered_at: new Date().toISOString(), enabled: false })
    .eq("id", alert.id)

  // Fire-and-forget email notification if user has emailNotifications enabled
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("settings")
    .eq("id", alert.user_id)
    .single()

  if (
    (profile?.settings as Record<string, unknown> | null)
      ?.emailNotifications === true
  ) {
    adminSupabase.functions
      .invoke("send-notification-email", {
        body: {
          userId: alert.user_id,
          seriesTitle,
          volumeTitle: vol.title ?? null,
          volumeNumber: vol.volume_number,
          currentPrice: priceData.price,
          targetPrice: alert.target_price,
          currency: priceData.currency
        }
      })
      .then(({ error }) => {
        if (error) {
          console.error(
            JSON.stringify({
              level: "warn",
              message: "send-notification-email failed for price alert",
              userId: alert.user_id,
              alertId: alert.id,
              error: error.message
            })
          )
        }
      })
      .catch((err: unknown) => {
        console.error(
          JSON.stringify({
            level: "error",
            message: "send-notification-email threw for price alert",
            userId: alert.user_id,
            alertId: alert.id,
            error: String(err)
          })
        )
      })
  }
}

/**
 * Checks each alert in a group against the current price, triggering notifications
 * for any alert whose target has been met.
 * @param adminSupabase - Admin Supabase client.
 * @param group - Alerts belonging to this volume group.
 * @param vol - Embedded volume data.
 * @param priceData - Current resolved price.
 * @returns Number of alerts triggered.
 * @source
 */
async function checkAlertTriggers(
  adminSupabase: ReturnType<typeof createAdminClient>,
  group: AlertWithVolume[],
  vol: AlertVolume,
  priceData: PriceData
): Promise<number> {
  let triggered = 0
  for (const alert of group) {
    if (priceData.price <= alert.target_price) {
      await triggerPriceAlert(adminSupabase, alert, vol, priceData)
      triggered++
    }
  }
  return triggered
}

/**
 * Scrapes Amazon for a volume and records the result in price_history.
 * Cache checking is performed by the caller before invoking this function.
 * @param adminSupabase - Admin Supabase client.
 * @param volumeId - The volume being evaluated.
 * @param group - All alerts for this volume.
 * @param userSettings - Map of user settings used to select Amazon preferences.
 * @param log - Correlated logger.
 * @returns Outcome describing whether the volume was evaluated or errored.
 * @source
 */
async function processVolumeGroup(
  adminSupabase: ReturnType<typeof createAdminClient>,
  volumeId: string,
  group: AlertWithVolume[],
  userSettings: Map<string, UserPriceSettings>,
  log: ReturnType<typeof logger.withCorrelationId>
): Promise<GroupOutcome> {
  // group is guaranteed non-empty since it was built from existing alerts
  const firstAlert = group[0]
  const settings: UserPriceSettings = userSettings.get(firstAlert.user_id) ?? {}
  const vol = firstAlert.volumes

  // Select price source: BookWalker when explicitly configured, Amazon otherwise.
  const useBookWalker = settings.priceSource === "bookwalker"
  const source: "amazon" | "bookwalker" = useBookWalker
    ? "bookwalker"
    : "amazon"

  const priceData = useBookWalker
    ? await scrapeVolumeBookWalker(vol, volumeId, log)
    : await scrapeVolume(vol, settings, volumeId, log)

  if (!priceData) {
    return { priceData: null, evaluated: false, error: true }
  }

  await insertPriceHistory(adminSupabase, volumeId, group, priceData, source)
  return { priceData, evaluated: true, error: false }
}

/**
 * Batch-checks the 24-hour cache for all volume groups, then scrapes exactly
 * one uncached volume per invocation. This approach avoids N+1 DB queries and
 * keeps execution time well within the 10s Hobby plan limit.
 * @param adminSupabase - Admin Supabase client.
 * @param alertsByVolumeId - Alerts grouped by volume ID.
 * @param userSettings - Map of user settings for Amazon preferences and filtering.
 * @param log - Correlated logger.
 * @returns Aggregated evaluation statistics.
 * @source
 */
async function evaluateAlertGroups(
  adminSupabase: ReturnType<typeof createAdminClient>,
  alertsByVolumeId: Map<string, AlertWithVolume[]>,
  userSettings: Map<string, UserPriceSettings>,
  log: ReturnType<typeof logger.withCorrelationId>
): Promise<EvalStats> {
  const cutoff = new Date(Date.now() - TWENTY_FOUR_HOURS_MS).toISOString()
  const stats: EvalStats = { evaluated: 0, triggered: 0, skipped: 0, errors: 0 }

  // Single DB query covers all volumes — O(1) round-trips regardless of alert count.
  const allVolumeIds = [...alertsByVolumeId.keys()]
  const cachedIds = await batchFetchCachedVolumeIds(
    adminSupabase,
    allVolumeIds,
    cutoff
  )
  stats.skipped = cachedIds.size
  log.info("24h cache check complete", {
    total: allVolumeIds.length,
    skipped: stats.skipped
  })

  // Find the first alert group whose volume has no recent price_history entry.
  let targetVolumeId: string | null = null
  let targetGroup: AlertWithVolume[] | null = null
  for (const [volumeId, group] of alertsByVolumeId) {
    if (!cachedIds.has(volumeId)) {
      targetVolumeId = volumeId
      targetGroup = group
      break
    }
  }

  if (!targetVolumeId || !targetGroup) {
    // All alerts are within their 24-hour cache window — nothing to scrape this run.
    log.info("All volumes cached — no scrape needed this run")
    return stats
  }

  const outcome = await processVolumeGroup(
    adminSupabase,
    targetVolumeId,
    targetGroup,
    userSettings,
    log
  )

  if (outcome.error) {
    stats.errors++
  } else {
    stats.evaluated++
  }

  if (outcome.priceData) {
    const vol = targetGroup[0].volumes
    stats.triggered += await checkAlertTriggers(
      adminSupabase,
      targetGroup,
      vol,
      outcome.priceData
    )
  }

  return stats
}

/**
 * POST handler for price alert evaluation.
 *
 * **Service mode**: when `EVALUATION_SECRET` is set and `x-evaluation-secret` header
 * matches, evaluates ALL eligible users' alerts. No CSRF check required.
 *
 * **User mode**: cookie-based session auth with CSRF enforcement and a per-user
 * rate limit of 2 calls per 30 minutes. Evaluates only the current user's alerts.
 * @source
 */
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  const auth = await authenticate(request, correlationId)
  if (!auth.ok) return auth.response

  let adminSupabase: ReturnType<typeof createAdminClient>
  try {
    adminSupabase = createAdminClient({
      reason: "Price alert evaluation",
      caller: "api/automations/evaluate"
    })
  } catch (err) {
    log.error("Failed to create admin client", {
      error: err instanceof Error ? err.message : String(err)
    })
    return apiError(500, "Service configuration error", { correlationId })
  }

  try {
    const { data: alerts, error: alertsError } = await fetchActiveAlerts(
      adminSupabase,
      auth.targetUserId
    )

    if (alertsError || !alerts) {
      log.error("Failed to fetch price alerts", { error: alertsError })
      return apiError(500, "Failed to fetch price alerts", { correlationId })
    }

    const eligible = alerts.length

    if (alerts.length === 0) {
      return apiSuccess(
        {
          evaluated: 0,
          triggered: 0,
          skipped: 0,
          errors: 0,
          total: 0,
          eligible: 0,
          recommendedCronSchedule: "0 8 * * *",
          recommendedIntervalMinutes: 1440
        },
        { correlationId }
      )
    }

    const userIds = [...new Set(alerts.map((a) => a.user_id))]
    const userSettings = await fetchUserPriceSettings(adminSupabase, userIds)

    const activeAlerts = alerts.filter(
      (a) => userSettings.get(a.user_id)?.automatedPriceChecks !== false
    )

    const alertsByVolumeId = groupAlertsByVolumeId(activeAlerts)
    const stats = await evaluateAlertGroups(
      adminSupabase,
      alertsByVolumeId,
      userSettings,
      log
    )

    const {
      schedule: recommendedCronSchedule,
      intervalMinutes: recommendedIntervalMinutes
    } = calculateRecommendedCron(eligible)

    log.info("Price alert evaluation complete", {
      eligible,
      total: activeAlerts.length,
      recommendedCronSchedule,
      recommendedIntervalMinutes,
      ...stats
    })

    return apiSuccess(
      {
        ...stats,
        total: activeAlerts.length,
        eligible,
        recommendedCronSchedule,
        recommendedIntervalMinutes
      },
      { correlationId }
    )
  } catch (err) {
    log.error("Price alert evaluation failed", {
      error: err instanceof Error ? err.message : String(err)
    })
    return apiError(500, "Price alert evaluation failed", { correlationId })
  }
}
