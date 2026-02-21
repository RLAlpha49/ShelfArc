import { type NextRequest, NextResponse } from "next/server"

import { protectedRoute } from "@/lib/api/protected-route"
import { RATE_LIMITS } from "@/lib/api/rate-limit-presets"
import { apiError, getErrorMessage } from "@/lib/api-response"
import { getCorrelationId } from "@/lib/correlation"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"

/** Formats a YYYY-MM-DD date string as YYYYMMDD for use in ICS date values. */
function formatIcsDate(dateStr: string): string {
  return dateStr.replaceAll("-", "")
}

/**
 * Escapes special characters in ICS text property values per RFC 5545 §3.3.11.
 * Handles backslash, semicolon, comma, and newline sequences.
 */
function escapeIcsText(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll(";", String.raw`\;`)
    .replaceAll(",", String.raw`\,`)
    .replaceAll("\n", String.raw`\n`)
}

/**
 * Folds a long ICS content line per RFC 5545 §3.1 (max 75 octets per line,
 * continuation lines prefixed with a single space).
 */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 0) {
    parts.push(" " + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  return parts.join("\r\n")
}

/**
 * GET /api/library/export/ical
 *
 * Returns a standards-compliant RFC 5545 iCal (.ics) feed of the authenticated
 * user's volumes that have a publish_date set. Importable into Google Calendar,
 * Apple Calendar, Outlook, and any other iCal-compatible client.
 *
 * Query params:
 *   filter=release_reminder  — include only volumes where release_reminder = true
 */
export async function GET(request: NextRequest) {
  const correlationId = getCorrelationId(request)
  const log = logger.withCorrelationId(correlationId)

  const result = await protectedRoute(request, {
    rateLimit: RATE_LIMITS.exportRead
  })
  if (!result.ok) return result.error
  const { user, supabase } = result

  try {
    const url = new URL(request.url)
    const onlyReminders = url.searchParams.get("filter") === "release_reminder"

    let query = supabase
      .from("volumes")
      .select(
        "id, volume_number, title, publish_date, series_id, isbn, ownership_status, release_reminder, series:series_id(id, title)"
      )
      .eq("user_id", user.id)
      .not("publish_date", "is", null)
      .order("publish_date", { ascending: true })

    if (onlyReminders) {
      query = query.eq("release_reminder", true)
    }

    const { data: volumes, error: queryError } = await query

    if (queryError) {
      log.error("ICS export: volume query failed", {
        error: queryError.message
      })
      return apiError(500, "Failed to fetch releases", { correlationId })
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://shelfarc.app"
    const now = new Date()
    // Format: 20260221T143012Z
    const dtstamp =
      now.toISOString().replaceAll("-", "").replaceAll(":", "").split(".")[0] +
      "Z"

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ShelfArc//Release Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:ShelfArc Releases",
      "X-WR-TIMEZONE:UTC",
      "X-WR-CALDESC:Upcoming manga and book releases from ShelfArc"
    ]

    for (const vol of volumes ?? []) {
      const series = vol.series as { id: string; title: string } | null
      const seriesTitle = series?.title ?? "Unknown Series"
      const summary =
        `${seriesTitle} Vol. ${vol.volume_number}` +
        (vol.title ? ` \u2014 ${vol.title}` : "")

      const publishDate = vol.publish_date as string
      const dtstart = formatIcsDate(publishDate)

      // ICS all-day events use an exclusive DTEND (next calendar day).
      const endDate = new Date(`${publishDate}T00:00:00Z`)
      endDate.setUTCDate(endDate.getUTCDate() + 1)
      const dtend = formatIcsDate(endDate.toISOString().slice(0, 10))

      const descParts: string[] = [
        `Series: ${seriesTitle}`,
        `Volume: ${vol.volume_number}`,
        ...(vol.isbn ? [`ISBN: ${vol.isbn}`] : []),
        `Status: ${vol.ownership_status}`
      ]

      const descEscaped = escapeIcsText(descParts.join(String.raw`\n`))
      const urlLine = series?.id
        ? foldIcsLine(`URL:${baseUrl}/library/series/${series.id}`)
        : null
      const vevent: string[] = [
        "BEGIN:VEVENT",
        foldIcsLine(`UID:vol-${vol.id}@shelfarc`),
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `DTEND;VALUE=DATE:${dtend}`,
        foldIcsLine(`SUMMARY:${escapeIcsText(summary)}`),
        foldIcsLine(`DESCRIPTION:${descEscaped}`),
        ...(urlLine ? [urlLine] : []),
        "END:VEVENT"
      ]
      lines.push(...vevent)
    }

    lines.push("END:VCALENDAR")

    // RFC 5545 mandates CRLF line endings throughout the file.
    const icsContent = lines.join("\r\n") + "\r\n"

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="shelfarc-releases.ics"',
        "Cache-Control": "private, no-cache, no-store"
      }
    })
  } catch (err) {
    log.error("GET /api/library/export/ical failed", {
      error: getErrorMessage(err, "Unknown error")
    })
    return apiError(500, "Internal server error", { correlationId })
  }
}
