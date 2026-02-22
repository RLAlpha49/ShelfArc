import * as Sentry from "@sentry/nextjs"

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "credit_card",
  "ssn",
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key"
])

function scrubSensitiveData(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(scrubSensitiveData)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEYS.has(key.toLowerCase())
      ? "[Filtered]"
      : scrubSensitiveData(value)
  }
  return result
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring (adjust as needed)
  tracesSampleRate: 0.1,

  // Only enable Sentry in production
  enabled: process.env.NODE_ENV === "production",

  beforeSend(event) {
    if (event.request?.headers) {
      event.request.headers = scrubSensitiveData(
        event.request.headers
      ) as Record<string, string>
    }
    if (event.request?.data) {
      event.request.data = scrubSensitiveData(event.request.data)
    }
    if (event.request?.cookies) {
      event.request.cookies = scrubSensitiveData(
        event.request.cookies
      ) as Record<string, string>
    }
    return event
  }
})
