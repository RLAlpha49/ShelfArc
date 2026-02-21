import { type NextRequest, NextResponse } from "next/server"

import { apiError, apiSuccess, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { enforceSameOrigin } from "@/lib/csrf"
import { logger } from "@/lib/logger"
import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { createUserClient } from "@/lib/supabase/server"
import { ImportEventSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

interface ImportEventRow {
  id: string
  format: string
  series_added: number
  volumes_added: number
  errors: number
  imported_at: string
}

export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return apiError(401, "Not authenticated", { correlationId })

    const rl = await consumeDistributedRateLimit({
      key: `import-events-read:${user.id}`,
      maxHits: 30,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit import events reads"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const url = new URL(request.url)
    const rawOffset = url.searchParams.get("offset")
    const rawLimit = url.searchParams.get("limit")
    const offset = Math.max(0, Number.parseInt(rawOffset ?? "0", 10) || 0)
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(rawLimit ?? "20", 10) || 20)
    )

    const { data, error, count } = await supabase
      .from("import_events")
      .select("id, format, series_added, volumes_added, errors, imported_at", {
        count: "exact"
      })
      .eq("user_id", user.id)
      .order("imported_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      log.error("Failed to fetch import events", { error: error.message })
      return apiError(500, "Failed to fetch import events", { correlationId })
    }

    const events = ((data as ImportEventRow[]) ?? []).map((row) => ({
      id: row.id,
      format: row.format,
      seriesAdded: row.series_added,
      volumesAdded: row.volumes_added,
      errors: row.errors,
      importedAt: row.imported_at
    }))

    return apiSuccess(
      { events, total: count ?? events.length },
      { correlationId }
    )
  } catch (error) {
    log.error("Import events fetch failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to fetch import events", { correlationId })
  }
}

export async function POST(request: NextRequest) {
  const csrfResult = enforceSameOrigin(request)
  if (csrfResult) return csrfResult

  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const supabase = await createUserClient()
    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return apiError(401, "Not authenticated", { correlationId })

    const rl = await consumeDistributedRateLimit({
      key: `import-events-write:${user.id}`,
      maxHits: 10,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "Rate limit import events writes"
    })
    if (rl && !rl.allowed) {
      return apiError(429, "Too many requests", { correlationId })
    }

    const body = await parseJsonBody(request)
    if (body instanceof NextResponse) return body

    const parsed = ImportEventSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const { format, seriesAdded, volumesAdded, errors } = parsed.data

    const { data, error: dbError } = await supabase
      .from("import_events")
      .insert({
        user_id: user.id,
        format,
        series_added: seriesAdded,
        volumes_added: volumesAdded,
        errors: errors
      })
      .select("id")
      .single()

    if (dbError) {
      log.error("Failed to insert import event", { error: dbError.message })
      return apiError(500, "Failed to log import event", { correlationId })
    }

    const row = data as { id: string } | null
    return apiSuccess({ id: row?.id ?? null }, { status: 201, correlationId })
  } catch (error) {
    log.error("Import events insert failed", {
      error: error instanceof Error ? error.message : String(error)
    })
    return apiError(500, "Failed to log import event", { correlationId })
  }
}
