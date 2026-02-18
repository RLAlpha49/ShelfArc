import { type NextRequest } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiError, getErrorMessage, parseJsonBody } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"

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
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replaceAll('"', '""')}"`
  }
  return str
}

type ExportFormat = "json" | "csv"
type ExportScope = "all" | "selected"

function validateExportBody(
  body: Record<string, unknown>,
  correlationId: string
): { format: ExportFormat; scope: ExportScope; ids?: string[] } | Response {
  const format = body.format
  if (format !== "json" && format !== "csv") {
    return apiError(400, "Format must be 'json' or 'csv'", { correlationId })
  }

  const scope = body.scope
  if (scope !== "all" && scope !== "selected") {
    return apiError(400, "Scope must be 'all' or 'selected'", { correlationId })
  }

  if (scope === "selected") {
    if (
      !Array.isArray(body.ids) ||
      body.ids.length === 0 ||
      !body.ids.every((id: unknown) => typeof id === "string")
    ) {
      return apiError(
        400,
        "Selected scope requires a non-empty 'ids' array of strings",
        {
          correlationId
        }
      )
    }
    if (body.ids.length > 500) {
      return apiError(400, "Maximum 500 series IDs allowed", { correlationId })
    }
    return { format, scope, ids: body.ids }
  }

  return { format, scope }
}

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

function buildCsv(series: Record<string, unknown>[]): string {
  const rows: string[] = [CSV_COLUMNS.join(",")]

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

    const validated = validateExportBody(body, correlationId)
    if (validated instanceof Response) return validated
    const { format, scope, ids } = validated

    let query = supabase
      .from("series")
      .select("*, volumes(*)")
      .eq("user_id", user.id)

    if (scope === "selected" && ids) {
      query = query.in("id", ids)
    }

    const { data: series, error } = await query

    if (error) {
      log.error("Export query failed", { error: error.message })
      return apiError(500, "Failed to fetch library data", { correlationId })
    }

    if (!series || series.length === 0) {
      return apiError(404, "No data to export", { correlationId })
    }

    const totalVolumes = series.reduce(
      (sum: number, s: Record<string, unknown>) =>
        sum + (Array.isArray(s.volumes) ? s.volumes.length : 0),
      0
    )
    if (totalVolumes > 10_000) {
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

    if (format === "json") {
      return new Response(JSON.stringify(series, null, 2), {
        headers: { ...baseHeaders, "Content-Type": "application/json" }
      })
    }

    return new Response(buildCsv(series as Record<string, unknown>[]), {
      headers: { ...baseHeaders, "Content-Type": "text/csv; charset=utf-8" }
    })
  } catch (err) {
    log.error("POST /api/library/export failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
