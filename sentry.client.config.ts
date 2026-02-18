import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring (adjust as needed)
  tracesSampleRate: 0.1,

  // Only enable Sentry in production
  enabled: process.env.NODE_ENV === "production"
})
