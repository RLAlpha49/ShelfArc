import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

/** Alias for the Supabase client return type. @source */
type SupabaseClient = ReturnType<typeof createClient>

/** Generic JSON-serializable record type. @source */
type JsonRecord = Record<string, unknown>

/**
 * Awaitable Supabase query builder that supports extended PostgREST filter operations.
 * Extends Promise so it can be awaited directly after any number of filter chains.
 * @source
 */
type FlexBuilder<T = unknown> = Promise<{
  data: T | null
  error: { message: string } | null
}> & {
  eq(column: string, value: unknown): FlexBuilder<T>
  neq(column: string, value: unknown): FlexBuilder<T>
  gte(column: string, value: unknown): FlexBuilder<T>
  lte(column: string, value: unknown): FlexBuilder<T>
  in(column: string, values: readonly unknown[]): FlexBuilder<T>
  is(column: string, value: unknown): FlexBuilder<T>
  order(column: string, options?: { ascending?: boolean }): FlexBuilder<T>
  limit(count: number): FlexBuilder<T>
  select(columns?: string): FlexBuilder<T>
  single(): Promise<{ data: T | null; error: { message: string } | null }>
}

/**
 * Casts a Supabase query expression to a FlexBuilder for extended filter support.
 * @param query - Raw Supabase query result from `.from(...).select(...)` or similar.
 * @returns The same query cast to a FlexBuilder.
 * @source
 */
const flex = <T>(query: unknown): FlexBuilder<T> => query as FlexBuilder<T>

/** Volume row with embedded series data returned by the release dates query. @source */
type VolumeWithSeries = {
  id: string
  user_id: string
  volume_number: number
  title: string | null
  publish_date: string | null
  release_reminder: boolean
  series: { title: string } | null
}

/** Profile row selecting only id and settings for user preference filtering. @source */
type ProfileRow = {
  id: string
  settings: Record<string, unknown>
}

/** Notification row selected for deduplication purposes. @source */
type NotifDedupeRow = {
  user_id: string
  metadata: Record<string, unknown>
}

/** User settings relevant to release reminder notifications. @source */
type UserReleaseSettings = {
  releaseReminders?: boolean
}

/**
 * Creates a JSON Response with the given status and body.
 * @param status - HTTP status code.
 * @param body - JSON-serializable response body.
 * @returns A Response with JSON content-type.
 * @source
 */
const jsonResponse = (status: number, body: JsonRecord): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  })

/**
 * Reads a Deno environment variable with an optional fallback.
 * @param key - Environment variable name.
 * @param fallback - Default value if the variable is unset or empty.
 * @returns The variable value or fallback.
 * @source
 */
function getEnv(key: string): string | undefined
function getEnv(key: string, fallback: string): string
function getEnv(key: string, fallback?: string) {
  const value = Deno.env.get(key)
  if (value === undefined || value.trim() === "") {
    return fallback
  }
  return value.trim()
}

/**
 * Formats a date as an ISO 8601 date string (YYYY-MM-DD) in UTC.
 * @param date - The date to format.
 * @returns A UTC date string like `2026-02-18`.
 * @source
 */
const toDateString = (date: Date): string => date.toISOString().slice(0, 10)

/**
 * Validates the request's `x-evaluation-secret` header against the configured secret.
 * Returns `null` when authorization succeeds or when no secret is configured.
 * @param request - Incoming HTTP request.
 * @param requiredSecret - The expected secret value, or `undefined` if auth is disabled.
 * @returns `null` on success, or a `Response` to return immediately on failure.
 * @source
 */
const checkAuthorization = (
  request: Request,
  requiredSecret: string | undefined
): Response | null => {
  if (!requiredSecret) return null
  const provided = request.headers.get("x-evaluation-secret") ?? ""
  if (provided !== requiredSecret) {
    return jsonResponse(401, { error: "Unauthorized." })
  }
  return null
}

/**
 * Queries upcoming volumes with a publish_date in [today, today+7], ownership_status
 * of 'wishlist', and release_reminder enabled.
 * @param supabase - Admin Supabase client.
 * @param todayStr - ISO date string for the start of the window (today, UTC midnight).
 * @param weekLaterStr - ISO date string for the end of the window (today+7 days).
 * @returns Array of volumes with embedded series data, or an error.
 * @source
 */
const fetchUpcomingVolumes = async (
  supabase: SupabaseClient,
  todayStr: string,
  weekLaterStr: string
): Promise<{ data: VolumeWithSeries[] | null; error: string | null }> => {
  const { data, error } = await flex<VolumeWithSeries[]>(
    supabase
      .from("volumes")
      .select(
        "id, user_id, volume_number, title, publish_date, release_reminder, series:series(title)"
      )
  )
    .gte("publish_date", todayStr)
    .lte("publish_date", weekLaterStr)
    .eq("ownership_status", "wishlist")
    .eq("release_reminder", true)
    .limit(1000)

  if (error) return { data: null, error: error.message }
  return { data: data ?? [], error: null }
}

/**
 * Fetches settings for a set of user IDs from the profiles table.
 * @param supabase - Admin Supabase client.
 * @param userIds - Array of user IDs to fetch settings for.
 * @returns A map of userId to their settings record.
 * @source
 */
const fetchUserSettings = async (
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, Record<string, unknown>>> => {
  const settingsMap = new Map<string, Record<string, unknown>>()
  if (userIds.length === 0) return settingsMap

  const { data } = await flex<ProfileRow[]>(
    supabase.from("profiles").select("id, settings")
  ).in("id", userIds)

  for (const row of data ?? []) {
    settingsMap.set(row.id, row.settings ?? {})
  }
  return settingsMap
}

/**
 * Queries recent release_reminder notifications to build a deduplication Set.
 * @param supabase - Admin Supabase client.
 * @param sevenDaysAgoStr - ISO timestamp for the lookback boundary.
 * @returns A Set of `${userId}:${volumeId}` keys already notified in the last 7 days.
 * @source
 */
const buildDedupeSet = async (
  supabase: SupabaseClient,
  sevenDaysAgoStr: string
): Promise<Set<string>> => {
  const notifiedSet = new Set<string>()

  const { data } = await flex<NotifDedupeRow[]>(
    supabase.from("notifications").select("user_id, metadata")
  )
    .eq("type", "release_reminder")
    .gte("created_at", sevenDaysAgoStr)

  for (const notif of data ?? []) {
    const volumeId = notif.metadata?.volumeId
    if (typeof volumeId === "string") {
      notifiedSet.add(`${notif.user_id}:${volumeId}`)
    }
  }

  return notifiedSet
}

/**
 * Formats a relative day label for a future date.
 * @param daysUntil - Number of days from today (0 = today, 1 = tomorrow, N = in N days).
 * @returns Human-readable label: "today", "tomorrow", or "in N days".
 * @source
 */
const formatDayLabel = (daysUntil: number): string => {
  if (daysUntil <= 0) return "today"
  if (daysUntil === 1) return "tomorrow"
  return `in ${daysUntil} days`
}

/**
 * Edge function handler that checks for upcoming releases and sends notifications.
 * Runs fully self-contained using the Supabase service role client — no Next.js API calls.
 * @source
 */
serve(async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." })
  }

  const evaluationSecret = getEnv("EVALUATION_SECRET")
  const authResult = checkAuthorization(request, evaluationSecret)
  if (authResult) return authResult

  const supabaseUrl = getEnv(
    "SUPABASE_URL",
    getEnv("NEXT_PUBLIC_SUPABASE_URL") ?? ""
  )
  const serviceRoleKey = getEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    getEnv("SUPABASE_SECRET_KEY") ?? ""
  )

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, {
      error:
        "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY."
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Calculate date window: today UTC midnight to today+7 days.
  const now = new Date()
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const todayStr = toDateString(today)
  const weekLaterStr = toDateString(weekLater)
  const sevenDaysAgoStr = new Date(
    today.getTime() - 7 * 24 * 60 * 60 * 1000
  ).toISOString()

  // Fetch upcoming volumes.
  const { data: volumes, error: volError } = await fetchUpcomingVolumes(
    supabase,
    todayStr,
    weekLaterStr
  )
  if (volError || !volumes) {
    return jsonResponse(500, {
      error: `Failed to fetch upcoming volumes: ${volError ?? "unknown error"}`
    })
  }

  const total = volumes.length
  if (total === 0) {
    return jsonResponse(200, { ok: true, notified: 0, skipped: 0, total: 0 })
  }

  // Fetch user settings and filter out users who disabled release reminders.
  const uniqueUserIds = [...new Set(volumes.map((v) => v.user_id))]
  const userSettings = await fetchUserSettings(supabase, uniqueUserIds)

  // Build notification deduplication set.
  const notifiedSet = await buildDedupeSet(supabase, sevenDaysAgoStr)

  const dayMs = 24 * 60 * 60 * 1000
  let notified = 0
  let skipped = 0

  for (const volume of volumes) {
    // Filter: skip users who have disabled release reminders in their settings.
    const settings = (userSettings.get(volume.user_id) ??
      {}) as UserReleaseSettings
    if (settings.releaseReminders === false) {
      skipped++
      continue
    }

    // Deduplication: skip if already notified for this user+volume in the last 7 days.
    const dedupeKey = `${volume.user_id}:${volume.id}`
    if (notifiedSet.has(dedupeKey)) {
      skipped++
      continue
    }

    if (!volume.publish_date) {
      skipped++
      continue
    }

    const publishDate = new Date(volume.publish_date)
    const daysUntil = Math.round(
      (publishDate.getTime() - today.getTime()) / dayMs
    )
    const dayLabel = formatDayLabel(daysUntil)
    const seriesTitle = volume.series?.title ?? volume.title ?? "Unknown Series"
    const volumeLabel = `Volume ${volume.volume_number}`

    const message = `${seriesTitle} ${volumeLabel} releases ${dayLabel} on ${volume.publish_date}.`

    const { error: insertError } = await (flex(
      supabase.from("notifications").insert({
        user_id: volume.user_id,
        type: "release_reminder",
        title: "Upcoming Release",
        message,
        metadata: {
          volumeId: volume.id,
          seriesTitle,
          volumeNumber: volume.volume_number,
          publishDate: volume.publish_date,
          daysUntil
        }
      })
    ) as Promise<{ data: unknown; error: { message: string } | null }>)

    if (insertError) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Failed to insert release reminder notification",
          volumeId: volume.id,
          userId: volume.user_id,
          error: insertError.message
        })
      )
      skipped++
      continue
    }

    notified++
  }

  return jsonResponse(200, { ok: true, notified, skipped, total })
})
