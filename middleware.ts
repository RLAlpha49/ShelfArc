import { type NextRequest, NextResponse } from "next/server"

import { consumeDistributedRateLimit } from "@/lib/rate-limit-distributed"
import { updateSession } from "@/lib/supabase/middleware"

/**
 * Next.js middleware that refreshes the Supabase auth session on every matched request.
 * Adds private cache hints for the dashboard to reduce redundant recomputation.
 * @param request - The incoming request.
 * @returns The response with an updated session cookie.
 * @source
 */
export async function middleware(request: NextRequest) {
  // Rate limit public profile pages by IP
  if (request.nextUrl.pathname.startsWith("/u/")) {
    const ip =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown"
    const rate = await consumeDistributedRateLimit({
      key: `public-profile:${ip}`,
      maxHits: 60,
      windowMs: 60_000,
      cooldownMs: 30_000,
      reason: "public-profile-rate-limit"
    })

    if (rate && !rate.allowed) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rate.retryAfterMs / 1000).toString()
        }
      })
    }
  }

  const response = await updateSession(request)

  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    response.headers.set(
      "Cache-Control",
      "private, max-age=60, stale-while-revalidate=30"
    )
  }

  return response
}

/** Middleware route matcher configuration; excludes static assets and image files. @source */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*[.](?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
}
