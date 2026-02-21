import type { SupabaseClient } from "@supabase/supabase-js"
import { type NextRequest } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiError, getErrorMessage, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"
import { ExportSchema } from "@/lib/validation/schemas"

export const dynamic = "force-dynamic"

const CSV_COLUMNS = [
  "series_title",
  "volume_number",
  "volume_title",
  "isbn",
  "author",
  "publisher",
  "type",
  "ownership_status",
  "reading_status",
  "rating",
  "purchase_price",
  "purchase_date",
  "publish_date",
  "edition",
  "format",
  "page_count",
  "notes",
  "cover_image_url",
  "amazon_url",
  "started_at",
  "finished_at",
  "created_at"
] as const

const SERIES_FIELDS = new Set(["series_title", "author", "publisher", "type"])

function csvEscape(value: unknown): string {
  if (value == null) return ""
  let str = String(value)
  // Neutralize CSV formula injection (Excel, LibreOffice, Google Sheets)
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`
  }
  return str
}

type ExportFormat = "json" | "csv"
type ExportScope = "all" | "selected"

function csvColumnValue(
  col: string,
  seriesRecord: Record<string, unknown>,
  vol: Record<string, unknown>
): string {
  if (col === "series_title") return csvEscape(seriesRecord.title)
  if (col === "volume_title") return csvEscape(vol.title)
  if (SERIES_FIELDS.has(col)) return csvEscape(seriesRecord[col])
  return csvEscape(vol[col])
}

function buildCsvChunk(series: Record<string, unknown>[]): string {
  const rows: string[] = []

  for (const s of series) {
    const volumes = Array.isArray(s.volumes)
      ? (s.volumes as Record<string, unknown>[])
      : []
    for (const vol of volumes) {
      rows.push(CSV_COLUMNS.map((col) => csvColumnValue(col, s, vol)).join(","))
    }
  }

  return rows.join("\n")
}

async function* fetchSeriesBatches(
  supabase: SupabaseClient,
  userId: string,
  scope: ExportScope,
  ids: string[] | undefined,
  batchSize: number
) {
  let offset = 0
  while (true) {
    let query = supabase
      .from("series")
      .select("*, volumes(*)")
      .eq("user_id", userId)
      .range(offset, offset + batchSize - 1)

    if (scope === "selected" && ids) {
      query = query.in("id", ids)
    }

    const { data, error } = await query
    if (error) throw error
    if (!data || data.length === 0) break

    yield data
    if (data.length < batchSize) break
    offset += batchSize
  }
}

function enqueueBatch(
  controller: ReadableStreamDefaultController,
  batch: Record<string, unknown>[],
  format: ExportFormat,
  firstBatch: boolean
): boolean {
  if (format === "csv") {
    const chunk = buildCsvChunk(batch)
    if (chunk) {
      controller.enqueue(new TextEncoder().encode(chunk + "\n"))
    }
    return false
  } else {
    const jsonStr = JSON.stringify(batch)
    const innerJson = jsonStr.slice(1, -1)
    if (innerJson) {
      const prefix = firstBatch ? "" : ","
      controller.enqueue(new TextEncoder().encode(prefix + innerJson))
      return false
    }
    return firstBatch
  }
}

async function handleExportStream(
  controller: ReadableStreamDefaultController,
  supabase: SupabaseClient,
  userId: string,
  scope: ExportScope,
  ids: string[] | undefined,
  format: ExportFormat,
  log: ReturnType<typeof logger.withCorrelationId>
) {
  try {
    if (format === "csv") {
      controller.enqueue(new TextEncoder().encode(CSV_COLUMNS.join(",") + "\n"))
    } else {
      controller.enqueue(new TextEncoder().encode('{"series":['))
    }

    let firstBatch = true
    for await (const batch of fetchSeriesBatches(
      supabase,
      userId,
      scope,
      ids,
      100
    )) {
      firstBatch = enqueueBatch(controller, batch, format, firstBatch)
    }

    if (format === "json") {
      controller.enqueue(new TextEncoder().encode("]}"))
    }
    controller.close()
  } catch (err) {
    log.error("Export stream failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    controller.error(err)
  }
}

export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  try {
    const result = await protectedRoute(request, {
      csrf: true,
      rateLimit: RATE_LIMITS.exportRead
    })
    if (!result.ok) return result.error
    const { user, supabase } = result

    const body = await parseJsonBody(request)
    if (body instanceof Response) return body

    const parsed = ExportSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(400, "Validation failed", {
        correlationId,
        details: parsed.error.issues
      })
    }

    const { format, scope, ids } = parsed.data

    // Check total volumes to prevent massive exports
    let countQuery = supabase
      .from("volumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (scope === "selected" && ids) {
      countQuery = countQuery.in("series_id", ids)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      log.error("Export count query failed", { error: countError.message })
      return apiError(500, "Failed to fetch library data", { correlationId })
    }

    if (count === 0) {
      return apiError(404, "No data to export", { correlationId })
    }

    if (count && count > 10_000) {
      return apiError(400, "Export too large: maximum 10,000 volumes", {
        correlationId
      })
    }

    const date = new Date().toISOString().slice(0, 10)
    const filename = `shelfarc-export-${date}.${format}`
    const baseHeaders: HeadersInit = {
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...(correlationId ? { "x-correlation-id": correlationId } : {})
    }

    const stream = new ReadableStream({
      start(controller) {
        return handleExportStream(
          controller,
          supabase,
          user.id,
          scope,
          ids,
          format,
          log
        )
      }
    })

    return new Response(stream, {
      headers: {
        ...baseHeaders,
        "Content-Type":
          format === "json" ? "application/json" : "text/csv; charset=utf-8"
      }
    })
  } catch (err) {
    log.error("POST /api/library/export failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
