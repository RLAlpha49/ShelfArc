import bundleAnalyzer from "@next/bundle-analyzer"
import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true"
})

/** Next.js configuration with allowed remote image domains for Google Books and Open Library covers. @source */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    webVitalsAttribution: ["CLS", "LCP"]
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "m.media-amazon.com" }
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), browsing-topics=()"
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload"
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // The boot script in app/layout.tsx is allow-listed by its SHA-256 hash. In development we re-add 'unsafe-inline' + 'unsafe-eval' for HMR.
              `script-src 'self' 'sha256-+YuD4zenI3s0uiWlxRjPVUd5/ufKvohFmCZOdVx71cg='${process.env.NODE_ENV === "development" ? " 'unsafe-inline' 'unsafe-eval'" : ""}`,
              // 'unsafe-inline' is intentionally kept for style-src: it is required by Tailwind's
              // runtime class generation and CSS-in-JS patterns and carries lower XSS risk.
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join("; ")
          }
        ]
      }
    ]
  }
}

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // Suppress Sentry CLI output during builds
  silent: !process.env.CI,
  // Auth token for source map uploads (set SENTRY_AUTH_TOKEN in env)
  authToken: process.env.SENTRY_AUTH_TOKEN
})
