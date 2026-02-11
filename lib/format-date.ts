import type { DateFormat } from "@/lib/store/settings-store"

/**
 * Formats a date string or Date according to the user's preferred date format.
 * @param input - A date string, Date object, or nullish value.
 * @param format - The desired output format ("relative", "short", "long", or "iso").
 * @returns The formatted date string, or an empty string for invalid/missing input.
 * @source
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

/** Seconds in one minute. @source */
const MINUTE = 60
/** Seconds in one hour. @source */
const HOUR = 3600
/** Seconds in one day. @source */
const DAY = 86_400
/** Seconds in one week. @source */
const WEEK = 604_800
/** Seconds in one month (30 days). @source */
const MONTH = 2_592_000
/** Seconds in one year (365 days). @source */
const YEAR = 31_536_000

/**
 * Formats a date as a human-readable relative time string (e.g. "2d ago").
 * @param date - The date to format.
 * @returns A relative time string.
 * @source
 */
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
