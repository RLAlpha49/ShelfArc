import type { DateFormat } from "@/lib/store/settings-store"

/**
 * Format a date string or Date according to the user's preferred date format.
 *
 * - `"relative"` — e.g. "2 days ago", "just now", "in 3 hours"
 * - `"short"` — e.g. "Jan 5, 2026"
 * - `"long"` — e.g. "January 5, 2026"
 * - `"iso"` — e.g. "2026-01-05"
 */
export function formatDate(
  input: string | Date | null | undefined,
  format: DateFormat
): string {
  if (!input) return ""

  const date = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return ""

  switch (format) {
    case "relative":
      return formatRelative(date)

    case "short":
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      })

    case "long":
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric"
      })

    case "iso":
      return date.toISOString().slice(0, 10)

    default:
      return formatRelative(date)
  }
}

const MINUTE = 60
const HOUR = 3600
const DAY = 86_400
const WEEK = 604_800
const MONTH = 2_592_000
const YEAR = 31_536_000

function formatRelative(date: Date): string {
  const now = Date.now()
  const diffSeconds = Math.round((now - date.getTime()) / 1000)

  if (diffSeconds < 0) {
    // Future date — fall back to short
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    })
  }

  if (diffSeconds < MINUTE) return "just now"
  if (diffSeconds < HOUR) {
    const minutes = Math.floor(diffSeconds / MINUTE)
    return `${minutes}m ago`
  }
  if (diffSeconds < DAY) {
    const hours = Math.floor(diffSeconds / HOUR)
    return `${hours}h ago`
  }
  if (diffSeconds < WEEK) {
    const days = Math.floor(diffSeconds / DAY)
    return `${days}d ago`
  }
  if (diffSeconds < MONTH) {
    const weeks = Math.floor(diffSeconds / WEEK)
    return `${weeks}w ago`
  }
  if (diffSeconds < YEAR) {
    const months = Math.floor(diffSeconds / MONTH)
    return `${months}mo ago`
  }

  const years = Math.floor(diffSeconds / YEAR)
  return `${years}y ago`
}
